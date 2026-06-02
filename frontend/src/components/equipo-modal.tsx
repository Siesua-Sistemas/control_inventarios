"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { getEquipmentProfile, listHistorial, type AsignacionRow, type EquipmentProfile } from '@/lib/api';
import { ESTADO_COLORS, TIPO_MOV_COLORS as TIPO_MOV } from '@/lib/constants';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';


interface EquipoModalProps {
  equipoId: number;
  onClose: () => void;
}

export function EquipoModal({ equipoId, onClose }: EquipoModalProps) {
  const [profile, setProfile] = useState<EquipmentProfile | null>(null);
  const [movimientos, setMovimientos] = useState<AsignacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      getEquipmentProfile(equipoId),
      listHistorial({ equipment_id: equipoId, limit: 5 }),
    ])
      .then(([prof, hist]) => {
        setProfile(prof);
        setMovimientos(hist.items);
      })
      .finally(() => setLoading(false));
  }, [equipoId]);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const eq = profile?.equipment;
  const foto = profile?.photos[0];

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">

        {/* Cerrar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-colors"
        >
          ✕
        </button>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" />
            <p className="text-sm text-slate-500">Cargando equipo...</p>
          </div>
        )}

        {!loading && eq && (
          <>
            {/* Header con foto */}
            <div className="flex gap-5 p-6 pb-4">
              {/* Foto */}
              <div className="shrink-0">
                {foto ? (
                  <img
                    src={`${API_BASE}${foto.url}`}
                    alt={eq.codigo_interno}
                    className="h-20 w-20 rounded-xl border border-slate-700 object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-2xl text-slate-600">
                    📦
                  </div>
                )}
              </div>

              {/* Info principal */}
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">{eq.tipo}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ESTADO_COLORS[eq.estado] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                    {eq.estado}
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-bold text-white">{eq.marca} {eq.modelo}</h2>
                <p className="font-mono text-sm text-cyan-400">{eq.codigo_interno}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>S/N: <span className="font-mono text-slate-300">{eq.serial}</span></span>
                  {eq.sede && <span>Sede: <span className="text-slate-300">{eq.sede}</span></span>}
                  {eq.ubicacion && <span>Ubicación: <span className="text-slate-300">{eq.ubicacion}</span></span>}
                  {eq.placa && <span>Placa: <span className="text-slate-300">{eq.placa}</span></span>}
                </div>
              </div>
            </div>

            {/* Periféricos */}
            {profile.children.length > 0 && (
              <div className="mx-6 mb-4 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Periféricos ({profile.children.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.children.map((c) => (
                    <span key={c.id} className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                      <span className="font-mono text-cyan-400">{c.codigo_interno}</span>
                      <span className="ml-1.5 text-slate-400">{c.tipo} · {c.marca} {c.modelo}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Especificaciones técnicas */}
            {eq.specs && Object.keys(eq.specs).length > 0 && (
              <div className="mx-6 mb-4 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Especificaciones</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {Object.entries(eq.specs).map(([k, v]) => (
                    v !== null && v !== '' && (
                      <div key={k} className="flex items-baseline gap-1.5">
                        <span className="shrink-0 text-xs text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                        <span className="text-xs font-medium text-slate-300 truncate">{String(v)}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Últimos movimientos */}
            {movimientos.length > 0 && (
              <div className="mx-6 mb-4 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Últimos movimientos</p>
                <div className="space-y-1.5">
                  {movimientos.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 text-xs">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${TIPO_MOV[m.tipo] ?? 'bg-slate-700 text-slate-400'}`}>
                        {m.tipo}
                      </span>
                      <span className="text-slate-400 shrink-0">
                        {new Date(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-slate-300 truncate">
                        {m.empleado_nombre ?? m.bodega_destino_nombre ?? '—'}
                      </span>
                      <span className="ml-auto shrink-0 text-slate-500">{m.estado_despues}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info financiera */}
            {(eq.valor || eq.proveedor || eq.fecha_compra || eq.garantia_vence) && (
              <div className="mx-6 mb-4 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Información adicional</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  {eq.valor && <div><span className="text-slate-500">Valor: </span><span className="text-slate-300">${Number(eq.valor).toLocaleString('es-CO')}</span></div>}
                  {eq.proveedor && <div><span className="text-slate-500">Proveedor: </span><span className="text-slate-300">{eq.proveedor}</span></div>}
                  {eq.fecha_compra && <div><span className="text-slate-500">Compra: </span><span className="text-slate-300">{eq.fecha_compra}</span></div>}
                  {eq.garantia_vence && <div><span className="text-slate-500">Garantía: </span><span className="text-slate-300">{eq.garantia_vence}</span></div>}
                </div>
              </div>
            )}

            {/* Footer: acciones */}
            <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4">
              <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                Cerrar
              </button>
              <Link
                href={`/equipos/${eq.id}/hoja-de-vida`}
                onClick={onClose}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                Ver hoja de vida completa →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
