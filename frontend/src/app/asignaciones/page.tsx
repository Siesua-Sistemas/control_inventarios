"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { EquipoModal } from '@/components/equipo-modal';
import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import {
  devolver, entregarMultiple, isAuthenticated, listActas, trasladar,
  listAsignacionesActivas, listBodegas, listEmpleados, listEquipment,
  type AsignacionRow, type BodegaRow, type EmpleadoRow, type EquipmentRow,
} from '@/lib/api';

// ─── Helpers de ordenamiento ──────────────────────────────────────────────────

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es', { sensitivity: 'base' });
}

function SortableTh<T extends string>(props: {
  field: T; label: string; sortField: T; sortDir: 'asc' | 'desc';
  onSort: (field: T) => void; className?: string;
}) {
  const { field, label, sortField, sortDir, onSort, className = '' } = props;
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
        {label}
        <span className={sortField === field ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-600'}>
          {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    </th>
  );
}

type SortField = 'equipo' | 'empleado' | 'sede' | 'fecha';

function sortValue(a: AsignacionRow, field: SortField): string | number {
  switch (field) {
    case 'equipo': return `${a.equipment_codigo} ${a.equipment_marca} ${a.equipment_modelo}`;
    case 'empleado': return a.empleado_nombre ?? '';
    case 'sede': return a.equipment_sede ?? '';
    case 'fecha': return a.fecha;
  }
}

// ─── Panel de Nueva Entrega ───────────────────────────────────────────────────

function EntregarPanel({
  equiposDisponibles, empleados, bodegas, onSuccess, onClose,
}: {
  equiposDisponibles: EquipmentRow[];
  empleados: EmpleadoRow[];
  bodegas: BodegaRow[];
  onSuccess: (empId: number, eqIds: number[]) => void;
  onClose: () => void;
}) {
  const [cart, setCart] = useState<EquipmentRow[]>([]);
  const [eqSearch, setEqSearch] = useState('');
  const [empId, setEmpId] = useState('');
  const [bodegaOrigenId, setBodegaOrigenId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const cartIds = new Set(cart.map((e) => e.id));
  const sugeridos = equiposDisponibles.filter(
    (e) => !cartIds.has(e.id) && eqSearch.trim() && (
      e.codigo_interno.toLowerCase().includes(eqSearch.toLowerCase()) ||
      e.serial.toLowerCase().includes(eqSearch.toLowerCase()) ||
      e.marca.toLowerCase().includes(eqSearch.toLowerCase()) ||
      e.modelo.toLowerCase().includes(eqSearch.toLowerCase())
    )
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart.length) { setError('Agrega al menos un equipo.'); return; }
    if (!empId) { setError('Selecciona un empleado.'); return; }
    setError(''); setSubmitting(true);
    try {
      await entregarMultiple({
        equipment_ids: cart.map((eq) => eq.id),
        empleado_id: Number(empId),
        bodega_origen_id: bodegaOrigenId ? Number(bodegaOrigenId) : undefined,
      });
      onSuccess(Number(empId), cart.map((eq) => eq.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar');
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-indigo-300 bg-indigo-50 p-6 dark:border-indigo-900/50 dark:bg-slate-900">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold">Registrar entrega</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm">✕ Cancelar</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Búsqueda de equipos */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Equipos a entregar
          </label>
          <div className="relative">
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar por código, serial, marca..."
              value={eqSearch}
              onChange={(e) => setEqSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
              autoComplete="off"
            />
            {sugeridos.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 shadow-xl">
                {sugeridos.slice(0, 10).map((eq) => (
                  <li key={eq.id}>
                    <button type="button" onClick={() => { setCart((p) => [...p, eq]); setEqSearch(''); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                      <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400 w-20 shrink-0">{eq.codigo_interno}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{eq.marca} {eq.modelo}</span>
                      <span className="ml-auto text-xs text-slate-500 shrink-0">{eq.tipo}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {cart.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {cart.map((eq) => (
                <li key={eq.id} className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400 shrink-0">{eq.codigo_interno}</span>
                    <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{eq.marca} {eq.modelo}</span>
                    <span className="text-xs text-slate-500 shrink-0">{eq.tipo}</span>
                  </div>
                  <button type="button" onClick={() => setCart((p) => p.filter((x) => x.id !== eq.id))}
                    className="ml-3 shrink-0 text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400">✕</button>
                </li>
              ))}
            </ul>
          )}
          {!cart.length && !eqSearch && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-600">Escribe para buscar equipos disponibles.</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Empleado responsable *
            </label>
            <select value={empId} onChange={(e) => setEmpId(e.target.value)} required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">— Selecciona empleado —</option>
              {empleados.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.nombre_completo} · {emp.cedula}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Bodega origen
            </label>
            <select value={bodegaOrigenId} onChange={(e) => setBodegaOrigenId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">— Ninguna —</option>
              {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre} · {b.sede}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-300">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancelar</button>
          <button type="submit" disabled={submitting || !cart.length || !empId}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors">
            {submitting ? 'Registrando...' : `Registrar entrega${cart.length ? ` (${cart.length})` : ''}`}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Modal Devolver ───────────────────────────────────────────────────────────

function DevolverModal({
  asignacion, bodegas, onSuccess, onClose,
}: {
  asignacion: AsignacionRow;
  bodegas: BodegaRow[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [bodegaId, setBodegaId] = useState('');
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await devolver({
        equipment_id: asignacion.equipment_id,
        bodega_destino_id: bodegaId ? Number(bodegaId) : undefined,
        observaciones: obs || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-1 text-base font-semibold">Devolver equipo</h2>
        <p className="mb-5 text-sm text-slate-600 dark:text-slate-400">
          <span className="font-mono text-cyan-600 dark:text-cyan-400">{asignacion.equipment_codigo}</span>
          {' · '}{asignacion.equipment_marca} {asignacion.equipment_modelo}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Devolver a bodega
            </label>
            <select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">— Disponible (sin bodega) —</option>
              {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre} · {b.sede}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Observaciones
            </label>
            <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600" />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors">
              {loading ? 'Procesando...' : 'Confirmar devolución'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Trasladar ──────────────────────────────────────────────────────────

function TrasladarModal({
  equiposDisponibles, bodegas, onSuccess, onClose,
}: {
  equiposDisponibles: EquipmentRow[];
  bodegas: BodegaRow[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [eqId, setEqId] = useState('');
  const [bodegaId, setBodegaId] = useState('');
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eqId || !bodegaId) { setError('Selecciona equipo y bodega destino.'); return; }
    setLoading(true); setError('');
    try {
      await trasladar({ equipment_id: Number(eqId), bodega_destino_id: Number(bodegaId), observaciones: obs || undefined });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-5 text-base font-semibold">Trasladar equipo a bodega</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Equipo *</label>
            <select value={eqId} onChange={(e) => setEqId(e.target.value)} required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">— Selecciona equipo disponible —</option>
              {equiposDisponibles.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.codigo_interno} · {eq.marca} {eq.modelo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Bodega destino *</label>
            <select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)} required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">— Selecciona bodega —</option>
              {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre} · {b.sede}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Observaciones</label>
            <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600" />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 transition-colors">
              {loading ? 'Procesando...' : 'Confirmar traslado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function AsignacionesContent() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const canTrasladar = authLoading || hasPermission('asignaciones:trasladar');
  const canDevolverSinActa = authLoading || hasPermission('asignaciones:devolver_sin_acta');
  const canEntregar = authLoading || hasPermission('asignaciones:write');

  const [activas, setActivas] = useState<AsignacionRow[]>([]);
  const [equiposDisponibles, setEquiposDisponibles] = useState<EquipmentRow[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);
  const [bodegas, setBodegas] = useState<BodegaRow[]>([]);
  const [actasMap, setActasMap] = useState<Map<number, number>>(new Map());

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('fecha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showEntregarPanel, setShowEntregarPanel] = useState(false);
  const [showDevolverPanel, setShowDevolverPanel] = useState(false);
  const [showTrasladarModal, setShowTrasladarModal] = useState(false);
  const [devolverAsig, setDevolverAsig] = useState<AsignacionRow | null>(null);
  const [modalEquipoId, setModalEquipoId] = useState<number | null>(null);

  // Resultado de entrega exitosa
  const [exito, setExito] = useState<{ empId: number; eqIds: number[] } | null>(null);

  const reload = async () => {
    const [a, disp, bodega, actas] = await Promise.all([
      listAsignacionesActivas(),
      listEquipment({ estado: 'Disponible' }),
      listEquipment({ estado: 'En bodega' }),
      listActas({ tipo: 'asignacion', limit: 200 }),
    ]);
    setActivas(a.items);
    setEquiposDisponibles([...disp.items, ...bodega.items]);
    buildActasMap(actas.items);
  };

  const buildActasMap = (actas: { id: number; equipos_snapshot: { id: number }[] }[]) => {
    const map = new Map<number, number>();
    for (const acta of actas) {
      for (const eq of acta.equipos_snapshot) {
        map.set(eq.id, acta.id);
      }
    }
    setActasMap(map);
  };

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    Promise.all([
      listAsignacionesActivas().then((r) => setActivas(r.items)),
      Promise.all([listEquipment({ estado: 'Disponible' }), listEquipment({ estado: 'En bodega' })])
        .then(([d, b]) => setEquiposDisponibles([...d.items, ...b.items])),
      listEmpleados().then((r) => setEmpleados(r.items)),
      listBodegas().then((r) => setBodegas(r.items)),
      listActas({ tipo: 'asignacion', limit: 200 }).then((r) => buildActasMap(r.items)),
    ]).catch(() => null);
  }, [router]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filtered = (search.trim()
    ? activas.filter((a) => {
        const q = search.toLowerCase();
        return (
          a.equipment_codigo.toLowerCase().includes(q) ||
          a.equipment_serial.toLowerCase().includes(q) ||
          a.equipment_marca.toLowerCase().includes(q) ||
          a.equipment_modelo.toLowerCase().includes(q) ||
          (a.empleado_nombre ?? '').toLowerCase().includes(q) ||
          (a.empleado_cedula ?? '').toLowerCase().includes(q)
        );
      })
    : activas
  ).slice().sort((a, b) => {
    const cmp = compareValues(sortValue(a, sortField), sortValue(b, sortField));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleEntregaExitosa = async (empId: number, eqIds: number[]) => {
    setShowEntregarPanel(false);
    setExito({ empId, eqIds });
    await reload();
  };

  const handleDevolverExito = async () => {
    setDevolverAsig(null);
    await reload();
  };

  const handleTrasladarExito = async () => {
    setShowTrasladarModal(false);
    await reload();
  };

  return (
    <>
      <NavBar />

      {modalEquipoId && <EquipoModal equipoId={modalEquipoId} onClose={() => setModalEquipoId(null)} />}

      {/* Modales */}
      {devolverAsig && (
        <DevolverModal
          asignacion={devolverAsig}
          bodegas={bodegas}
          onSuccess={handleDevolverExito}
          onClose={() => setDevolverAsig(null)}
        />
      )}
      {showTrasladarModal && (
        <TrasladarModal
          equiposDisponibles={equiposDisponibles}
          bodegas={bodegas}
          onSuccess={handleTrasladarExito}
          onClose={() => setShowTrasladarModal(false)}
        />
      )}

      <main className="mx-auto max-w-6xl px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Asignaciones</h1>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{activas.length} equipo{activas.length !== 1 ? 's' : ''} actualmente asignado{activas.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canTrasladar ? (
              <button
                onClick={() => setShowTrasladarModal(true)}
                className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Trasladar →
              </button>
            ) : null}

            {canEntregar ? (
              <button
                onClick={() => { setShowEntregarPanel((v) => !v); setExito(null); }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                {showEntregarPanel ? '✕ Cancelar' : '+ Nueva entrega'}
              </button>
            ) : null}
          </div>
        </div>

        {/* Panel entrega inline */}
        {showEntregarPanel && (
          <EntregarPanel
            equiposDisponibles={equiposDisponibles}
            empleados={empleados}
            bodegas={bodegas}
            onSuccess={handleEntregaExitosa}
            onClose={() => setShowEntregarPanel(false)}
          />
        )}

        

        {/* Banner éxito post-entrega */}
        {exito && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 dark:border-emerald-800/50 dark:bg-emerald-500/10">
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">Entrega registrada</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{exito.eqIds.length} equipo{exito.eqIds.length !== 1 ? 's' : ''} asignado{exito.eqIds.length !== 1 ? 's' : ''} correctamente.</p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/asignaciones/entrega?emp=${exito.empId}&eqs=${exito.eqIds.join(',')}`}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                Generar acta con firma →
              </Link>
              <button onClick={() => setExito(null)} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                Descartar
              </button>
            </div>
          </div>
        )}

        {/* Búsqueda */}
        <div className="mb-4 flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, serial, empleado, marca..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder-slate-600"
          />
          {search && (
            <button onClick={() => setSearch('')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              ✕ Limpiar
            </button>
          )}
          {search && (
            <span className="text-xs text-slate-500">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Tabla principal */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <SortableTh field="equipo" label="Equipo" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh field="empleado" label="Empleado" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh field="sede" label="Sede" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                <SortableTh field="fecha" label="Fecha" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    {activas.length === 0
                      ? 'No hay equipos asignados actualmente.'
                      : 'Sin resultados para la búsqueda.'}
                  </td>
                </tr>
              ) : filtered.map((a) => (
                <tr key={a.id} className="border-t border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setModalEquipoId(a.equipment_id)}
                      className="font-mono text-xs font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline text-left"
                    >
                      {a.equipment_codigo}
                    </button>
                    <p className="text-sm text-slate-800 dark:text-slate-200">{a.equipment_marca} {a.equipment_modelo}</p>
                    <p className="text-xs text-slate-500">{a.equipment_tipo}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.empleado_nombre ?? '—'}</p>
                    {a.empleado_cedula && <p className="text-xs text-slate-500">{a.empleado_cedula}</p>}
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{a.equipment_sede}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(a.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5 items-end md:flex-row md:flex-wrap md:justify-end">
                      {canDevolverSinActa ? (
                        <button
                          onClick={() => setDevolverAsig(a)}
                          className="w-full md:w-auto rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20 transition-colors text-center"
                        >
                          Devolver
                        </button>
                      ) : null}
                      {canEntregar ? (
                        <Link
                          href={`/asignaciones/devolucion?eq=${a.equipment_id}`}
                          className="w-full md:w-auto rounded-md border border-lime-300 bg-lime-50 px-3 py-1.5 text-xs font-medium text-lime-700 hover:bg-lime-100 dark:border-lime-800/60 dark:bg-lime-900/20 dark:text-lime-400 dark:hover:bg-lime-900/40 transition-colors text-center"
                        >
                          Devolver con acta
                        </Link>
                      ) : null}
                      {actasMap.get(a.equipment_id) ? (
                        <Link
                          href={`/actas/${actasMap.get(a.equipment_id)}/imprimir`}
                          className="w-full md:w-auto rounded-md border border-lime-300 bg-lime-100 px-3 py-1.5 text-xs font-semibold text-lime-700 hover:bg-lime-200 dark:border-lime-800/60 dark:bg-lime-900/30 dark:text-lime-400 dark:hover:bg-lime-900/50 transition-colors text-center"
                        >
                          ✓ Ver acta firmada
                        </Link>
                      ) : canEntregar ? (
                        <Link
                          href={`/asignaciones/entrega?emp=${a.empleado_id}&eqs=${a.equipment_id}`}
                          className="w-full md:w-auto rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/60 dark:bg-indigo-600/20 dark:text-indigo-300 dark:hover:bg-indigo-600/40 transition-colors text-center"
                        >
                          Acta entrega
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {activas.length > 0 && (
          <p className="mt-2 text-right text-xs text-slate-500 dark:text-slate-600">
            {filtered.length} de {activas.length} asignación{activas.length !== 1 ? 'es' : ''}
          </p>
        )}
      </main>
    </>
  );
}

export default function AsignacionesPage() {
  return (
    <Suspense fallback={<><NavBar /><main className="flex min-h-screen items-center justify-center"><p className="text-slate-600 dark:text-slate-400">Cargando...</p></main></>}>
      <AsignacionesContent />
    </Suspense>
  );
}

