"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import { deleteEmpleado, isAuthenticated, listEmpleados, type EmpleadoRow } from '@/lib/api';

const PAGE_SIZE = 50;

export default function EmpleadosPage() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const canWrite = authLoading || hasPermission('empleados:write');
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    fetch_();
  }, [router]);

  async function fetch_(q?: string, p = 0) {
    setLoading(true); setError('');
    try {
      const r = await listEmpleados({ search: q ?? search, skip: p * PAGE_SIZE, limit: PAGE_SIZE });
      setEmpleados(r.items);
      setTotal(r.total);
      setPage(p);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }

  function goPage(p: number) {
    fetch_(undefined, p);
  }

  async function handleDelete(e: EmpleadoRow) {
    if (!window.confirm(`¿Eliminar a "${e.nombre_completo}"?`)) return;
    try {
      await deleteEmpleado(e.id);
      setEmpleados((prev) => prev.filter((x) => x.id !== e.id));
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Gestión</p>
            <h1 className="mt-1 text-3xl font-bold">Empleados</h1>
          </div>
          {canWrite ? (
            <Link href="/empleados/nuevo" className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400">
              + Nuevo empleado
            </Link>
          ) : null}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); fetch_(); }} className="mb-4 flex gap-2">
          <input
            className="flex-1"
            placeholder="Buscar por nombre o cédula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="px-4 py-2">Buscar</button>
          {search && (
            <button type="button" className="bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 px-3" onClick={() => { setSearch(''); fetch_(''); }}>✕</button>
          )}
        </form>

        {error && <p className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p>}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-950 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Cédula</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Sede</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-600 dark:text-slate-400">Cargando...</td></tr>
              ) : empleados.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-600 dark:text-slate-400">No hay empleados registrados.</td></tr>
              ) : empleados.map((emp) => (
                <tr key={emp.id} className="border-t border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium">{emp.nombre_completo}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{emp.cedula}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{emp.cargo ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{emp.sede ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {canWrite ? (
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/empleados/${emp.id}/editar`}
                          className="rounded-md bg-slate-200 px-3 py-1 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => handleDelete(emp)}
                          className="rounded-md bg-red-100 px-3 py-1 text-xs text-red-700 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                        >
                          Eliminar
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && empleados.length > 0 && (
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{total} empleado(s)</span>
            {total > PAGE_SIZE && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => goPage(page - 1)}
                  disabled={page === 0}
                  className="rounded-md bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  ← Anterior
                </button>
                <span>Página {page + 1} de {Math.ceil(total / PAGE_SIZE)}</span>
                <button
                  type="button"
                  onClick={() => goPage(page + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  className="rounded-md bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
