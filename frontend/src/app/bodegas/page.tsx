"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import { deleteBodega, isAuthenticated, listBodegas, type BodegaRow } from '@/lib/api';

export default function BodegasPage() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const canWrite = authLoading || hasPermission('bodegas:write');
  const canDelete = authLoading || hasPermission('bodegas:delete');
  const [bodegas, setBodegas] = useState<BodegaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    listBodegas()
      .then((r) => setBodegas(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleDelete(b: BodegaRow) {
    if (!window.confirm(`¿Eliminar la bodega "${b.nombre}"?`)) return;
    try {
      await deleteBodega(b.id);
      setBodegas((prev) => prev.filter((x) => x.id !== b.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Inventario</p>
            <h1 className="mt-1 text-3xl font-bold">Bodegas</h1>
          </div>
          {canWrite ? (
            <Link href="/bodegas/nuevo" className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400">
              + Nueva bodega
            </Link>
          ) : null}
        </div>

        {error && <p className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <p className="col-span-3 py-10 text-center text-slate-600 dark:text-slate-400">Cargando bodegas...</p>
          ) : bodegas.length === 0 ? (
            <p className="col-span-3 py-10 text-center text-slate-600 dark:text-slate-400">No hay bodegas registradas.</p>
          ) : (
            bodegas.map((b) => (
              <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{b.nombre}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{b.sede}</p>
                  </div>
                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-bold text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400">
                    {b.total_equipos}
                  </span>
                </div>
                {b.responsable && <p className="mb-1 text-xs text-slate-500">Responsable: {b.responsable}</p>}
                {b.descripcion && <p className="mb-3 text-xs text-slate-500">{b.descripcion}</p>}
                <div className="flex gap-2">
                  <Link
                    href={`/bodegas/${b.id}/inventario`}
                    className="flex-1 rounded-md bg-slate-200 py-1.5 text-center text-xs font-medium text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Ver inventario
                  </Link>
                  {canDelete ? (
                    <button
                      onClick={() => handleDelete(b)}
                      className="rounded-md bg-red-100 px-3 py-1.5 text-xs text-red-700 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                    >
                      Eliminar
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}
