"use client";

import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { EquipoModal } from '@/components/equipo-modal';
import {
  exportHistorialCsv,
  listHistorial,
  type AsignacionRow,
} from '@/lib/api';
import { compareValues, SortableTh } from '@/lib/sort-utils';

const TIPO_BADGE: Record<string, string> = {
  'Entrega': 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
  'Devolución': 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
  'Traslado': 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30',
};

type MovSortField = 'fecha' | 'tipo' | 'equipo' | 'destino' | 'estado' | 'registrado';

function movSortValue(m: AsignacionRow, field: MovSortField): string | number {
  switch (field) {
    case 'fecha': return m.fecha;
    case 'tipo': return m.tipo;
    case 'equipo': return `${m.equipment_codigo} ${m.equipment_marca} ${m.equipment_modelo}`;
    case 'destino': return m.empleado_nombre ?? m.bodega_destino_nombre ?? '';
    case 'estado': return m.estado_despues;
    case 'registrado': return m.created_by_nombre;
  }
}

export function MovimientosTab({ equipmentId }: { equipmentId?: number } = {}) {
  const { loading: authLoading, hasPermission } = useAuth();
  const canExport = authLoading || hasPermission('reports:export');
  const [items, setItems] = useState<AsignacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [modalEquipoId, setModalEquipoId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');
  const [sortField, setSortField] = useState<MovSortField>('fecha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [exporting, setExporting] = useState(false);
  const PAGE_SIZE = 50;

  const toggleSort = (field: MovSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const load = async (tipo = filterTipo, desde = filterDesde, hasta = filterHasta, p = page) => {
    setLoading(true);
    try {
      const r = await listHistorial({
        equipment_id: equipmentId,
        tipo: tipo || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
        skip: p * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setItems(r.items);
      setTotal(r.total);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [equipmentId]);

  const handleFilter = (e: React.FormEvent) => { e.preventDefault(); setPage(0); load(filterTipo, filterDesde, filterHasta, 0); };
  const clearFilters = () => { setFilterTipo(''); setFilterDesde(''); setFilterHasta(''); setPage(0); load('', '', '', 0); };
  const goPage = (p: number) => { setPage(p); load(filterTipo, filterDesde, filterHasta, p); };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await exportHistorialCsv({
        equipment_id: equipmentId,
        tipo: filterTipo || undefined,
        desde: filterDesde || undefined,
        hasta: filterHasta || undefined,
      });
    } finally { setExporting(false); }
  };

  return (
    <div>
      {modalEquipoId && <EquipoModal equipoId={modalEquipoId} onClose={() => setModalEquipoId(null)} />}

      {/* Filtros */}
      <form onSubmit={handleFilter} className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Tipo</label>
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="">Todos</option>
            <option>Entrega</option>
            <option>Devolución</option>
            <option>Traslado</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Desde</label>
          <input type="date" value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Hasta</label>
          <input type="date" value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
        </div>
        <button type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors">
          Filtrar
        </button>
        {(filterTipo || filterDesde || filterHasta) && (
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
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 dark:bg-slate-950 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
            <tr>
              <SortableTh field="fecha" label="Fecha" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh field="tipo" label="Tipo" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              {!equipmentId && <SortableTh field="equipo" label="Equipo" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />}
              <SortableTh field="destino" label="Empleado / Destino" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh field="estado" label="Estado" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh field="registrado" label="Registrado por" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={equipmentId ? 5 : 6} className="py-12 text-center text-slate-500">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
              </td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={equipmentId ? 5 : 6} className="py-12 text-center text-slate-500">Sin movimientos.</td></tr>
            ) : [...items].sort((a, b) => {
                const cmp = compareValues(movSortValue(a, sortField), movSortValue(b, sortField));
                return sortDir === 'asc' ? cmp : -cmp;
              }).map((m) => (
              <tr key={m.id} className="border-t border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {new Date(m.fecha).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TIPO_BADGE[m.tipo] ?? 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
                    {m.tipo}
                  </span>
                </td>
                {!equipmentId && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setModalEquipoId(m.equipment_id)}
                      className="font-mono text-xs font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline text-left"
                    >
                      {m.equipment_codigo}
                    </button>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{m.equipment_marca} {m.equipment_modelo}</p>
                    <p className="text-xs text-slate-500">{m.equipment_tipo}</p>
                  </td>
                )}
                <td className="px-4 py-3 text-sm">
                  {m.tipo === 'Devolución' || m.tipo === 'Traslado' ? (
                    m.bodega_destino_nombre ? (
                      <>
                        <p className="text-xs text-slate-400 dark:text-slate-500">→ Bodega</p>
                        <p className="text-slate-700 dark:text-slate-300">{m.bodega_destino_nombre}</p>
                      </>
                    ) : m.tipo === 'Devolución' ? (
                      <span className="text-slate-500 dark:text-slate-400 italic text-xs">→ Disponible</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600">—</span>
                    )
                  ) : m.empleado_nombre ? (
                    <>
                      <p className="text-slate-700 dark:text-slate-300">{m.empleado_nombre}</p>
                      {m.empleado_cedula && <p className="text-xs text-slate-500">{m.empleado_cedula}</p>}
                    </>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                  {m.estado_antes && <span className="text-slate-500 dark:text-slate-600">{m.estado_antes} → </span>}
                  <span className="text-slate-700 dark:text-slate-300">{m.estado_despues}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{m.created_by_nombre}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {!loading && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>{total} movimiento{total !== 1 ? 's' : ''} en total</span>
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
