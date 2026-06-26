"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface SignaturePadProps {
  label: string;
  name: string;
  onChange: (dataUrl: string | null) => void;
  value?: string | null;
}

function SignatureCanvas({
  onReady,
}: {
  onReady: (getDataUrl: () => string | null, clear: () => void) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasStrokes = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    onReady(
      () => (hasStrokes.current ? canvas.toDataURL('image/png') : null),
      () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
        hasStrokes.current = false;
      },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left),
        y: (e.touches[0].clientY - rect.top),
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    e.preventDefault();
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    hasStrokes.current = true;
  };

  const endDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full cursor-crosshair bg-white"
      style={{ touchAction: 'none', display: 'block' }}
      onMouseDown={startDraw}
      onMouseMove={draw}
      onMouseUp={endDraw}
      onMouseLeave={endDraw}
      onTouchStart={startDraw}
      onTouchMove={draw}
      onTouchEnd={endDraw}
    />
  );
}

function SignatureModal({
  label,
  name,
  initialDataUrl,
  onConfirm,
  onCancel,
}: {
  label: string;
  name: string;
  initialDataUrl: string | null;
  onConfirm: (dataUrl: string | null) => void;
  onCancel: () => void;
}) {
  const getDataUrlRef = useRef<(() => string | null) | null>(null);
  const clearRef = useRef<(() => void) | null>(null);

  const handleReady = (getDataUrl: () => string | null, clear: () => void) => {
    getDataUrlRef.current = getDataUrl;
    clearRef.current = clear;
  };

  const handleConfirm = () => {
    const dataUrl = getDataUrlRef.current?.() ?? null;
    onConfirm(dataUrl);
  };

  const handleClear = () => {
    clearRef.current?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="flex flex-1 flex-col bg-white dark:bg-slate-900 m-0 md:m-8 md:rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{name}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Canvas area */}
        <div className="relative flex-1 overflow-hidden">
          <SignatureCanvas onReady={handleReady} />
          <p className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-xs text-slate-300 dark:text-slate-600 select-none">
            Firma con el dedo, lápiz o mouse
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Borrar
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-semibold text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
            >
              Confirmar firma
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function SignaturePad({ label, name, onChange, value }: SignaturePadProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [signed, setSigned] = useState<string | null>(value ?? null);

  const handleConfirm = (dataUrl: string | null) => {
    setSigned(dataUrl);
    onChange(dataUrl);
    setModalOpen(false);
  };

  const handleClear = () => {
    setSigned(null);
    onChange(null);
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">{label}</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{name}</p>
          </div>
          {signed && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
            >
              Borrar
            </button>
          )}
        </div>

        {signed ? (
          /* Preview + button to re-sign */
          <div
            className="relative group cursor-pointer rounded-xl border border-slate-300 bg-white overflow-hidden dark:border-slate-700"
            style={{ height: '120px' }}
            onClick={() => setModalOpen(true)}
          >
            <img src={signed} alt="Firma" className="h-full w-full object-contain p-2" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl">
              <span className="hidden group-hover:flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
                Volver a firmar
              </span>
            </div>
          </div>
        ) : (
          /* Empty state — big tap target */
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition-colors hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-600 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-cyan-600 dark:hover:bg-cyan-900/20 dark:hover:text-cyan-400"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
            <span className="text-sm font-medium">Toca aquí para firmar</span>
          </button>
        )}
      </div>

      {modalOpen && (
        <SignatureModal
          label={label}
          name={name}
          initialDataUrl={signed}
          onConfirm={handleConfirm}
          onCancel={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
