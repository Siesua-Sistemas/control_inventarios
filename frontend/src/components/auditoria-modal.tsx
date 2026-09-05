"use client";

import { useState } from 'react';
import { RegistroJornadaOut, storageUrl } from '@/lib/api';

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
  });
}

function parsearDispositivo(ua: string): string {
  let browser = '';
  if (/Edg\//.test(ua))                                   browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua))                        browser = 'Opera';
  else if (/Chrome\/([\d]+)/.test(ua)) {
    const v = ua.match(/Chrome\/([\d]+)/)?.[1] ?? '';
    browser = `Chrome ${v}`;
  } else if (/Firefox\/([\d]+)/.test(ua)) {
    const v = ua.match(/Firefox\/([\d]+)/)?.[1] ?? '';
    browser = `Firefox ${v}`;
  } else if (/Safari\//.test(ua))                         browser = 'Safari';

  let os = '';
  if (/iPhone/.test(ua))                  os = 'iPhone';
  else if (/iPad/.test(ua))               os = 'iPad';
  else if (/Android/.test(ua))            os = 'Android';
  else if (/Windows NT 10\.0/.test(ua))   os = 'Windows 10/11';
  else if (/Windows NT 6\.1/.test(ua))    os = 'Windows 7';
  else if (/Windows/.test(ua))            os = 'Windows';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua))              os = 'Linux';

  if (browser && os) return `${browser} · ${os}`;
  return browser || os || ua.slice(0, 40);
}

const ESTADO_CFG = {
  presente: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    label: 'En sede',
  },
  completo: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    label: 'Salió',
  },
  ausente: {
    dot: 'bg-red-400',
    badge: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    label: 'Ausente',
  },
} as const;

function EstadoBadge({ estado }: { estado: keyof typeof ESTADO_CFG }) {
  const cfg = ESTADO_CFG[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

/**
 * Vista de auditoría de un empleado en un día: timeline de registros con
 * evidencia (foto, GPS, IP, dispositivo). Es la misma vista que usa el
 * dashboard de "Control de Asistencia", reutilizable desde cualquier
 * pantalla que ya tenga los registros de ese día cargados.
 */
export function AuditoriaModal({
  nombres,
  apellidos,
  cargo,
  sede,
  estado,
  tiempoSedeLabel,
  registros,
  loading = false,
  onClose,
}: {
  nombres: string;
  apellidos: string;
  cargo?: string | null;
  sede?: string | null;
  estado: keyof typeof ESTADO_CFG;
  tiempoSedeLabel?: string | null;
  registros: RegistroJornadaOut[];
  loading?: boolean;
  onClose: () => void;
}) {
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center px-0 sm:px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {fotoAmpliada && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFotoAmpliada(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotoAmpliada} alt="Evidencia" className="max-h-[90vh] max-w-full rounded-xl object-contain" />
        </div>
      )}

      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="font-bold">{nombres} {apellidos}</h2>
              <EstadoBadge estado={estado} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {[cargo, sede].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Resumen del día */}
          {tiempoSedeLabel && (
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-900/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Tiempo en sede</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{tiempoSedeLabel}</p>
              </div>
            </div>
          )}

          {/* Timeline de registros */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Registros del día
            </p>
            {loading ? (
              <div className="flex justify-center py-8">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500" />
              </div>
            ) : registros.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Sin registros</p>
            ) : (
              <ol className="relative ml-2 border-l border-slate-200 dark:border-slate-700">
                {registros.map((r) => {
                  const isEntrada = r.tipo === 'entrada';
                  const fotoUrl = storageUrl(r.foto_url);
                  return (
                    <li key={r.id} className="mb-5 ml-5">
                      <span className={`absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white dark:ring-slate-900 ${isEntrada ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                        {isEntrada ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                          </svg>
                        )}
                      </span>

                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className={`text-sm font-semibold ${isEntrada ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                              {isEntrada ? 'Entrada' : 'Salida'}
                            </span>
                            <span className="font-mono text-sm text-slate-500">{formatHora(r.timestamp)}</span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            {r.latitud != null && r.longitud != null && (
                              <a
                                href={`https://www.google.com/maps?q=${r.latitud},${r.longitud}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline decoration-dotted hover:text-cyan-600 dark:hover:text-cyan-400"
                              >
                                📍 {r.latitud.toFixed(5)}, {r.longitud.toFixed(5)}
                              </a>
                            )}
                            {r.ip_publica && <span>🌐 {r.ip_publica}</span>}
                            {r.ubicacion_no_verificada && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                ⚠ {r.latitud != null ? 'Fuera de sede' : 'Sin GPS ni IP verificada'}
                              </span>
                            )}
                          </div>
                          {r.dispositivo && (
                            <p className="mt-0.5 text-xs text-slate-400 truncate max-w-[240px]">
                              📱 {parsearDispositivo(r.dispositivo)}
                            </p>
                          )}
                        </div>
                        {fotoUrl && (
                          <button type="button" onClick={() => setFotoAmpliada(fotoUrl)}
                            className="shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={fotoUrl} alt="Evidencia" className="h-16 w-16 object-cover hover:opacity-80 transition-opacity" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
