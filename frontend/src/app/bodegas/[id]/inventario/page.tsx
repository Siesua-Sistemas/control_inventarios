"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { EquipoModal } from '@/components/equipo-modal';
import { NavBar } from '@/components/nav-bar';
import { getBodegaInventario, isAuthenticated, listActas, type ActaEntregaRow, type BodegaInventario } from '@/lib/api';
import { ESTADO_COLORS } from '@/lib/constants';

export default function InventarioBodegaPage() {
  const router = useRouter();
  const { id } = useParams();
  const [data, setData] = useState<BodegaInventario | null>(null);
  const [ultimaActa, setUltimaActa] = useState<ActaEntregaRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalEquipoId, setModalEquipoId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    Promise.all([
      getBodegaInventario(Number(id)),
      listActas({ bodega_id: Number(id), limit: 1 }),
    ])
      .then(([inv, actas]) => {
        setData(inv);
        setUltimaActa(actas.items[0] ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <><NavBar /><main className="flex min-h-screen items-center justify-center"><p className="text-slate-400">Cargando...</p></main></>;
  if (!data) return <><NavBar /><main className="flex min-h-screen items-center justify-center"><p className="text-red-300">{error}</p></main></>;

  return (
    <>
      <NavBar />
      {modalEquipoId && <EquipoModal equipoId={modalEquipoId} onClose={() => setModalEquipoId(null)} />}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/bodegas" className="hover:text-cyan-400">Bodegas</Link>
          <span>/</span>
          <span className="text-slate-300">{data.bodega.nombre}</span>
        </div>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{data.bodega.nombre}</h1>
            <p className="mt-1 text-slate-400">{data.bodega.sede}{data.bodega.responsable ? ` · ${data.bodega.responsable}` : ''}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/bodegas/${id}/inventario/entrega`}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              Iniciar Entrega →
            </Link>
            <Link
              href={`/bodegas/${id}/inventario/paz-y-salvo`}
              className="flex items-center gap-2 rounded-lg border border-lime-800/60 bg-lime-900/20 px-4 py-2 text-sm font-medium text-lime-400 hover:bg-lime-900/40 transition-colors"
            >
              Paz y Salvo
            </Link>
            <Link
              href={ultimaActa ? `/actas/${ultimaActa.id}/imprimir` : `/bodegas/${id}/inventario/acta`}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
            >
              {ultimaActa ? 'Última acta →' : 'Ver Acta'}
            </Link>
            <span className="rounded-2xl bg-cyan-500/10 px-5 py-2 text-2xl font-bold text-cyan-400">{data.total}</span>
          </div>
        </div>

        {/* Summary pills */}
        <div className="mb-6 flex flex-wrap gap-2">
          {Object.entries(data.por_tipo).map(([tipo, count]) => (
            <span key={tipo} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{tipo}: {count}</span>
          ))}
        </div>

        {/* Equipment table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="hidden sm:table-cell px-4 py-3">Serial</th>
                <th className="hidden sm:table-cell px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Marca / Modelo</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.equipos.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Bodega vacía.</td></tr>
              ) : data.equipos.map((e) => (
                <tr key={e.id} className="border-t border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs">
                    <button
                      onClick={() => setModalEquipoId(e.id)}
                      className="text-cyan-400 hover:text-cyan-300 hover:underline text-left"
                    >
                      {e.codigo_interno}
                    </button>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 font-mono text-xs">{e.serial}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-slate-300">{e.tipo}</td>
                  <td className="px-4 py-3"><span className="font-medium">{e.marca}</span> <span className="text-slate-400">{e.modelo}</span></td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLORS[e.estado] ?? 'bg-slate-700 text-slate-300'}`}>{e.estado}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
