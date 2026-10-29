import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fileTypeFromBuffer } from 'file-type';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { StoredImage, StorageService } from './storage.interface';
import { resolveUploadDir } from './upload-path';

sharp.concurrency(1);
sharp.cache(false);

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 25 * 1024 * 1024;
const FOTO_LADO_MAXIMO = 1920;
export const MAX_IMAGENES_POR_ETAPA = 10;

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly uploadDir: string;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = resolveUploadDir(config);
  }

  private async ensureDir(dir: string) {
    await mkdir(dir, { recursive: true });
  }

  private async validateBuffer(buffer: Buffer) {
    if (buffer.length > MAX_BYTES) {
      throw new Error('La imagen supera el máximo de 25 MB');
    }

    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !ALLOWED_MIMES.has(detected.mime)) {
      throw new Error('Tipo de archivo no permitido. Solo JPG, PNG o WebP');
    }

    return detected.mime;
  }

  async saveImage(buffer: Buffer, _originalName: string): Promise<StoredImage> {
    await this.validateBuffer(buffer);

    const id = uuidv4();
    const filename = `${id}.webp`;
    const thumbFilename = `${id}-thumb.webp`;
    const imagesDir = join(this.uploadDir, 'images');
    const thumbsDir = join(this.uploadDir, 'thumbnails');

    await this.ensureDir(imagesDir);
    await this.ensureDir(thumbsDir);

    const fullPath = join(imagesDir, filename);
    const thumbPath = join(thumbsDir, thumbFilename);

    let webpBuffer: Buffer;
    let thumbBuffer: Buffer;
    try {
      webpBuffer = await this.toOrientedWebp(buffer);
      thumbBuffer = await sharp(webpBuffer, { failOn: 'none' })
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();
    } catch {
      throw new Error('No se pudo procesar esta foto. Tómela de nuevo o elija un JPG más liviano.');
    }

    await writeFile(fullPath, webpBuffer);
    await writeFile(thumbPath, thumbBuffer);

    return {
      filename,
      url: `/uploads/images/${filename}`,
      thumbnailUrl: `/uploads/thumbnails/${thumbFilename}`,
    };
  }

  /** Endereza la foto del celular y la deja como máximo en 1920 px, una sola vez. */
  private toOrientedWebp(buffer: Buffer) {
    return sharp(buffer, {
      failOn: 'none',
      limitInputPixels: 40_000_000,
      sequentialRead: true,
    })
      .rotate()
      .resize(FOTO_LADO_MAXIMO, FOTO_LADO_MAXIMO, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
  }

  async saveReferenceImage(buffer: Buffer, _originalName: string): Promise<{ url: string; filename: string }> {
    const stored = await this.saveImage(buffer, _originalName);
    return { url: stored.url, filename: stored.filename };
  }

  async saveAudio(buffer: Buffer, _originalName: string): Promise<{ url: string; filename: string }> {
    if (buffer.length > 15 * 1024 * 1024) {
      throw new Error('El audio supera el máximo de 15 MB');
    }
    const id = uuidv4();
    const filename = `${id}.webm`;
    const audioDir = join(this.uploadDir, 'audio');
    await this.ensureDir(audioDir);
    await writeFile(join(audioDir, filename), buffer);
    return { url: `/uploads/audio/${filename}`, filename };
  }

  async saveVideo(buffer: Buffer, originalName: string): Promise<{ url: string; filename: string }> {
    if (buffer.length > 8 * 1024 * 1024) {
      throw new Error('El video supera 8 MB. Grabe unos 10 segundos.');
    }
    const lower = originalName.toLowerCase();
    const ext = lower.endsWith('.webm')
      ? 'webm'
      : lower.endsWith('.mov')
        ? 'mov'
        : lower.endsWith('.3gp')
          ? '3gp'
          : 'mp4';
    const id = uuidv4();
    const filename = `${id}.${ext}`;
    const videoDir = join(this.uploadDir, 'videos');
    await this.ensureDir(videoDir);
    await writeFile(join(videoDir, filename), buffer);
    return { url: `/uploads/videos/${filename}`, filename };
  }

  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = join(this.uploadDir, relativePath.replace(/^\/uploads\//, ''));
    try {
      await unlink(fullPath);
    } catch {
      // ignore missing files
    }
  }
}
