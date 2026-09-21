"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import { MovimientosTab } from '@/components/movimientos-tab';
import {
  exportActasCsv,
  isAuthenticated,
  listActas,
  type ActaEntregaRow,
} from '@/lib/api';
import { compareValues, SortableTh } from '@/lib/sort-utils';

// ─── Pestaña: Actas firmadas ──────────────────────────────────────────────────

const ACTA_TIPO_STYLE: Record<string, string> = {
  bodega: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30',
  asignacion: 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30',
  salida: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30',
};
const ACTA_TIPO_LABEL: Record<string, string> = { bodega: 'Bodega', asignacion: 'Asignación', salida: 'Salida' };

type ActaSortField = 'fecha' | 'tipo' | 'sede' | 'entrega' | 'recibe' | 'dispositivos' | 'firmas';

function actaSortValue(acta: ActaEntregaRow, field: ActaSortField): string | number {
  switch (field) {
    case 'fecha': return acta.fecha;
    case 'tipo': return ACTA_TIPO_LABEL[acta.tipo] ?? acta.tipo;
    case 'sede': return `${acta.titulo} ${acta.sede}`;
    case 'entrega': return acta.entrega_nombre;
    case 'recibe': return acta.recibe_nombre;
    case 'dispositivos': return acta.total_equipos;
    case 'firmas': return acta.firma_entrega && acta.firma_recibe ? 2 : acta.firma_entrega || acta.firma_recibe ? 1 : 0;
  }
}

