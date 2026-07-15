"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { DatePickerPresets } from '@/components/date-picker-presets';
import { EquipoModal } from '@/components/equipo-modal';
import { MantenimientoModal } from '@/components/mantenimiento-modal';
import { NavBar } from '@/components/nav-bar';
import { PhotoGrid } from '@/components/photo-grid';
import { MantenimientosSubNav } from '@/app/mantenimientos/_components/mantenimientos-subnav';
import {
  createMantenimiento,
  deleteMantenimientoPhoto,
  isAuthenticated,
  listEquipment,
  listEquiposProximosPreventivos,
  listMantenimientoConfig,
  listMantenimientos,
  listUsersBasic,
  uploadMantenimientoPhoto,
  type EquipmentProximoPreventivoRow,
  type EquipmentRow,
  type MantenimientoPayload,
  type MantenimientoRow,
  type UserBasic,
} from '@/lib/api';
import { compareValues, SortableTh } from '@/lib/sort-utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const PAGE_SIZE = 50;

type SortField = 'fecha' | 'equipo' | 'tipo_equipo' | 'sede' | 'tipo' | 'tecnico' | 'costo' | 'proximo';
type EstadoVencimientoFilter = '' | 'vencido' | 'proximo' | 'al_dia';
type TabView = 'registros' | 'sin_mantenimiento';

function sortValue(m: MantenimientoRow, field: SortField): string | number {
  switch (field) {
    case 'fecha': return m.fecha;
    case 'equipo': return `${m.equipment_codigo} ${m.equipment_marca} ${m.equipment_modelo}`;
    case 'tipo_equipo': return m.equipment_tipo;
    case 'sede': return m.equipment_sede;
    case 'tipo': return m.tipo;
    case 'tecnico': return m.tecnico ?? '';
    case 'costo': return m.costo ? Number(m.costo) : 0;
    case 'proximo': return m.proximo_mantenimiento ?? '';
  }
}

