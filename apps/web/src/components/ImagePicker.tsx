'use client';

import { useRef, useState } from 'react';

const MAX_FILES = 10;

type Props = {
  label?: string;
  disabled?: boolean;
  /** Archivos seleccionados (controlado desde el padre al registrar) */
  files?: File[];
  onChange?: (files: File[]) => void;
  /** Subir directo al servidor */
  onUpload?: (files: File[]) => Promise<void>;
  uploading?: boolean;
  hint?: string;
};

export function ImagePicker({
  label = 'Fotos (máx. 10)',
  disabled,
  files: controlledFiles,
  onChange,
  onUpload,
  uploading,
  hint = 'Se achican solas antes de subir, para que la pantalla no se quede cargando.',
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [internalFiles, setInternalFiles] = useState<File[]>([]);
  const [error, setError] = useState('');

  const files = controlledFiles ?? internalFiles;
  const setFiles = (next: File[]) => {
    if (onChange) onChange(next);
    else setInternalFiles(next);
  };

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const merged = [...files, ...Array.from(list)].slice(0, MAX_FILES);
    if (files.length + list.length > MAX_FILES) {
      setError(`Máximo ${MAX_FILES} fotos.`);
    } else {
      setError('');
    }
    setFiles(merged);
  }

  function removeAt(index: number) {
    setFiles(files.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (!onUpload || !files.length) return;
    setError('');
    try {
      await onUpload(files);
      setFiles([]);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir');
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">{label}</label>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || files.length >= MAX_FILES}
          onClick={() => cameraRef.current?.click()}
          className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          📷 Tomar foto
        </button>
        <button
          type="button"
          disabled={disabled || files.length >= MAX_FILES}
          onClick={() => galleryRef.current?.click()}
          className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
        >
          🖼 Galería
        </button>
      </div>
      {files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(f)}
                alt={f.name}
                className="h-20 w-full object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-[#6c757d]">
        {files.length}/{MAX_FILES}. {hint}
      </p>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {onUpload && files.length > 0 && (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={handleUpload}
          className="rounded-lg bg-[#f5c842] px-4 py-2 font-semibold text-sm disabled:opacity-50"
        >
          {uploading ? 'Subiendo...' : `Subir ${files.length} foto(s) ahora`}
        </button>
      )}
    </div>
  );
}
