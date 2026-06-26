"use client";

import { useRef, useState } from 'react';

export interface ImageFile {
  file: File;
  preview: string;
}

interface ImagePickerProps {
  images: ImageFile[];
  onChange: (images: ImageFile[]) => void;
  maxFiles?: number;
  className?: string;
}

export function ImagePicker({ images, onChange, maxFiles = 5, className = '' }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const available = maxFiles - images.length;
    if (available <= 0) return;
    const added: ImageFile[] = [];
    Array.from(files).slice(0, available).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const preview = URL.createObjectURL(file);
      added.push({ file, preview });
    });
    onChange([...images, ...added]);
  };

  const remove = (idx: number) => {
    URL.revokeObjectURL(images[idx].preview);
    onChange(images.filter((_, i) => i !== idx));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const remaining = maxFiles - images.length;
  const canAdd = remaining > 0;

  return (
    <div className={className}>
      {/* Zona de drop + botón */}
      {canAdd && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors
            ${dragOver
              ? 'border-cyan-400 bg-cyan-50 dark:border-cyan-600 dark:bg-cyan-900/20'
              : 'border-slate-300 bg-slate-50 hover:border-cyan-400 hover:bg-cyan-50/50 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-cyan-600'
            }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm dark:bg-slate-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5 text-cyan-600 dark:text-cyan-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Toca para adjuntar fotos
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Cámara o galería · máx {remaining} imagen{remaining !== 1 ? 'es' : ''} · 10 MB c/u
            </p>
          </div>
        </div>
      )}

      {/* Input oculto — sin capture para dar opción galería/cámara en móvil */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
      />

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {images.map((img, idx) => (
            <div key={idx} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.preview}
                alt={img.file.name}
                className="h-full w-full rounded-xl object-cover border border-slate-200 dark:border-slate-700"
              />
              {/* Tamaño */}
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white">
                {(img.file.size / 1024 / 1024).toFixed(1)}MB
              </span>
              {/* Eliminar */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(idx); }}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"
                aria-label="Eliminar imagen"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Agregar más */}
          {canAdd && images.length > 0 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-cyan-600"
              aria-label="Agregar más fotos"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Galería solo lectura ──────────────────────────────────────────────────────

interface ImageGalleryProps {
  urls: string[];
  apiBase?: string;
}

export function ImageGallery({ urls, apiBase = '' }: ImageGalleryProps) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (urls.length === 0) return null;

  return (
    <>
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${apiBase}${lightbox}`}
            alt="Foto adjunta"
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
            onClick={() => setLightbox(null)}
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {urls.map((url, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setLightbox(url)}
            className="aspect-square overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${apiBase}${url}`}
              alt={`Foto ${idx + 1}`}
              className="h-full w-full object-cover transition-transform hover:scale-105"
            />
          </button>
        ))}
      </div>
    </>
  );
}