function proximoClass(proximo: string | null): string {
  if (!proximo) return 'text-slate-700 dark:text-slate-300';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fecha = new Date(proximo);
  const diffDays = Math.floor((fecha.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'text-red-600 dark:text-red-400 font-medium';
  if (diffDays <= 30) return 'text-amber-600 dark:text-amber-400 font-medium';
  return 'text-slate-700 dark:text-slate-300';
}

const PRIORIDAD_BADGE: Record<string, string> = {
  Urgente: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  Alta: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  Media: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  Baja: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const ESTADO_OT_BADGE: Record<string, string> = {
  programado: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  en_proceso: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  realizado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  cancelado: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  pendiente_aprobacion: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  aprobado: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  rechazado: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
};

const EMPTY_FORM = {
  tipo: 'Preventivo',
  prioridad: 'Media',
  fecha: new Date().toISOString().split('T')[0],
  tecnico: '',
  tecnico_id: undefined as number | undefined,
  descripcion: '',
  costo: undefined as number | undefined,
  observaciones: '',
  proximo_mantenimiento: '',
};

export default function MantenimientosRegistrosPage() {
  const router = useRouter();
  const [items, setItems] = useState<MantenimientoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [sortField, setSortField] = useState<SortField>('fecha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [tabView, setTabView] = useState<TabView>('registros');
  const [filterSede, setFilterSede] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterTipoEquipo, setFilterTipoEquipo] = useState('');
  const [filterEstadoVenc, setFilterEstadoVenc] = useState<EstadoVencimientoFilter>('');
  const [filterEstado, setFilterEstado] = useState('');
  const [tiposEquipo, setTiposEquipo] = useState<string[]>([]);
  const [sinMantItems, setSinMantItems] = useState<EquipmentProximoPreventivoRow[]>([]);
  const [sinMantLoading, setSinMantLoading] = useState(false);

  const [modalEquipoId, setModalEquipoId] = useState<number | null>(null);
  const [viewing, setViewing] = useState<MantenimientoRow | null>(null);

  // ── Formulario "Nuevo mantenimiento" ──────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [eqSearch, setEqSearch] = useState('');
  const [eqResults, setEqResults] = useState<EquipmentRow[]>([]);
  const [selectedEq, setSelectedEq] = useState<EquipmentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [createdRecord, setCreatedRecord] = useState<MantenimientoRow | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [usersBasic, setUsersBasic] = useState<UserBasic[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const load = async (
    sede = filterSede,
    tipo = filterTipo,
    tipoEquipo = filterTipoEquipo,
    estadoVenc = filterEstadoVenc,
    estado = filterEstado,
    p = page,
  ) => {
    setLoading(true);
    try {
      const r = await listMantenimientos({
        sede: sede || undefined,
        tipo: tipo || undefined,
        tipo_equipo: tipoEquipo || undefined,
        estado_vencimiento: estadoVenc === '' ? undefined : estadoVenc,
        estado: estado || undefined,
        skip: p * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setItems(r.items);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  };

  const loadSinMantenimiento = async () => {
    setSinMantLoading(true);
    try {
      const r = await listEquiposProximosPreventivos();
      setSinMantItems(r.items);
    } finally {
      setSinMantLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    load();
    loadSinMantenimiento();
    listMantenimientoConfig()
      .then((r) => setTiposEquipo(r.items.map((c) => c.tipo_equipo)))
      .catch(() => null);
    listUsersBasic().then(setUsersBasic).catch(() => null);
  }, [router]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    load(filterSede, filterTipo, filterTipoEquipo, filterEstadoVenc, filterEstado, 0);
  };

  const clearFilters = () => {
    setFilterSede(''); setFilterTipo(''); setFilterTipoEquipo(''); setFilterEstadoVenc(''); setFilterEstado('');
    setPage(0);
    load('', '', '', '', '', 0);
  };

  const goPage = (p: number) => {
    setPage(p);
    load(filterSede, filterTipo, filterTipoEquipo, filterEstadoVenc, filterEstado, p);
  };

  // ── Búsqueda de equipo (debounced) ────────────────────────────────────────
  useEffect(() => {
    if (!eqSearch.trim()) { setEqResults([]); return; }
    const timer = setTimeout(() => {
      listEquipment({ search: eqSearch }).then((r) => setEqResults(r.items)).catch(() => setEqResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [eqSearch]);

  function openNew() {
    setShowForm(true);
    setForm(EMPTY_FORM);
    setSelectedEq(null);
    setEqSearch('');
    setEqResults([]);
    setCreatedRecord(null);
    setFormMsg('');
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function closeForm() {
    setShowForm(false);
    setCreatedRecord(null);
    load();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEq) { setFormMsg('Selecciona un equipo.'); return; }
    setSaving(true);
    setFormMsg('');
    const payload: MantenimientoPayload = {
      equipment_id: selectedEq.id,
      tipo: form.tipo,
      prioridad: form.prioridad,
      fecha: form.fecha,
      tecnico: form.tecnico || undefined,
      tecnico_id: form.tecnico_id ?? null,
      descripcion: form.descripcion,
      costo: form.costo ?? undefined,
      observaciones: form.observaciones || undefined,
      proximo_mantenimiento: form.proximo_mantenimiento || undefined,
    };
    try {
      const created = await createMantenimiento(payload);
      setCreatedRecord(created);
      await load();
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadPhoto(file: File) {
    if (!createdRecord) return;
    setUploadingPhoto(true);
    try {
      const photo = await uploadMantenimientoPhoto(createdRecord.id, file);
      setCreatedRecord((prev) => prev ? { ...prev, fotos: [...prev.fotos, photo] } : prev);
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : 'Error al subir foto');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDeletePhoto(photoId: number) {
    if (!createdRecord) return;
    try {
      await deleteMantenimientoPhoto(createdRecord.id, photoId);
      setCreatedRecord((prev) => prev ? { ...prev, fotos: prev.fotos.filter((p) => p.id !== photoId) } : prev);
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : 'Error al eliminar foto');
    }
  }

  const sortedItems = [...items].sort((a, b) => {
    const cmp = compareValues(sortValue(a, sortField), sortValue(b, sortField));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        {modalEquipoId && <EquipoModal equipoId={modalEquipoId} onClose={() => setModalEquipoId(null)} />}
        {viewing && (
          <MantenimientoModal
            mantenimiento={viewing}
            onClose={() => setViewing(null)}
            onUpdate={(updated) => {
              setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
              setViewing(updated);
            }}
          />
        )}

        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Mantenimiento</p>
          <h1 className="mt-1 text-3xl font-bold">Órdenes de trabajo</h1>
        </div>

        <MantenimientosSubNav />

        {/* Tab switcher */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setTabView('registros')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tabView === 'registros'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              REGISTROS {tabView === 'registros' && <span className="ml-1 text-xs text-slate-400">({total})</span>}
            </button>
            <button
              onClick={() => { setTabView('sin_mantenimiento'); loadSinMantenimiento(); }}
              className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tabView === 'sin_mantenimiento'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              INSPECCIÓN INICIAL
              {sinMantItems.length > 0 && (
                <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                  {sinMantItems.length}
                </span>
              )}
            </button>
          </div>
          {tabView === 'registros' && !showForm && (
            <button onClick={openNew} className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              + Nuevo mantenimiento
            </button>
          )}
        </div>

        {/* Formulario nuevo mantenimiento */}
        {showForm && (
          <div className="mb-6 rounded-2xl border border-cyan-300 bg-cyan-50 p-6 dark:border-cyan-900/50 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold">Nuevo mantenimiento</h3>
              <button onClick={closeForm} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">✕ Cerrar</button>
            </div>

            {createdRecord ? (
              <div className="space-y-4">
                <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  Mantenimiento registrado correctamente
                  {createdRecord.proximo_mantenimiento && (
                    <> — próximo mantenimiento: <strong>{createdRecord.proximo_mantenimiento}</strong></>
                  )}
                  .
                </p>
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Fotos</h4>
                  <PhotoGrid
                    photos={createdRecord.fotos}
                    apiBase={API_BASE}
                    onUpload={handleUploadPhoto}
                    onDelete={handleDeletePhoto}
                    uploading={uploadingPhoto}
                  />
                </div>
                {formMsg && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{formMsg}</p>}
                <button onClick={closeForm} className="rounded-md bg-slate-200 px-5 py-2 text-sm text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                  Listo
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Selector de equipo */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Equipo *
                  </label>
                  {selectedEq ? (
                    <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400 shrink-0">{selectedEq.codigo_interno}</span>
                        <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{selectedEq.marca} {selectedEq.modelo}</span>
                        <span className="text-xs text-slate-500 shrink-0">{selectedEq.tipo}</span>
                      </div>
                      <button type="button" onClick={() => setSelectedEq(null)}
                        className="ml-3 shrink-0 text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400">✕</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        ref={searchRef}
                        type="text"
                        placeholder="Buscar por código, serial, marca, modelo..."
                        value={eqSearch}
                        onChange={(e) => setEqSearch(e.target.value)}
                        autoComplete="off"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                      />
                      {eqResults.length > 0 && (
                        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 shadow-xl">
                          {eqResults.slice(0, 10).map((eq) => (
                            <li key={eq.id}>
                              <button type="button" onClick={() => { setSelectedEq(eq); setEqSearch(''); setEqResults([]); }}
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
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Tipo</label>
                    <select value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                      <option value="Preventivo">Preventivo</option>
                      <option value="Correctivo">Correctivo</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Prioridad</label>
                    <select value={form.prioridad} onChange={(e) => setForm((p) => ({ ...p, prioridad: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                      <option value="Urgente">Urgente</option>
                      <option value="Alta">Alta</option>
                      <option value="Media">Media</option>
                      <option value="Baja">Baja</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Fecha</label>
                    <input type="date" value={form.fecha} onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))} required
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Técnico</label>
                  <select
                    value={form.tecnico_id ?? ''}
                    onChange={(e) => {
                      const uid = e.target.value ? Number(e.target.value) : undefined;
                      const u = usersBasic.find((u) => u.id === uid);
                      setForm((p) => ({ ...p, tecnico_id: uid, tecnico: u ? u.full_name : p.tecnico }));
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">— Usuario interno (opcional) —</option>
                    {usersBasic.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="O escribe el nombre (técnico externo)"
                    value={form.tecnico}
                    onChange={(e) => setForm((p) => ({ ...p, tecnico: e.target.value, tecnico_id: undefined }))}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Descripción *</label>
                  <textarea
                    rows={3}
                    placeholder="Descripción del trabajo realizado"
                    value={form.descripcion}
                    onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                    required
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Costo (opcional)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={form.costo ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, costo: e.target.value ? Number(e.target.value) : undefined }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Próximo mantenimiento</label>
                    <DatePickerPresets
                      value={form.proximo_mantenimiento}
                      onChange={(v) => setForm((p) => ({ ...p, proximo_mantenimiento: v }))}
                    />
                    <p className="text-xs text-slate-500">Si se deja vacío y el tipo es Preventivo, se calculará automáticamente.</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Observaciones</label>
                  <input
                    type="text"
                    placeholder="Notas adicionales"
                    value={form.observaciones}
                    onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                  />
                </div>

                {formMsg && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{formMsg}</p>}

                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="rounded-md bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Registrar'}
                  </button>
                  <button type="button" onClick={closeForm} className="rounded-md bg-slate-200 px-5 py-2 text-sm text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {tabView === 'sin_mantenimiento' && (
          <div className="overflow-x-auto rounded-2xl border border-indigo-200 bg-white dark:border-indigo-900/60 dark:bg-slate-900">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-indigo-50 text-xs uppercase tracking-wider text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Equipo</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Sede</th>
                  <th className="px-4 py-3">Primer mantto. programado</th>
                  <th className="px-4 py-3">Calculado a partir de</th>
                  <th className="px-4 py-3">Frecuencia</th>
                  <th className="px-4 py-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {sinMantLoading ? (
                  <tr><td colSpan={8} className="py-10 text-center text-slate-500">Cargando...</td></tr>
                ) : sinMantItems.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-slate-500">
                    Todos los equipos tienen mantenimiento registrado.
                  </td></tr>
                ) : sinMantItems.map((eq) => {
                  const today = new Date();
                  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                  const isVencido = eq.proximo_preventivo < todayStr;
                  const razon = eq.garantia_vence
                    ? `Fin garantía`
                    : eq.fecha_compra ? `Compra + ${eq.frecuencia_meses ?? '?'}m` : `Ingreso + ${eq.frecuencia_meses ?? '?'}m`;
                  return (
                    <tr key={eq.equipment_id} className="border-t border-slate-200 hover:bg-indigo-50/50 dark:border-slate-800 dark:hover:bg-indigo-500/5 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {eq.equipment_codigo}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {eq.equipment_marca} {eq.equipment_modelo}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{eq.equipment_tipo}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{eq.equipment_sede}</td>
                      <td className={`px-4 py-3 font-medium ${isVencido ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {new Date(`${eq.proximo_preventivo}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {isVencido && <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300">Vencido</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{razon}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {eq.frecuencia_meses ? `Cada ${eq.frecuencia_meses} meses` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/equipos/${eq.equipment_id}/hoja-de-vida`}
                          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          + Registrar
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tabView === 'registros' && <>

        {/* Filtros */}
        <form onSubmit={handleFilter} className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Sede</label>
            <input type="text" placeholder="Buscar sede..." value={filterSede} onChange={(e) => setFilterSede(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Tipo</label>
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Todos</option>
              <option>Preventivo</option>
              <option>Correctivo</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Tipo de equipo</label>
            <select value={filterTipoEquipo} onChange={(e) => setFilterTipoEquipo(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Todos</option>
              {tiposEquipo.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Vencimiento</label>
            <select value={filterEstadoVenc} onChange={(e) => setFilterEstadoVenc(e.target.value as EstadoVencimientoFilter)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Todos</option>
              <option value="vencido">Vencido</option>
              <option value="proximo">Próximo (30 días)</option>
              <option value="al_dia">Al día</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Estado</label>
            <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Todos</option>
              <option value="programado">Programado</option>
              <option value="realizado">Realizado</option>
              <option value="cancelado">Cancelado</option>
              <option value="pendiente_aprobacion">Pendiente aprobación</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>
          <button type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors">
            Buscar
          </button>
          {(filterSede || filterTipo || filterTipoEquipo || filterEstadoVenc || filterEstado) && (
            <button type="button" onClick={clearFilters}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
              Limpiar
            </button>
          )}
        </form>

        {/* Tabla */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-950 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">OT</th>
                <SortableTh field="fecha" label="Fecha" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh field="equipo" label="Equipo" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh field="tipo_equipo" label="Tipo equipo" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh field="sede" label="Sede" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh field="tipo" label="Tipo" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3">Prioridad</th>
                <SortableTh field="tecnico" label="Técnico" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Checklist</th>
                <SortableTh field="costo" label="Costo" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh field="proximo" label="Próximo" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className="py-12 text-center text-slate-500">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
                </td></tr>
              ) : sortedItems.length === 0 ? (
                <tr><td colSpan={13} className="py-12 text-center text-slate-500">Sin registros de mantenimiento.</td></tr>
              ) : sortedItems.map((m) => {
                const total = m.pasos?.length ?? 0;
                const done = m.pasos?.filter((p) => p.completado).length ?? 0;
                return (
                <tr key={m.id} className="border-t border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-cyan-700 dark:text-cyan-400 whitespace-nowrap">
                    {m.numero_ot ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap hover:underline text-left cursor-pointer" onClick={() => setViewing(m)}>
                    {new Date(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setModalEquipoId(m.equipment_id)}
                      className="font-mono text-xs font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline text-left"
                    >
                      {m.equipment_codigo}
                    </button>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{m.equipment_marca} {m.equipment_modelo}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{m.equipment_tipo}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{m.equipment_sede}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.tipo === 'Correctivo' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORIDAD_BADGE[m.prioridad ?? 'Media'] ?? PRIORIDAD_BADGE.Media}`}>
                      {m.prioridad ?? 'Media'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{m.tecnico ?? '—'}</td>
                  <td className="px-4 py-3 max-w-xs text-slate-700 dark:text-slate-300 truncate" title={m.descripcion}>{m.descripcion}</td>
                  <td className="px-4 py-3">
                    {total > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-slate-200 dark:bg-slate-700">
                          <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${(done / total) * 100}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{done}/{total}</span>
                      </div>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{m.costo ? `$${Number(m.costo).toLocaleString()}` : '—'}</td>
                  <td className={`px-4 py-3 ${proximoClass(m.proximo_mantenimiento)}`}>{m.proximo_mantenimiento ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_OT_BADGE[m.estado] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                      {m.estado.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{total} registro{total !== 1 ? 's' : ''} en total</span>
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
        </>}
      </main>
    </>
  );
}
