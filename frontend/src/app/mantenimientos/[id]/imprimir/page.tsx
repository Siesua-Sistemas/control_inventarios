"use client";

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getMantenimiento, isAuthenticated, type MantenimientoRow } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const ESTADO_LABEL: Record<string, string> = {
  programado: 'Programado',
  en_proceso: 'En proceso',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
  pendiente_aprobacion: 'Pendiente de aprobación',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

function formatFecha(iso: string | null, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric' }): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', opts);
}

export default function ImprimirMantenimientoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [m, setM] = useState<MantenimientoRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getMantenimiento(Number(id))
      .then(setM)
      .catch(() => setError('No se encontró la orden de trabajo.'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-slate-500">Cargando orden de trabajo...</p>
      </main>
    );
  }

  if (error || !m) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white">
        <p className="text-red-600">{error || 'Error'}</p>
        <button onClick={() => router.back()} className="text-blue-600 underline">Volver</button>
      </main>
    );
  }

  const totalPasos = m.pasos.length;
  const pasosOk = m.pasos.filter((p) => p.completado).length;
  const fueraDeRango = (p: typeof m.pasos[number]) => {
    if (p.tipo_campo !== 'numero' || p.valor === null || p.valor === '') return false;
    const v = Number(p.valor);
    if (Number.isNaN(v)) return false;
    if (p.valor_min !== null && v < Number(p.valor_min)) return true;
    if (p.valor_max !== null && v > Number(p.valor_max)) return true;
    return false;
  };

  return (
    <>
      {/* Controles — se ocultan al imprimir */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-slate-900 px-6 py-3 shadow-lg">
        <button onClick={() => router.back()} className="rounded-md bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600">
          ← Volver
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          🖨 Imprimir / Guardar PDF
        </button>
      </div>

      {/* Documento */}
      <main className="min-h-screen bg-white px-12 py-10 pt-24 print:pt-10 text-slate-900 font-sans text-sm">

        {/* Encabezado */}
        <div className="mb-8 flex items-start justify-between border-b-2 border-slate-800 pb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Sistema de Control de Inventarios</p>
            <h1 className="mt-1 text-2xl font-bold">Orden de Trabajo de Mantenimiento</h1>
            <p className="mt-1 text-sm capitalize text-slate-600">{formatFecha(m.fecha, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">N° de orden</p>
            <p className="font-mono text-lg font-bold">{m.numero_ot ?? `OT-${m.id}`}</p>
            <p className="mt-1 text-sm font-semibold">{m.tipo} · {ESTADO_LABEL[m.estado] ?? m.estado}</p>
          </div>
        </div>

        {/* Equipo */}
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Equipo</h2>
          <div className="grid grid-cols-4 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">Código</p>
              <p className="mt-0.5 font-mono font-semibold">{m.equipment_codigo}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Serial</p>
              <p className="mt-0.5 font-mono font-semibold">{m.equipment_serial}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Marca</p>
              <p className="mt-0.5 font-semibold">{m.equipment_marca}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Modelo</p>
              <p className="mt-0.5 font-semibold">{m.equipment_modelo}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Tipo</p>
              <p className="mt-0.5 font-semibold">{m.equipment_tipo}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Sede</p>
              <p className="mt-0.5 font-semibold">{m.equipment_sede}</p>
            </div>
            {m.equipment_registro_sanitario && (
              <div className="col-span-2">
                <p className="text-xs text-slate-500">Registro sanitario</p>
                <p className="mt-0.5 font-mono font-semibold">{m.equipment_registro_sanitario}</p>
              </div>
            )}
          </div>
        </section>

        {/* Datos del servicio */}
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Datos del servicio</h2>
          <div className="grid grid-cols-4 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">Prioridad</p>
              <p className="mt-0.5 font-semibold">{m.prioridad ?? 'Media'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Técnico</p>
              <p className="mt-0.5 font-semibold">{m.tecnico_nombre ?? m.tecnico ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Costo</p>
              <p className="mt-0.5 font-semibold">{m.costo ? `$${Number(m.costo).toLocaleString('es-CO')}` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Próximo mantenimiento</p>
              <p className="mt-0.5 font-semibold">{m.proximo_mantenimiento ? formatFecha(m.proximo_mantenimiento) : 'No aplica'}</p>
            </div>
          </div>
        </section>

        {/* Descripción */}
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Descripción del trabajo</h2>
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700 whitespace-pre-wrap">{m.descripcion}</p>
        </section>

        {/* Checklist */}
        {totalPasos > 0 && (
          <section className="mb-6 break-inside-avoid">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Checklist de verificación ({pasosOk}/{totalPasos})
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Punto de verificación</th>
                  <th className="py-2 pr-4">Resultado</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {m.pasos.map((p, i) => (
                  <tr key={p.id} className="border-b border-slate-200">
                    <td className="py-2 pr-4 align-top text-slate-400">{i + 1}</td>
                    <td className="py-2 pr-4 align-top">
                      {p.descripcion}
                      {!p.obligatorio && <span className="ml-1 text-xs text-slate-400">(opcional)</span>}
                    </td>
                    <td className="py-2 pr-4 align-top">
                      {p.tipo_campo === 'checkbox'
                        ? (p.completado ? 'Conforme' : 'No conforme')
                        : (p.valor || '—') + (p.tipo_campo === 'numero' && p.unidad ? ` ${p.unidad}` : '')}
                    </td>
                    <td className="py-2 align-top">
                      {p.tipo_campo === 'checkbox' ? (
                        <span className={p.completado ? 'text-emerald-700' : 'text-red-600'}>{p.completado ? '✓' : '✗'}</span>
                      ) : fueraDeRango(p) ? (
                        <span className="font-semibold text-red-600">Fuera de rango</span>
                      ) : p.completado ? (
                        <span className="text-emerald-700">✓</span>
                      ) : (
                        <span className="text-slate-400">Sin registrar</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Observaciones */}
        {m.observaciones && (
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Observaciones</h2>
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700 whitespace-pre-wrap">{m.observaciones}</p>
          </section>
        )}

        {/* Fotografías de soporte */}
        {m.fotos.length > 0 && (
          <section className="mb-6 break-inside-avoid">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Evidencia fotográfica</h2>
            <div className="grid grid-cols-4 gap-3">
              {m.fotos.map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f.id} src={`${API_BASE}${f.url}`} alt="Evidencia" className="h-28 w-full rounded-lg border border-slate-200 object-cover" />
              ))}
            </div>
          </section>
        )}

        {/* Aprobación */}
        {(m.estado === 'aprobado' || m.estado === 'rechazado') && (
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Aprobación</h2>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold">
                {m.estado === 'aprobado' ? '✓ Aprobada' : '✗ Rechazada'} por {m.aprobado_por_nombre ?? '—'}
                {m.aprobado_en && ` · ${formatFecha(m.aprobado_en)}`}
              </p>
              {m.comentario_aprobacion && <p className="mt-1 text-slate-700">{m.comentario_aprobacion}</p>}
            </div>
          </section>
        )}

        {/* Firmas */}
        <div className="mt-12 grid grid-cols-2 gap-16 break-inside-avoid">
          <div className="text-center">
            {m.firma_tecnico ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.firma_tecnico} alt="Firma del técnico" className="mx-auto mb-2 h-24 w-auto object-contain" />
            ) : (
              <div className="mb-2 h-24 border-b border-slate-400" />
            )}
            <p className="text-xs text-slate-500">Firma del técnico</p>
            <p className="mt-1 text-xs font-medium">{m.tecnico_nombre ?? m.tecnico ?? '—'}</p>
          </div>
          <div className="text-center">
            {m.firma_supervisor ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.firma_supervisor} alt="Firma de aprobación" className="mx-auto mb-2 h-24 w-auto object-contain" />
            ) : (
              <div className="mb-2 h-24 border-b border-slate-400" />
            )}
            <p className="text-xs text-slate-500">Firma de aprobación</p>
            <p className="mt-1 text-xs font-medium">{m.aprobado_por_nombre ?? '—'}</p>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-400">
          Registrado por: <span className="font-medium text-slate-600">{m.created_by_nombre}</span>
          {' · '}{formatFecha(m.created_at)}
        </p>

        <p className="mt-4 hidden text-center text-xs text-slate-400 print:block">
          Documento generado — Sistema de Control de Inventarios · {m.numero_ot ?? `OT-${m.id}`}
        </p>
      </main>
    </>
  );
}
