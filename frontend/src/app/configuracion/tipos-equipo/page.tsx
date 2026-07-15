"use client";

import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import {
  createEquipmentTipo,
  isAuthenticated,
  listEquipmentTipos,
  listMantenimientoConfig,
  updateEquipmentTipo,
  updateEquipmentTipoSpecs,
  updateMantenimientoConfig,
  type EquipmentTipo,
  type MantenimientoConfigRow,
  type SpecField,
} from '@/lib/api';

const TIPOS_CAMPO: { value: SpecField['type']; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'select', label: 'Selección' },
  { value: 'boolean', label: 'Sí/No' },
  { value: 'scale', label: 'Escala' },
];

const DOMINIOS = ['IT', 'Bioingeniería', 'General'];
const DOMINIO_COLORS: Record<string, string> = {
  IT: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  'Bioingeniería': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  General: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

interface TipoEditState {
  nombre: string;
  dominio: string;
  es_periferico: boolean;
  activo: boolean;
}

interface SpecFieldEdit {
  key: string;
  label: string;
  type: SpecField['type'];
  options: string;
  min: string;
  max: string;
  placeholder: string;
}

interface MantConfigEdit {
  tiene_mantenimiento: boolean;
  frecuencia_meses: string;
  descripcion: string;
}

const EMPTY_SPEC: SpecFieldEdit = {
  key: '', label: '', type: 'text', options: '', min: '', max: '', placeholder: '',
};

function tipoToEdit(t: EquipmentTipo): TipoEditState {
  return { nombre: t.nombre, dominio: t.dominio ?? 'IT', es_periferico: t.es_periferico, activo: t.activo };
}

function specsToEdit(specs: SpecField[]): SpecFieldEdit[] {
  return specs.map((s) => ({
    key: s.key,
    label: s.label,
    type: s.type,
    options: (s.options ?? []).join(', '),
    min: s.min !== undefined && s.min !== null ? String(s.min) : '',
    max: s.max !== undefined && s.max !== null ? String(s.max) : '',
    placeholder: s.placeholder ?? '',
  }));
}

function DragHandle() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="3" r="1.4" />
      <circle cx="5" cy="8" r="1.4" />
      <circle cx="5" cy="13" r="1.4" />
      <circle cx="11" cy="3" r="1.4" />
      <circle cx="11" cy="8" r="1.4" />
      <circle cx="11" cy="13" r="1.4" />
    </svg>
  );
}

