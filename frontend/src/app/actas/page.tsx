"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { isAuthenticated, listActas, type ActaEntregaRow } from '@/lib/api';

const TIPO_STYLES: Record<string, string> = {
  bodega: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30',
  asignacion: 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30',
};

const TIPO_LABEL: Record<string, string> = {
  bodega: 'Bodega',
  asignacion: 'Sede',
};

export default function ActasHistorialPage() {
  const router = useRouter();
  const [actas, setActas] = useState<ActaEntregaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [tipo, setTipo] = useState('');
  const [sede, setSede] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const load = (t = tipo, s = sede, d = desde, h = hasta) => {
    setLoading(true);
    listActas({ tipo: t || undefined, sede: s || undefined, desde: d || undefined, hasta: h || undefined })
      .then((res) => { setActas(res.items); setTotal(res.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    load();
  }, [router]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const clearFilters = () => {
    setTipo(''); setSede(''); setDesde(''); setHasta('');
    load('', '', '', '');
  };

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Historial de Actas</h1>
            <p className="mt-1 text-slate-600 dark:text-slate-400">Registro de todas las entregas formalizadas</p>
          </div>
          <span className="rounded-2xl bg-indigo-100 px-5 py-2 text-2xl font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">{total}</span>
        </div>

        {/* Filtros */}
        <form onSubmit={handleFilter} className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Todos</option>
              <option value="bodega">Sedes</option>
              <option value="asignacion">Asignación</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">

            <label className="text-xs text-slate-500">Sede</label>
            <input
              value={sede}
              onChange={(e) => setSede(e.target.value)}
              placeholder="Filtrar por sede"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            Filtrar
          </button>
          {(tipo || sede || desde || hasta) && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              Limpiar
            </button>
          )}
        </form>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
          </div>
        ) : actas.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 py-16 text-center">
            <p className="text-slate-600 dark:text-slate-400">No hay actas registradas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 dark:bg-slate-950 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Sede / Título</th>
                  <th className="px-4 py-3">Entrega</th>
                  <th className="px-4 py-3">Recibe</th>
                  <th className="px-4 py-3 text-center">Equipos</th>
                  <th className="px-4 py-3 text-center">Firmas</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {actas.map((acta) => (
                  <tr key={acta.id} className="border-t border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {new Date(acta.fecha).toLocaleDateString('es-CO', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TIPO_STYLES[acta.tipo] ?? 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
                        {TIPO_LABEL[acta.tipo] ?? acta.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-white">{acta.titulo}</p>
                      <p className="text-xs text-slate-500">{acta.sede}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{acta.entrega_nombre}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{acta.recibe_nombre}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 text-xs">
                        {acta.total_equipos}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {acta.firma_entrega && acta.firma_recibe
                        ? <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">✓ Completas</span>
                        : acta.firma_entrega || acta.firma_recibe
                        ? <span className="text-yellow-600 dark:text-yellow-400 text-xs">Parcial</span>
                        : <span className="text-slate-500 dark:text-slate-600 text-xs">Sin firma</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/actas/${acta.id}/imprimir`}
                        className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                      >
                        🖨 Imprimir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
