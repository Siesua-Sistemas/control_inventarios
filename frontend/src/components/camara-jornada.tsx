"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface CamaraJornadaRef {
  capturar: () => Promise<Blob | null>;
}

type Estado = 'iniciando' | 'activa' | 'error';

export const CamaraJornada = forwardRef<CamaraJornadaRef, { className?: string; circular?: boolean }>(
  function CamaraJornada({ className, circular = false }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [estado, setEstado] = useState<Estado>('iniciando');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
      let mounted = true;

      if (!navigator.mediaDevices?.getUserMedia) {
        setEstado('error');
        setErrorMsg('Cámara no disponible — se requiere HTTPS o localhost.');
        return;
      }

      navigator.mediaDevices
        .getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })
        .then((stream) => {
          if (!mounted) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
          setEstado('activa');
        })
        .catch(() => {
          if (!mounted) return;
          setEstado('error');
          setErrorMsg('Sin acceso a la cámara — el registro se guardará sin foto.');
        });

      return () => {
        mounted = false;
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
    }, []);

    useImperativeHandle(ref, () => ({
      capturar: () =>
        new Promise<Blob | null>((resolve) => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || estado !== 'activa') {
            resolve(null);
            return;
          }
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(video, 0, 0);
          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.88);
        }),
    }));

    return (
      <div className={className}>
        {/* Iniciando */}
        {estado === 'iniciando' && (
          <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 ${
            circular ? 'h-full w-full rounded-full' : 'aspect-video w-full rounded-2xl'
          }`}>
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-500" />
          </div>
        )}

        {/* Error de permisos */}
        {estado === 'error' && (
          <div className={`flex flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 ${
            circular ? 'h-full w-full rounded-full' : 'aspect-video w-full rounded-2xl'
          }`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8 text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            {!circular && <p className="px-4 text-center text-xs text-slate-500 dark:text-slate-400">{errorMsg}</p>}
          </div>
        )}

        {/* Video activo — mirrored para selfie */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`object-cover [transform:scaleX(-1)] ${
            circular
              ? 'h-full w-full rounded-full'
              : 'aspect-video w-full rounded-2xl'
          } ${estado === 'activa' ? 'block' : 'hidden'}`}
        />

        {/* Canvas oculto para captura */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  },
);
