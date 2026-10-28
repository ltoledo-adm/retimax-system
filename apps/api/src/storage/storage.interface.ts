export interface StoredImage {
  url: string;
  thumbnailUrl: string;
  filename: string;
}

export interface StorageService {
  saveImage(buffer: Buffer, originalName: string): Promise<StoredImage>;
  saveReferenceImage(buffer: Buffer, originalName: string): Promise<{ url: string; filename: string }>;
  saveAudio(buffer: Buffer, originalName: string): Promise<{ url: string; filename: string }>;
  saveVideo(buffer: Buffer, originalName: string): Promise<{ url: string; filename: string }>;
  deleteFile(relativePath: string): Promise<void>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
