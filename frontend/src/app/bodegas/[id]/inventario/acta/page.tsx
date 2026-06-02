"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { getBodegaInventario, isAuthenticated, type BodegaInventario } from '@/lib/api';
import { ESTADO_COLORS } from '@/lib/constants';

export default function ActaBodegaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<BodegaInventario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getBodegaInventario(Number(id))
      .then(setData)
      .catch(() => setError('Error al cargar el inventario.'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" />
            <p className="text-slate-400">Generando acta...</p>
          </div>
        </main>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen flex-col items-center justify-center gap-4">
          <p className="rounded-md bg-red-500/20 px-4 py-2 text-sm text-red-300">{error || 'Sin datos'}</p>
          <Link href={`/bodegas/${id}/inventario`} className="text-indigo-400 hover:underline">← Volver al inventario</Link>
        </main>
      </>
    );
  }

  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">

        {/* Top bar */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/bodegas/${id}/inventario`} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              ← Inventario
            </Link>
            <h1 className="mt-1 text-2xl font-bold">Acta de Entrega de Sede</h1>
            <p className="text-sm capitalize text-slate-400">{today}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/bodegas/${id}/inventario/entrega`}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              Iniciar Entrega →
            </Link>
            <Link
              href={`/bodegas/${id}/inventario/imprimir`}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
            >
              🖨 Imprimir
            </Link>
          </div>
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-slate-700 overflow-hidden shadow-xl">

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-950 to-slate-900 border-b border-indigo-900/50 px-8 py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">Acta de entrega de bodega</p>
                <h2 className="mt-2 text-xl font-bold text-white">{data.bodega.nombre}</h2>
                <p className="mt-0.5 text-sm text-slate-400">{data.bodega.sede}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-300">
                {data.total} {data.total === 1 ? 'equipo' : 'equipos'}
              </span>
            </div>
          </div>

          {/* Responsable */}
          <div className="bg-slate-800/50 border-b border-slate-700 px-8 py-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Responsable de la bodega
            </p>
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Nombre</p>
                <p className="text-lg font-bold text-white">{data.bodega.responsable ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Sede</p>
                <p className="text-base font-semibold text-slate-200">{data.bodega.sede}</p>
              </div>
            </div>
          </div>

          {/* Equipos */}
          <div className="bg-slate-900 px-8 py-6">
            <div className="mb-4 flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Equipos en bodega</p>
              <span className="text-xs text-slate-500">{data.total} en total</span>
            </div>

            <div className="space-y-1.5">
              {data.equipos.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Bodega vacía.</p>
              ) : data.equipos.map((eq) => (
                <div key={eq.id} className="flex items-center gap-4 rounded-xl bg-slate-800 border border-slate-700 px-4 py-3">
                  <div className="grid flex-1 grid-cols-4 gap-3 items-center min-w-0">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 mb-0.5">Código</p>
                      <p className="font-mono text-sm font-bold text-cyan-400 truncate">{eq.codigo_interno}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 mb-0.5">Tipo</p>
                      <p className="text-sm text-slate-300 truncate">{eq.tipo}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 mb-0.5">Marca / Modelo</p>
                      <p className="text-sm font-semibold text-white truncate">{eq.marca} {eq.modelo}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 mb-0.5">Estado</p>
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ESTADO_COLORS[eq.estado] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                        {eq.estado}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-950 border-t border-slate-800 px-8 py-4 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Bodega: <span className="font-medium text-slate-300">{data.bodega.nombre}</span>
            </p>
            <p className="text-xs text-slate-600">{data.total} equipos en inventario</p>
          </div>
        </div>

        {/* Firmas (preview) */}
        <div className="mt-8 grid grid-cols-2 gap-6">
          {[
            { label: 'Quien entrega', name: data.bodega.responsable ?? '—' },
            { label: 'Quien recibe', name: '—' },
          ].map(({ label, name }) => (
            <div key={label} className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-8 text-center">
              <div className="mx-auto mb-4 h-14 w-full max-w-[160px] border-b border-slate-600" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">✍ {label}</p>
              <p className="mt-1.5 text-sm font-medium text-slate-200">{name}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Use "Iniciar Entrega" para completar el proceso con checklist y firma digital.
        </p>
      </main>
    </>
  );
}