function ActasTab() {
  const { loading: authLoading, hasPermission } = useAuth();
  const canExport = authLoading || hasPermission('reports:export');
  const [actas, setActas] = useState<ActaEntregaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState('');
  const [sede, setSede] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [sortField, setSortField] = useState<ActaSortField>('fecha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const PAGE_SIZE = 50;

  const toggleSort = (field: ActaSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const load = async (t = tipo, s = sede, d = desde, h = hasta, p = page) => {
    setLoading(true);
    try {
      const r = await listActas({ tipo: t || undefined, sede: s || undefined, desde: d || undefined, hasta: h || undefined, skip: p * PAGE_SIZE, limit: PAGE_SIZE });
      setActas(r.items); setTotal(r.total);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleFilter = (e: React.FormEvent) => { e.preventDefault(); setPage(0); load(tipo, sede, desde, hasta, 0); };
  const clearFilters = () => { setTipo(''); setSede(''); setDesde(''); setHasta(''); setPage(0); load('', '', '', '', 0); };
  const goPage = (p: number) => { setPage(p); load(tipo, sede, desde, hasta, p); };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await exportActasCsv({
        tipo: tipo || undefined,
        sede: sede || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
      });
    } finally { setExporting(false); }
  };

  return (
    <div>
      {/* Filtros */}
      <form onSubmit={handleFilter} className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="">Todos</option>
            <option value="bodega">Sedes</option>
            <option value="asignacion">Asignación</option>
            <option value="salida">Salida</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Sede</label>
          <input value={sede} onChange={(e) => setSede(e.target.value)} placeholder="Filtrar sede"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
        </div>
        <button type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors">
          Filtrar
        </button>
        {(tipo || sede || desde || hasta) && (
          <button type="button" onClick={clearFilters}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
            Limpiar
          </button>
        )}
        {canExport && (
          <button type="button" onClick={handleExportCsv} disabled={exporting}
            className="ml-auto rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
            {exporting ? 'Descargando...' : 'Descargar CSV'}
          </button>
        )}
      </form>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
        </div>
      ) : actas.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 py-16 text-center">
          <p className="text-slate-500">No hay actas de entrega registradas.</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-600">Las actas se generan al completar el flujo de entrega con firma.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-950 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <tr>
                <SortableTh field="fecha" label="Fecha" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh field="tipo" label="Tipo" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh field="sede" label="Sede" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh field="entrega" label="Entrega" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh field="recibe" label="Recibe" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh field="dispositivos" label="Dispositivos" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="text-center" />
                <SortableTh field="firmas" label="Firmas" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="text-center" />
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {[...actas].sort((a, b) => {
                const cmp = compareValues(actaSortValue(a, sortField), actaSortValue(b, sortField));
                return sortDir === 'asc' ? cmp : -cmp;
              }).map((acta) => (
                <tr key={acta.id} className="border-t border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {new Date(acta.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ACTA_TIPO_STYLE[acta.tipo] ?? 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
                      {ACTA_TIPO_LABEL[acta.tipo] ?? acta.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{acta.titulo}</p>
                    <p className="text-xs text-slate-500">{acta.sede}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{acta.entrega_nombre}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{acta.recibe_nombre}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-0.5 text-xs">
                      {acta.total_equipos}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {acta.firma_entrega && acta.firma_recibe
                      ? <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Completas</span>
                      : acta.firma_entrega || acta.firma_recibe
                      ? <span className="text-xs text-yellow-600 dark:text-yellow-400">Parcial</span>
                      : <span className="text-xs text-slate-500 dark:text-slate-600">Sin firma</span>}
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

      {!loading && total > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-600">
          <span>{total} acta{total !== 1 ? 's' : ''} en total</span>
          {total > PAGE_SIZE && (
            <div className="flex items-center gap-2">
              <button onClick={() => goPage(page - 1)} disabled={page === 0}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors">
                ← Anterior
              </button>
              <span>Página {page + 1} de {Math.ceil(total / PAGE_SIZE)}</span>
              <button onClick={() => goPage(page + 1)} disabled={(page + 1) * PAGE_SIZE >= total}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors">
                Siguiente →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pestaña: Pendientes de firma ────────────────────────────────────────────

function PendientesTab() {
  const [actas, setActas] = useState<ActaEntregaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listActas({ limit: 500 })
      .then((r) => setActas(r.items.filter((a) => !a.firma_entrega || !a.firma_recibe)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500 dark:border-slate-700 dark:border-t-amber-400" />
    </div>
  );

  if (actas.length === 0) return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 py-16 text-center">
      <p className="text-2xl mb-2">✅</p>
      <p className="text-slate-600 dark:text-slate-400">No hay actas pendientes de firma.</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-600">Todas las actas registradas tienen firmas completas.</p>
    </div>
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 dark:bg-slate-950 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Sede / Título</th>
            <th className="px-4 py-3">Entrega</th>
            <th className="px-4 py-3">Recibe</th>
            <th className="px-4 py-3 text-center">Firmas</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {actas.map((acta) => {
            const faltaEntrega = !acta.firma_entrega;
            const faltaRecibe = !acta.firma_recibe;
            return (
              <tr key={acta.id} className="border-t border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {new Date(acta.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800 dark:text-slate-200">{acta.titulo}</p>
                  <p className="text-xs text-slate-500">{acta.sede}</p>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{acta.entrega_nombre}</td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{acta.recibe_nombre}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col gap-0.5 items-center text-xs">
                    {faltaEntrega && <span className="text-amber-600 dark:text-amber-400">⚠ Falta firma entrega</span>}
                    {faltaRecibe && <span className="text-amber-600 dark:text-amber-400">⚠ Falta firma recibe</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/actas/${acta.id}/imprimir`}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 transition-colors whitespace-nowrap">
                    Completar firma →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-5 py-3 text-xs text-slate-500 dark:text-slate-600 border-t border-slate-200 dark:border-slate-800">
        {actas.length} acta{actas.length !== 1 ? 's' : ''} pendiente{actas.length !== 1 ? 's' : ''} de firma
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function HistorialPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'movimientos' | 'actas' | 'pendientes'>('movimientos');

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login');
  }, [router]);

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Historial</h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">Registro completo de movimientos y actas de entrega</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit dark:border-slate-800 dark:bg-slate-900">
          {[
            { id: 'movimientos' as const, label: 'Movimientos' },
            { id: 'actas' as const, label: 'Actas firmadas' },
            { id: 'pendientes' as const, label: 'Pendientes de firma' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'movimientos' && <MovimientosTab />}
        {tab === 'actas' && <ActasTab />}
        {tab === 'pendientes' && <PendientesTab />}
      </main>
    </>
  );
}
