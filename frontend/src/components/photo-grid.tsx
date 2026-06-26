"use client";
import { useEffect, useRef, useState } from 'react';

interface PhotoItem { id: number; url: string; }

export function PhotoGrid({
  photos, apiBase, onUpload, onDelete, uploading,
}: {
  photos: PhotoItem[];
  apiBase: string;
  onUpload?: (file: File) => Promise<void>;
  onDelete?: (photoId: number) => Promise<void>;
  uploading?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox]);

  return (
    <div className="space-y-4">
      {onUpload && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
            {uploading ? 'Subiendo...' : '+ Subir foto'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await onUpload(file);
              if (fileRef.current) fileRef.current.value = '';
            }} />
          <span className="text-xs text-slate-500">JPEG, PNG, WebP o GIF</span>
        </div>
      )}

      {photos.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">No hay fotos registradas.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <img src={`${apiBase}${photo.url}`} alt="Foto"
                onClick={() => setLightbox(`${apiBase}${photo.url}`)}
                className="h-40 w-full cursor-zoom-in object-cover" />
              {onDelete && (
                <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100 p-2">
                  <button onClick={() => onDelete(photo.id)} className="rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500">Eliminar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
          <button onClick={() => setLightbox(null)} className="absolute right-4 top-4 z-10 rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">✕</button>
          <img src={lightbox} alt="Vista ampliada" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
