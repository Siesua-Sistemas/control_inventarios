"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { EquipoModal } from '@/components/equipo-modal';
import { EmpleadoAutocomplete } from '@/components/empleado-autocomplete';
import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import {
  devolver, entregarMultiple, isAuthenticated, listActas, trasladar,
  listAsignacionesActivas, listBodegas, listEquipment,
  type AsignacionRow, type BodegaRow, type EquipmentRow,
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

const PAGE_SIZE = 50;

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
  equiposDisponibles, bodegas, onSuccess, onClose, solo,
}: {
  equiposDisponibles: EquipmentRow[];
  bodegas: BodegaRow[];
  onSuccess: (empId: number, eqIds: number[], empNombre?: string) => void;
  onClose: () => void;
  solo?: 'sede' | 'personal';
}) {
  const [modo, setModo] = useState<'sede' | 'personal'>(solo ?? 'sede');
  const [cart, setCart] = useState<EquipmentRow[]>([]);
  const [eqSearch, setEqSearch] = useState('');
  const [sedeDestino, setSedeDestino] = useState('');
  const [empId, setEmpId] = useState<number | null>(null);
  const [empNombre, setEmpNombre] = useState('');
  const [bodegaOrigenId, setBodegaOrigenId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const sedes = useMemo(
    () => [...new Set(bodegas.map((b) => b.sede))].sort(),
    [bodegas]
  );

  useEffect(() => { setEmpId(null); setEmpNombre(''); }, [modo, sedeDestino]);

  // Auto-detect bodega origen from first cart item's sede
  useEffect(() => {
    if (cart.length === 0) { setBodegaOrigenId(''); return; }
    const sedeOrigen = cart[0].sede;
    const match = bodegas.find((b) => b.sede === sedeOrigen);
    if (match) setBodegaOrigenId(String(match.id));
  }, [cart, bodegas]);

  const cartIds = new Set(cart.map((e) => e.id));
  const sugeridos = equiposDisponibles.filter(
    (e) => !cartIds.has(e.id) && eqSearch.trim() && (
      e.codigo_interno.toLowerCase().includes(eqSearch.toLowerCase()) ||
      e.serial.toLowerCase().includes(eqSearch.toLowerCase()) ||
      e.marca.toLowerCase().includes(eqSearch.toLowerCase()) ||
      e.modelo.toLowerCase().includes(eqSearch.toLowerCase())
    )
  );

  const canSubmit = cart.length > 0 && (
    modo === 'personal' ? empId !== null : sedeDestino !== ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart.length) { setError('Agrega al menos un equipo.'); return; }
    if (modo === 'personal' && empId === null) { setError('Selecciona un empleado de la lista.'); return; }
    if (modo === 'sede' && !sedeDestino) { setError('Selecciona una sede destino.'); return; }
    setError(''); setSubmitting(true);
    try {
      await entregarMultiple({
        equipment_ids: cart.map((eq) => eq.id),
        empleado_id: empId ?? undefined,
        bodega_origen_id: bodegaOrigenId ? Number(bodegaOrigenId) : undefined,
        sede_destino: modo === 'sede' ? sedeDestino : undefined,
        responsable_nombre: !empId && empNombre.trim() ? empNombre.trim() : undefined,
      });
      onSuccess(empId ?? 0, cart.map((eq) => eq.id), !empId ? empNombre.trim() || undefined : undefined);
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
        {/* Tipo de entrega — solo cuando no hay modo fijo */}
        {!solo && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Tipo de entrega
            </label>
            <div className="flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 w-fit">
              <button type="button" onClick={() => setModo('sede')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${modo === 'sede' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                A sede
              </button>
              <button type="button" onClick={() => setModo('personal')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${modo === 'personal' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                Personal / Home office
              </button>
            </div>
          </div>
        )}

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

        {/* Sede destino (solo modo sede) */}
        {modo === 'sede' && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Sede destino *
            </label>
            <select
              value={sedeDestino}
              onChange={(e) => setSedeDestino(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">— Selecciona sede —</option>
              {sedes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {/* Empleado responsable */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <EmpleadoAutocomplete
              label={modo === 'sede' ? 'Responsable en sede destino' : 'Empleado responsable *'}
              value={empNombre}
              onChange={(v) => { setEmpNombre(v); if (v === '') setEmpId(null); }}
              onSelect={(emp) => setEmpId(emp.id)}
              placeholder="Nombre o buscar en la lista..."
            />
            {modo === 'sede' && empNombre.trim().length > 0 && empId === null && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">Nombre libre — o selecciona de la lista para vincularlo al sistema.</p>
            )}
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
          <button type="submit" disabled={submitting || !canSubmit}
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

// ─── Tabla compartida ─────────────────────────────────────────────────────────

function TablaAsignaciones({
  rows, actasMap, canDevolverSinActa, canEntregar, esModoSede,
  onDevolver, onClickEquipo,
}: {
  rows: AsignacionRow[];
  actasMap: Map<number, number>;
  canDevolverSinActa: boolean;
  canEntregar: boolean;
  esModoSede: boolean;
  onDevolver: (a: AsignacionRow) => void;
  onClickEquipo: (id: number) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 py-14 text-center text-slate-500">
        {esModoSede ? 'No hay traslados a sedes activos.' : 'No hay asignaciones personales activas.'}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Equipo</th>
            {esModoSede
              ? <th className="px-4 py-3">Sede destino</th>
              : <th className="px-4 py-3">Empleado</th>
            }
            <th className="px-4 py-3 hidden md:table-cell">Fecha</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-t border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/30 transition-colors">
              <td className="px-4 py-3">
                <button onClick={() => onClickEquipo(a.equipment_id)}
                  className="font-mono text-xs font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline text-left">
                  {a.equipment_codigo}
                </button>
                <p className="text-sm text-slate-800 dark:text-slate-200">{a.equipment_marca} {a.equipment_modelo}</p>
                <p className="text-xs text-slate-500">{a.equipment_tipo}</p>
              </td>
              {esModoSede ? (
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.equipment_sede}</p>
                  {a.observaciones?.startsWith('Responsable:') && (
                    <p className="text-xs text-slate-500">{a.observaciones.replace('Responsable: ', '')}</p>
                  )}
                </td>
              ) : (
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.empleado_nombre ?? '—'}</p>
                  {a.empleado_cedula && <p className="text-xs text-slate-500">{a.empleado_cedula}</p>}
                  <p className="text-xs text-slate-400 dark:text-slate-500">{a.equipment_sede}</p>
                </td>
              )}
              <td className="hidden md:table-cell px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                {new Date(a.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1.5 items-end md:flex-row md:flex-wrap md:justify-end">
                  {canDevolverSinActa && (
                    <button onClick={() => onDevolver(a)}
                      className="w-full md:w-auto rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20 transition-colors text-center">
                      Devolver
                    </button>
                  )}
                  {canEntregar && (
                    <Link href={`/asignaciones/devolucion?eq=${a.equipment_id}`}
                      className="w-full md:w-auto rounded-md border border-lime-300 bg-lime-50 px-3 py-1.5 text-xs font-medium text-lime-700 hover:bg-lime-100 dark:border-lime-800/60 dark:bg-lime-900/20 dark:text-lime-400 dark:hover:bg-lime-900/40 transition-colors text-center">
                      Devolver con acta
                    </Link>
                  )}
                  {actasMap.get(a.equipment_id) ? (
                    <Link href={`/actas/${actasMap.get(a.equipment_id)}/imprimir`}
                      className="w-full md:w-auto rounded-md border border-lime-300 bg-lime-100 px-3 py-1.5 text-xs font-semibold text-lime-700 hover:bg-lime-200 dark:border-lime-800/60 dark:bg-lime-900/30 dark:text-lime-400 dark:hover:bg-lime-900/50 transition-colors text-center">
                      ✓ Ver acta
                    </Link>
                  ) : canEntregar ? (
                    <Link href={`/asignaciones/entrega?${a.empleado_id ? `emp=${a.empleado_id}&` : ''}eqs=${a.equipment_id}`}
                      className="w-full md:w-auto rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/60 dark:bg-indigo-600/20 dark:text-indigo-300 dark:hover:bg-indigo-600/40 transition-colors text-center">
                      Generar acta
                    </Link>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function AsignacionesContent() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const canTrasladar = authLoading || hasPermission('asignaciones:trasladar');
  const canDevolverSinActa = authLoading || hasPermission('asignaciones:devolver_sin_acta');
  const canEntregar = authLoading || hasPermission('asignaciones:write') || hasPermission('asignaciones:entregar');

  const [tab, setTab] = useState<'traslados' | 'asignaciones'>('traslados');
  const [activas, setActivas] = useState<AsignacionRow[]>([]);
  const [equiposDisponibles, setEquiposDisponibles] = useState<EquipmentRow[]>([]);
  const [bodegas, setBodegas] = useState<BodegaRow[]>([]);
  const [actasMap, setActasMap] = useState<Map<number, number>>(new Map());

  const [showPanelTraslado, setShowPanelTraslado] = useState(false);
  const [showPanelAsignacion, setShowPanelAsignacion] = useState(false);
  const [showTrasladarModal, setShowTrasladarModal] = useState(false);
  const [devolverAsig, setDevolverAsig] = useState<AsignacionRow | null>(null);
  const [modalEquipoId, setModalEquipoId] = useState<number | null>(null);
  const [exito, setExito] = useState<{ empId: number; eqIds: number[]; empNombre?: string } | null>(null);

  const traslados = activas.filter((a) => !a.empleado_id);
  const personales = activas.filter((a) => !!a.empleado_id);

  const buildActasMap = (actas: { id: number; equipos_snapshot: { id: number }[] }[]) => {
    const map = new Map<number, number>();
    for (const acta of actas) {
      for (const eq of acta.equipos_snapshot) map.set(eq.id, acta.id);
    }
    setActasMap(map);
  };

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

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    Promise.all([
      listAsignacionesActivas().then((r) => setActivas(r.items)),
      Promise.all([listEquipment({ estado: 'Disponible' }), listEquipment({ estado: 'En bodega' })])
        .then(([d, b]) => setEquiposDisponibles([...d.items, ...b.items])),
      listBodegas().then((r) => setBodegas(r.items)),
      listActas({ tipo: 'asignacion', limit: 200 }).then((r) => buildActasMap(r.items)),
    ]).catch(() => null);
  }, [router]);

  const handleEntregaExitosa = async (empId: number, eqIds: number[], empNombre?: string) => {
    setShowPanelTraslado(false);
    setShowPanelAsignacion(false);
    setExito({ empId, eqIds, empNombre });
    await reload();
  };

  const handleDevolverExito = async () => { setDevolverAsig(null); await reload(); };
  const handleTrasladarExito = async () => { setShowTrasladarModal(false); await reload(); };

  const TABS = [
    { id: 'traslados' as const, label: `Traslados (${traslados.length})` },
    { id: 'asignaciones' as const, label: `Asignaciones (${personales.length})` },
  ];

  return (
    <>
      <NavBar />
      {modalEquipoId && <EquipoModal equipoId={modalEquipoId} onClose={() => setModalEquipoId(null)} />}
      {devolverAsig && (
        <DevolverModal asignacion={devolverAsig} bodegas={bodegas} onSuccess={handleDevolverExito} onClose={() => setDevolverAsig(null)} />
      )}
      {showTrasladarModal && (
        <TrasladarModal equiposDisponibles={equiposDisponibles} bodegas={bodegas} onSuccess={handleTrasladarExito} onClose={() => setShowTrasladarModal(false)} />
      )}

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Asignaciones</h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            {activas.length} equipo{activas.length !== 1 ? 's' : ''} actualmente asignado{activas.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit dark:border-slate-800 dark:bg-slate-900">
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => { setTab(id); setExito(null); }}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ─── Tab Traslados ─── */}
        {tab === 'traslados' && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {canTrasladar && (
                <button onClick={() => setShowTrasladarModal(true)}
                  className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
                  Mover entre bodegas →
                </button>
              )}
              {canEntregar && (
                <button onClick={() => { setShowPanelTraslado((v) => !v); setExito(null); }}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors">
                  {showPanelTraslado ? '✕ Cancelar' : '+ Registrar traslado a sede'}
                </button>
              )}
            </div>

            {showPanelTraslado && (
              <EntregarPanel
                equiposDisponibles={equiposDisponibles}
                bodegas={bodegas}
                solo="sede"
                onSuccess={handleEntregaExitosa}
                onClose={() => setShowPanelTraslado(false)}
              />
            )}

            {exito && tab === 'traslados' && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 dark:border-emerald-800/50 dark:bg-emerald-500/10">
                <div>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300">Traslado registrado</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{exito.eqIds.length} equipo{exito.eqIds.length !== 1 ? 's' : ''} trasladado{exito.eqIds.length !== 1 ? 's' : ''} correctamente.</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/asignaciones/entrega?${exito.empId > 0 ? `emp=${exito.empId}&` : exito.empNombre ? `nombre=${encodeURIComponent(exito.empNombre)}&` : ''}eqs=${exito.eqIds.join(',')}`}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors">
                    Generar acta con firma →
                  </Link>
                  <button onClick={() => setExito(null)} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Descartar</button>
                </div>
              </div>
            )}

            <TablaAsignaciones
              rows={traslados}
              actasMap={actasMap}
              canDevolverSinActa={canDevolverSinActa}
              canEntregar={canEntregar}
              esModoSede={true}
              onDevolver={setDevolverAsig}
              onClickEquipo={setModalEquipoId}
            />
          </>
        )}

        {/* ─── Tab Asignaciones personales ─── */}
        {tab === 'asignaciones' && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {canEntregar && (
                <button onClick={() => { setShowPanelAsignacion((v) => !v); setExito(null); }}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors">
                  {showPanelAsignacion ? '✕ Cancelar' : '+ Nueva asignación personal'}
                </button>
              )}
            </div>

            {showPanelAsignacion && (
              <EntregarPanel
                equiposDisponibles={equiposDisponibles}
                bodegas={bodegas}
                solo="personal"
                onSuccess={handleEntregaExitosa}
                onClose={() => setShowPanelAsignacion(false)}
              />
            )}

            {exito && tab === 'asignaciones' && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 dark:border-emerald-800/50 dark:bg-emerald-500/10">
                <div>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300">Asignación registrada</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{exito.eqIds.length} equipo{exito.eqIds.length !== 1 ? 's' : ''} asignado{exito.eqIds.length !== 1 ? 's' : ''} correctamente.</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/asignaciones/entrega?${exito.empId > 0 ? `emp=${exito.empId}&` : exito.empNombre ? `nombre=${encodeURIComponent(exito.empNombre)}&` : ''}eqs=${exito.eqIds.join(',')}`}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors">
                    Generar acta con firma →
                  </Link>
                  <button onClick={() => setExito(null)} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Descartar</button>
                </div>
              </div>
            )}

            <TablaAsignaciones
              rows={personales}
              actasMap={actasMap}
              canDevolverSinActa={canDevolverSinActa}
              canEntregar={canEntregar}
              esModoSede={false}
              onDevolver={setDevolverAsig}
              onClickEquipo={setModalEquipoId}
            />
          </>
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