export default function TiposEquipoPage() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();

  const [tipos, setTipos] = useState<EquipmentTipo[]>([]);
  const [edits, setEdits] = useState<Record<number, TipoEditState>>({});
  const [specsEdits, setSpecsEdits] = useState<Record<number, SpecFieldEdit[]>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [savingSpecs, setSavingSpecs] = useState<number | null>(null);
  const [savedSpecs, setSavedSpecs] = useState<number | null>(null);
  const [savingProps, setSavingProps] = useState<number | null>(null);
  const [savedProps, setSavedProps] = useState<number | null>(null);
  const [orderSaving, setOrderSaving] = useState(false);

  const [configs, setConfigs] = useState<Record<string, MantenimientoConfigRow>>({});
  const [configEdits, setConfigEdits] = useState<Record<string, MantConfigEdit>>({});

  const [showNewForm, setShowNewForm] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newDominio, setNewDominio] = useState('IT');
  const [creating, setCreating] = useState(false);

  // Drag state — tipo rows
  const [dragTipoId, setDragTipoId] = useState<number | null>(null);
  const [dragOverTipoId, setDragOverTipoId] = useState<number | null>(null);

  // Drag state — spec fields (per-tipo)
  const [dragSpec, setDragSpec] = useState<{ tipoId: number; idx: number } | null>(null);
  const [dragOverSpecIdx, setDragOverSpecIdx] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([listEquipmentTipos(), listMantenimientoConfig()])
      .then(([tiposRes, configsRes]) => {
        setTipos(tiposRes.items);
        const e: Record<number, TipoEditState> = {};
        const s: Record<number, SpecFieldEdit[]> = {};
        for (const t of tiposRes.items) {
          e[t.id] = tipoToEdit(t);
          s[t.id] = specsToEdit(t.specs);
        }
        setEdits(e);
        setSpecsEdits(s);
        const cfgMap: Record<string, MantenimientoConfigRow> = {};
        const cfgEdits: Record<string, MantConfigEdit> = {};
        for (const c of configsRes.items) {
          cfgMap[c.tipo_equipo] = c;
          cfgEdits[c.tipo_equipo] = {
            tiene_mantenimiento: c.tiene_mantenimiento,
            frecuencia_meses: String(c.frecuencia_meses),
            descripcion: c.descripcion ?? '',
          };
        }
        setConfigs(cfgMap);
        setConfigEdits(cfgEdits);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar tipos de equipo'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (authLoading) return;
    if (!hasPermission('equipment_types:write')) { router.replace('/inicio'); return; }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, hasPermission, router]);

  async function handleSaveTipo(id: number) {
    const edit = edits[id];
    if (!edit) return;
    if (!edit.nombre.trim()) { setError('El nombre no puede estar vacío'); return; }
    setError('');
    setSaving(id);
    setSaved(null);
    const orden = tipos.findIndex((t) => t.id === id);
    try {
      const updated = await updateEquipmentTipo(id, {
        nombre: edit.nombre.trim(),
        dominio: edit.dominio,
        es_periferico: edit.es_periferico,
        activo: edit.activo,
        orden: orden >= 0 ? orden : 0,
      });
      setTipos((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setEdits((prev) => ({ ...prev, [id]: tipoToEdit(updated) }));
      setSaved(id);
      setTimeout(() => setSaved((s) => (s === id ? null : s)), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveProps(id: number, tipoNombre: string) {
    const edit = edits[id];
    if (!edit) return;
    if (!edit.nombre.trim()) { setError('El nombre no puede estar vacío'); return; }
    const cfgEdit = configEdits[tipoNombre];
    if (cfgEdit?.tiene_mantenimiento) {
      const f = parseInt(cfgEdit.frecuencia_meses, 10);
      if (!f || f < 1) { setError('La frecuencia debe ser un número mayor o igual a 1.'); return; }
    }
    setError('');
    setSavingProps(id);
    setSavedProps(null);
    const orden = tipos.findIndex((t) => t.id === id);
    try {
      const updatedTipo = await updateEquipmentTipo(id, {
        nombre: edit.nombre.trim(),
        dominio: edit.dominio,
        es_periferico: edit.es_periferico,
        activo: edit.activo,
        orden: orden >= 0 ? orden : 0,
      });
      setTipos((prev) => prev.map((t) => (t.id === id ? updatedTipo : t)));
      setEdits((prev) => ({ ...prev, [id]: tipoToEdit(updatedTipo) }));

      if (cfgEdit) {
        const frecuencia = parseInt(cfgEdit.frecuencia_meses, 10);
        const updatedConfig = await updateMantenimientoConfig(tipoNombre, {
          tiene_mantenimiento: cfgEdit.tiene_mantenimiento,
          frecuencia_meses: frecuencia || 12,
          descripcion: cfgEdit.descripcion,
        });
        setConfigs((prev) => ({ ...prev, [tipoNombre]: updatedConfig }));
      }

      setSavedProps(id);
      setTimeout(() => setSavedProps((s) => (s === id ? null : s)), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar propiedades');
    } finally {
      setSavingProps(null);
    }
  }

  async function handleCreateTipo(event: React.FormEvent) {
    event.preventDefault();
    if (!newNombre.trim()) { setError('El nombre no puede estar vacío'); return; }
    setError('');
    setCreating(true);
    try {
      const created = await createEquipmentTipo({
        nombre: newNombre.trim(),
        dominio: newDominio,
        es_periferico: false,
        activo: true,
        orden: tipos.length,
      });
      setTipos((prev) => [...prev, created]);
      setEdits((prev) => ({ ...prev, [created.id]: tipoToEdit(created) }));
      setSpecsEdits((prev) => ({ ...prev, [created.id]: [] }));
      setNewNombre('');
      setNewDominio('IT');
      setShowNewForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el tipo');
    } finally {
      setCreating(false);
    }
  }

  function updateSpec(tipoId: number, idx: number, patch: Partial<SpecFieldEdit>) {
    setSpecsEdits((prev) => {
      const list = [...(prev[tipoId] ?? [])];
      list[idx] = { ...list[idx], ...patch };
      return { ...prev, [tipoId]: list };
    });
  }

  function addSpec(tipoId: number) {
    setSpecsEdits((prev) => ({ ...prev, [tipoId]: [...(prev[tipoId] ?? []), { ...EMPTY_SPEC }] }));
  }

  function removeSpec(tipoId: number, idx: number) {
    setSpecsEdits((prev) => ({
      ...prev,
      [tipoId]: (prev[tipoId] ?? []).filter((_, i) => i !== idx),
    }));
  }

  async function handleSaveSpecs(tipoId: number) {
    const list = specsEdits[tipoId] ?? [];
    for (const s of list) {
      if (!s.key.trim() || !s.label.trim()) {
        setError('La clave y la etiqueta de cada campo no pueden estar vacías');
        return;
      }
    }
    setError('');
    setSavingSpecs(tipoId);
    setSavedSpecs(null);
    try {
      const specs: SpecField[] = list.map((s) => ({
        key: s.key.trim(),
        label: s.label.trim(),
        type: s.type,
        ...(s.type === 'select'
          ? { options: s.options.split(',').map((o) => o.trim()).filter(Boolean) }
          : {}),
        ...(s.type === 'scale'
          ? { min: s.min ? Number(s.min) : undefined, max: s.max ? Number(s.max) : undefined }
          : {}),
        ...(s.placeholder.trim() ? { placeholder: s.placeholder.trim() } : {}),
      }));
      const updated = await updateEquipmentTipoSpecs(tipoId, specs);
      setTipos((prev) => prev.map((t) => (t.id === tipoId ? updated : t)));
      setSpecsEdits((prev) => ({ ...prev, [tipoId]: specsToEdit(updated.specs) }));
      setSavedSpecs(tipoId);
      setTimeout(() => setSavedSpecs((s) => (s === tipoId ? null : s)), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la ficha técnica');
    } finally {
      setSavingSpecs(null);
    }
  }

  // — Tipo row drag & drop (auto-saves orden) —
  async function handleTipoDrop(toId: number) {
    if (!dragTipoId || dragTipoId === toId) {
      setDragTipoId(null);
      setDragOverTipoId(null);
      return;
    }
    const fromIdx = tipos.findIndex((t) => t.id === dragTipoId);
    const toIdx = tipos.findIndex((t) => t.id === toId);
    const newTipos = [...tipos];
    const [moved] = newTipos.splice(fromIdx, 1);
    newTipos.splice(toIdx, 0, moved);
    setTipos(newTipos);
    setDragTipoId(null);
    setDragOverTipoId(null);
    setOrderSaving(true);
    try {
      await Promise.all(
        newTipos.map((t, idx) => {
          const edit = edits[t.id];
          return updateEquipmentTipo(t.id, {
            nombre: edit?.nombre.trim() ?? t.nombre,
            es_periferico: edit?.es_periferico ?? t.es_periferico,
            activo: edit?.activo ?? t.activo,
            orden: idx,
          });
        }),
      );
    } catch {
      setError('Error al guardar el orden');
    } finally {
      setOrderSaving(false);
    }
  }

  // — Spec field drag & drop —
  function handleSpecDrop(tipoId: number, toIdx: number) {
    if (!dragSpec || dragSpec.tipoId !== tipoId || dragSpec.idx === toIdx) {
      setDragSpec(null);
      setDragOverSpecIdx(null);
      return;
    }
    const fromIdx = dragSpec.idx;
    setSpecsEdits((prev) => {
      const list = [...(prev[tipoId] ?? [])];
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      return { ...prev, [tipoId]: list };
    });
    setDragSpec(null);
    setDragOverSpecIdx(null);
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Configuración</p>
            <h1 className="mt-1 text-3xl font-bold">Tipos de equipo</h1>
          </div>
          <button
            type="button"
            onClick={() => { setShowNewForm((v) => !v); if (!showNewForm) setNewNombre(''); }}
            className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400"
          >
            + Nuevo tipo
          </button>
        </div>

        <p className="mb-6 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Administra los tipos de equipo y los campos de su ficha técnica. Arrastra las filas para
          reordenar. Un tipo desactivado deja de aparecer al crear equipos nuevos, pero los equipos
          existentes siguen funcionando con normalidad.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {orderSaving && (
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Guardando orden…</p>
        )}

        {showNewForm && (
          <form
            onSubmit={handleCreateTipo}
            className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="space-y-1">
              <label className="block text-xs text-slate-600 dark:text-slate-400">Nombre</label>
              <input
                type="text"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                placeholder="Ej: Proyector"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-slate-600 dark:text-slate-400">Dominio</label>
              <select
                value={newDominio}
                onChange={(e) => setNewDominio(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {DOMINIOS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
              >
                {creating ? 'Creando…' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="rounded-md bg-slate-200 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-slate-600 dark:text-slate-400">Cargando tipos de equipo…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="w-8 px-3 py-3" />
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Dominio</th>
                  <th className="px-4 py-3">Activo</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {tipos.map((tipo) => {
                  const edit = edits[tipo.id] ?? tipoToEdit(tipo);
                  const cfgEdit = configEdits[tipo.nombre];
                  const specs = specsEdits[tipo.id] ?? [];
                  const expanded = expandedId === tipo.id;
                  const isDragOver = dragOverTipoId === tipo.id && dragTipoId !== tipo.id;
                  const isDragging = dragTipoId === tipo.id;

                  return (
                    <Fragment key={tipo.id}>
                      {/* — Main row — */}
                      <tr
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          setDragTipoId(tipo.id);
                        }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverTipoId(tipo.id); }}
                        onDragLeave={() => setDragOverTipoId(null)}
                        onDrop={(e) => { e.preventDefault(); void handleTipoDrop(tipo.id); }}
                        onDragEnd={() => { setDragTipoId(null); setDragOverTipoId(null); }}
                        className={`transition-colors
                          ${isDragOver ? 'bg-cyan-50 ring-1 ring-inset ring-cyan-400 dark:bg-cyan-500/10 dark:ring-cyan-500/40' : ''}
                          ${isDragging ? 'opacity-40' : ''}
                        `}
                      >
                        <td
                          className="w-8 cursor-grab px-3 py-3 text-slate-300 hover:text-slate-500 dark:text-slate-700 dark:hover:text-slate-400"
                          title="Arrastrar para reordenar"
                        >
                          <DragHandle />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={edit.nombre}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [tipo.id]: { ...prev[tipo.id], nombre: e.target.value },
                              }))
                            }
                            className="min-w-[140px] rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={edit.dominio}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [tipo.id]: { ...prev[tipo.id], dominio: e.target.value },
                              }))
                            }
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                          >
                            {DOMINIOS.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={edit.activo}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [tipo.id]: { ...prev[tipo.id], activo: e.target.checked },
                              }))
                            }
                            className="h-4 w-4 accent-cyan-400"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => void handleSaveTipo(tipo.id)}
                              disabled={saving === tipo.id}
                              className="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
                            >
                              {saving === tipo.id ? 'Guardando…' : 'Guardar'}
                            </button>
                            <button
                              onClick={() =>
                                setExpandedId((prev) => (prev === tipo.id ? null : tipo.id))
                              }
                              className="rounded-md bg-slate-200 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                            >
                              Ficha técnica {expanded ? '▲' : '▾'}
                            </button>
                            {saved === tipo.id && (
                              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                Guardado ✓
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* — Expanded ficha técnica — */}
                      {expanded && (
                        <tr>
                          <td
                            colSpan={5}
                            className="bg-slate-50/50 px-4 py-4 dark:bg-slate-950/30"
                          >
                            <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">

                              {/* — Propiedades — */}
                              <div>
                                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                                  Propiedades — {tipo.nombre}
                                </h3>
                                <div className="flex flex-wrap items-end gap-6">
                                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={edit.es_periferico}
                                      onChange={(e) =>
                                        setEdits((prev) => ({
                                          ...prev,
                                          [tipo.id]: {
                                            ...prev[tipo.id],
                                            es_periferico: e.target.checked,
                                          },
                                        }))
                                      }
                                      className="h-4 w-4 accent-cyan-400"
                                    />
                                    <span className="text-slate-700 dark:text-slate-300">
                                      Periférico
                                    </span>
                                  </label>

                                  {cfgEdit ? (
                                    <>
                                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                                        <input
                                          type="checkbox"
                                          checked={cfgEdit.tiene_mantenimiento}
                                          onChange={(e) =>
                                            setConfigEdits((prev) => ({
                                              ...prev,
                                              [tipo.nombre]: {
                                                ...prev[tipo.nombre],
                                                tiene_mantenimiento: e.target.checked,
                                              },
                                            }))
                                          }
                                          className="h-4 w-4 accent-cyan-400"
                                        />
                                        <span className="text-slate-700 dark:text-slate-300">
                                          Mantto. preventivo
                                        </span>
                                      </label>

                                      {cfgEdit.tiene_mantenimiento && (
                                        <div className="flex items-center gap-2">
                                          <label className="text-sm text-slate-600 dark:text-slate-400">
                                            Frecuencia (meses)
                                          </label>
                                          <input
                                            type="number"
                                            min="1"
                                            value={cfgEdit.frecuencia_meses}
                                            onChange={(e) =>
                                              setConfigEdits((prev) => ({
                                                ...prev,
                                                [tipo.nombre]: {
                                                  ...prev[tipo.nombre],
                                                  frecuencia_meses: e.target.value,
                                                },
                                              }))
                                            }
                                            className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                                          />
                                        </div>
                                      )}
                                    </>
                                  ) : null}

                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => void handleSaveProps(tipo.id, tipo.nombre)}
                                      disabled={savingProps === tipo.id}
                                      className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 disabled:opacity-50 dark:bg-slate-600 dark:hover:bg-slate-500"
                                    >
                                      {savingProps === tipo.id
                                        ? 'Guardando…'
                                        : 'Guardar propiedades'}
                                    </button>
                                    {savedProps === tipo.id && (
                                      <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                        Guardado ✓
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="border-t border-slate-200 dark:border-slate-700" />

                              {/* — Campos de ficha técnica — */}
                              <div>
                                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                                  Campos de ficha técnica — {tipo.nombre}
                                </h3>

                                {specs.length === 0 && (
                                  <p className="mb-3 text-sm text-slate-500 dark:text-slate-500">
                                    Sin campos definidos.
                                  </p>
                                )}

                                {specs.map((spec, idx) => {
                                  const isSpecDragOver =
                                    dragOverSpecIdx === idx &&
                                    dragSpec?.tipoId === tipo.id &&
                                    dragSpec?.idx !== idx;
                                  const isSpecDragging =
                                    dragSpec?.tipoId === tipo.id && dragSpec?.idx === idx;

                                  return (
                                    <div
                                      key={idx}
                                      draggable
                                      onDragStart={(e) => {
                                        e.dataTransfer.effectAllowed = 'move';
                                        setDragSpec({ tipoId: tipo.id, idx });
                                      }}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOverSpecIdx(idx);
                                      }}
                                      onDragLeave={() => setDragOverSpecIdx(null)}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        handleSpecDrop(tipo.id, idx);
                                      }}
                                      onDragEnd={() => {
                                        setDragSpec(null);
                                        setDragOverSpecIdx(null);
                                      }}
                                      className={`mb-2 flex flex-wrap items-end gap-2 rounded-md border p-2 transition-colors
                                        ${isSpecDragOver
                                          ? 'border-cyan-400 bg-cyan-50 dark:border-cyan-500 dark:bg-cyan-500/5'
                                          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60'}
                                        ${isSpecDragging ? 'opacity-40' : ''}
                                      `}
                                    >
                                      <div
                                        className="flex cursor-grab items-end pb-1 text-slate-300 hover:text-slate-500 dark:text-slate-700 dark:hover:text-slate-400"
                                        title="Arrastrar para reordenar"
                                      >
                                        <DragHandle />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="block text-xs text-slate-600 dark:text-slate-400">
                                          Clave
                                        </label>
                                        <input
                                          type="text"
                                          value={spec.key}
                                          onChange={(e) =>
                                            updateSpec(tipo.id, idx, { key: e.target.value })
                                          }
                                          className="w-32 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="block text-xs text-slate-600 dark:text-slate-400">
                                          Etiqueta
                                        </label>
                                        <input
                                          type="text"
                                          value={spec.label}
                                          onChange={(e) =>
                                            updateSpec(tipo.id, idx, { label: e.target.value })
                                          }
                                          className="w-40 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="block text-xs text-slate-600 dark:text-slate-400">
                                          Tipo de campo
                                        </label>
                                        <select
                                          value={spec.type}
                                          onChange={(e) =>
                                            updateSpec(tipo.id, idx, {
                                              type: e.target.value as SpecField['type'],
                                            })
                                          }
                                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                                        >
                                          {TIPOS_CAMPO.map((t) => (
                                            <option key={t.value} value={t.value}>
                                              {t.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      {spec.type === 'select' && (
                                        <div className="space-y-1">
                                          <label className="block text-xs text-slate-600 dark:text-slate-400">
                                            Opciones (separadas por coma)
                                          </label>
                                          <input
                                            type="text"
                                            value={spec.options}
                                            onChange={(e) =>
                                              updateSpec(tipo.id, idx, { options: e.target.value })
                                            }
                                            className="w-56 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                                            placeholder="Ej: HD, FullHD, 4K"
                                          />
                                        </div>
                                      )}

                                      {spec.type === 'scale' && (
                                        <>
                                          <div className="space-y-1">
                                            <label className="block text-xs text-slate-600 dark:text-slate-400">
                                              Mín.
                                            </label>
                                            <input
                                              type="number"
                                              value={spec.min}
                                              onChange={(e) =>
                                                updateSpec(tipo.id, idx, { min: e.target.value })
                                              }
                                              className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="block text-xs text-slate-600 dark:text-slate-400">
                                              Máx.
                                            </label>
                                            <input
                                              type="number"
                                              value={spec.max}
                                              onChange={(e) =>
                                                updateSpec(tipo.id, idx, { max: e.target.value })
                                              }
                                              className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                                            />
                                          </div>
                                        </>
                                      )}

                                      <div className="space-y-1">
                                        <label className="block text-xs text-slate-600 dark:text-slate-400">
                                          Placeholder
                                        </label>
                                        <input
                                          type="text"
                                          value={spec.placeholder}
                                          onChange={(e) =>
                                            updateSpec(tipo.id, idx, {
                                              placeholder: e.target.value,
                                            })
                                          }
                                          className="w-40 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                                        />
                                      </div>

                                      <div className="ml-auto flex items-end">
                                        <button
                                          type="button"
                                          onClick={() => removeSpec(tipo.id, idx)}
                                          className="rounded-md bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                                        >
                                          ✕ Eliminar
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}

                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => addSpec(tipo.id)}
                                    className="rounded-md bg-slate-200 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                                  >
                                    + Agregar campo
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleSaveSpecs(tipo.id)}
                                    disabled={savingSpecs === tipo.id}
                                    className="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
                                  >
                                    {savingSpecs === tipo.id
                                      ? 'Guardando…'
                                      : 'Guardar ficha técnica'}
                                  </button>
                                  {savedSpecs === tipo.id && (
                                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                      Guardado ✓
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
