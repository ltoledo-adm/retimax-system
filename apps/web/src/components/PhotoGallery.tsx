'use client';

import { useCallback, useEffect, useState } from 'react';
import { ImagenMaquinaDto } from '@retimax/shared-types';
import { imageUrl } from '@/lib/api';
import { ETAPA_LABELS } from '@/lib/labels';

type Props = {
  imagenes: ImagenMaquinaDto[];
  /** Filtrar por etapa (ej. solo EMBARQUE) */
  etapa?: string;
  title?: string;
  emptyText?: string;
  onDelete?: (imagenId: string) => Promise<void> | void;
};

function thumbSrc(img: ImagenMaquinaDto) {
  return imageUrl(img.thumbnailUrl || img.url);
}

function fullSrc(img: ImagenMaquinaDto) {
  return imageUrl(img.url);
}

function GalleryThumb({
  img,
  etapa,
  onOpen,
  esPortada,
  onDelete,
}: {
  img: ImagenMaquinaDto;
  etapa: string;
  onOpen: () => void;
  esPortada?: boolean;
  onDelete?: (imagenId: string) => Promise<void> | void;
}) {
  const [src, setSrc] = useState(thumbSrc(img));

  return (
    <div className="group relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200 hover:border-[#f5c842] shadow-sm hover:shadow-md transition-all bg-gray-100">
      <button type="button" onClick={onOpen} className="absolute inset-0 focus:outline-none" aria-label="Ver grande" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={ETAPA_LABELS[etapa] ?? etapa}
        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
        onError={() => {
          if (src !== fullSrc(img)) setSrc(fullSrc(img));
        }}
      />
      {esPortada && (
        <span className="absolute top-1 left-1 rounded bg-[#1a1a1a]/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
          Portada
        </span>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={() => void onDelete(img.id)}
          className="absolute top-1 right-1 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-red-700"
        >
          Eliminar
        </button>
      )}
      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
        <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">
          Ver grande
        </span>
      </span>
    </div>
  );
}

export function PhotoGallery({
  imagenes,
  etapa,
  title,
  emptyText = 'Sin fotos registradas',
  onDelete,
}: Props) {
  const filtered = etapa ? imagenes.filter((i) => i.etapa === etapa) : imagenes;
  const grouped = filtered.reduce<Record<string, ImagenMaquinaDto[]>>((acc, img) => {
    if (!acc[img.etapa]) acc[img.etapa] = [];
    acc[img.etapa].push(img);
    return acc;
  }, {});
  const entries = Object.entries(grouped);

  const flat = entries.flatMap(([, imgs]) => imgs);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const close = useCallback(() => setLightboxIndex(null), []);
  const current = lightboxIndex !== null ? flat[lightboxIndex] : null;

  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i === null ? null : Math.min(i + 1, flat.length - 1)));
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i === null ? null : Math.max(i - 1, 0)));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, flat.length, close]);

  if (!entries.length) {
    return <p className="text-[#6c757d] text-sm">{emptyText}</p>;
  }

  return (
    <>
      <div className="space-y-4">
        {title && <h4 className="font-semibold text-sm">{title}</h4>}
        {entries.map(([et, imgs]) => (
          <div key={et}>
            {!title && (
              <h4 className="text-sm font-medium text-[#6c757d] mb-3">
                {ETAPA_LABELS[et] ?? et}{' '}
                <span className="text-xs font-normal">({imgs.length})</span>
              </h4>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {imgs.map((img) => {
                const idx = flat.findIndex((f) => f.id === img.id);
                return (
                  <GalleryThumb
                    key={img.id}
                    img={img}
                    etapa={et}
                    esPortada={img.id === flat[0]?.id}
                    onDelete={onDelete}
                    onOpen={() => setLightboxIndex(idx)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {current && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3 w-full justify-end">
              <span className="text-white/80 text-sm mr-auto">
                {lightboxIndex + 1} / {flat.length}
              </span>
              <a
                href={fullSrc(current)}
                download
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-sm"
              >
                Descargar
              </a>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    const id = current.id;
                    close();
                    void onDelete(id);
                  }}
                  className="rounded-lg bg-red-600/90 hover:bg-red-700 text-white px-3 py-1.5 text-sm"
                >
                  Eliminar
                </button>
              )}
              <button
                type="button"
                onClick={close}
                className="rounded-lg bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-sm"
              >
                Cerrar ✕
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullSrc(current)}
              alt=""
              className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
            />
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                disabled={lightboxIndex <= 0}
                onClick={() => setLightboxIndex((i) => (i === null ? null : i - 1))}
                className="rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white px-4 py-2 text-sm"
              >
                ← Anterior
              </button>
              <button
                type="button"
                disabled={lightboxIndex >= flat.length - 1}
                onClick={() => setLightboxIndex((i) => (i === null ? null : i + 1))}
                className="rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white px-4 py-2 text-sm"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
