"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { NavBar } from '@/components/nav-bar';
import { MantenimientosSubNav } from '@/app/mantenimientos/_components/mantenimientos-subnav';
import {
  createPlantilla,
  deletePlantilla,
  isAuthenticated,
  listEquipmentTipos,
  listMantenimientoConfig,
  listPlantillas,
  updateMantenimientoConfig,
  type EquipmentTipo,
  type MantenimientoConfigRow,
  type PlantillaPasoRow,
} from '@/lib/api';


const TIPOS_MANT = ['Preventivo', 'Correctivo', 'Ambos'];

export default function MantenimientosConfiguracionPage() {
  const router = useRouter();

  // ── Frecuencias ──────────────────────────────────────────────────────────────
  const [configs, setConfigs] = useState<MantenimientoConfigRow[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState<string | null>(null);
  const [configMsg, setConfigMsg] = useState('');
  const [configMsgOk, setConfigMsgOk] = useState(false);
  const [editFrecuencia, setEditFrecuencia] = useState<Record<string, number>>({});

  // ── Plantillas checklist ─────────────────────────────────────────────────────
  const [tiposEquipo, setTiposEquipo] = useState<EquipmentTipo[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaPasoRow[]>([]);
  const [plantillasLoading, setPlantillasLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterMant, setFilterMant] = useState('');

  // Nueva plantilla form
  const [newTipoEquipo, setNewTipoEquipo] = useState('');
  const [newTipoMant, setNewTipoMant] = useState('Preventivo');
  const [newDesc, setNewDesc] = useState('');
  const [newTipoCampo, setNewTipoCampo] = useState<'checkbox' | 'numero' | 'texto' | 'seleccion'>('checkbox');
  const [newUnidad, setNewUnidad] = useState('');
  const [newOpciones, setNewOpciones] = useState('');
  const [newMin, setNewMin] = useState('');
  const [newMax, setNewMax] = useState('');
  const [newObligatorio, setNewObligatorio] = useState(true);
  const [addingPlantilla, setAddingPlantilla] = useState(false);
  const [plantillaMsg, setPlantillaMsg] = useState('');

  async function loadConfigs() {
    setConfigLoading(true);
    try {
      const r = await listMantenimientoConfig();
      setConfigs(r.items);
      const map: Record<string, number> = {};
      r.items.forEach((c) => { map[c.tipo_equipo] = c.frecuencia_meses; });
      setEditFrecuencia(map);
    } finally {
      setConfigLoading(false);
    }
  }

  async function loadPlantillas() {
    setPlantillasLoading(true);
    try {
      const items = await listPlantillas({
        tipo_equipo: filterTipo || undefined,
        tipo_mantenimiento: filterMant || undefined,
      });
      setPlantillas(items);
    } finally {
      setPlantillasLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    loadConfigs();
    listEquipmentTipos().then((r) => {
      setTiposEquipo(r.items);
      if (r.items.length > 0 && !newTipoEquipo) setNewTipoEquipo(r.items[0].nombre);
    }).catch(() => null);
  }, [router]);

  useEffect(() => { loadPlantillas(); }, [filterTipo, filterMant]);

  async function saveFrecuencia(tipoEquipo: string) {
    const meses = editFrecuencia[tipoEquipo];
    if (!meses || meses < 1) return;
    setConfigSaving(tipoEquipo);
    setConfigMsg('');
    try {
      await updateMantenimientoConfig(tipoEquipo, { frecuencia_meses: meses });
      await loadConfigs();
      setConfigMsgOk(true);
      setConfigMsg(`Frecuencia de "${tipoEquipo}" actualizada a ${meses} meses.`);
    } catch (err) {
      setConfigMsgOk(false);
      setConfigMsg(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setConfigSaving(null);
    }
  }

  async function handleAddPlantilla(e: React.FormEvent) {
    e.preventDefault();
    if (!newTipoEquipo || !newDesc.trim()) return;
    setAddingPlantilla(true);
    setPlantillaMsg('');
    try {
      const nextOrden = plantillas.filter(
        (p) => p.tipo_equipo === newTipoEquipo && p.tipo_mantenimiento === newTipoMant
      ).length;
      const opcionesArr = newTipoCampo === 'seleccion'
        ? newOpciones.split(',').map((o) => o.trim()).filter(Boolean)
        : null;
      await createPlantilla({
        tipo_equipo: newTipoEquipo,
        tipo_mantenimiento: newTipoMant,
        descripcion: newDesc.trim(),
        orden: nextOrden,
        tipo_campo: newTipoCampo,
        unidad: newTipoCampo === 'numero' && newUnidad.trim() ? newUnidad.trim() : null,
        opciones: opcionesArr,
        valor_min: newTipoCampo === 'numero' && newMin !== '' ? Number(newMin) : null,
        valor_max: newTipoCampo === 'numero' && newMax !== '' ? Number(newMax) : null,
        obligatorio: newObligatorio,
      });
      setNewDesc('');
      setNewUnidad('');
      setNewOpciones('');
      setNewMin('');
      setNewMax('');
      await loadPlantillas();
    } catch (err) {
      setPlantillaMsg(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setAddingPlantilla(false);
    }
  }

  async function handleDeletePlantilla(id: number) {
    if (!window.confirm('¿Eliminar este paso de plantilla?')) return;
    try {
      await deletePlantilla(id);
      await loadPlantillas();
    } catch (err) {
      setPlantillaMsg(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  const groupedPlantillas = plantillas.reduce<Record<string, Record<string, PlantillaPasoRow[]>>>((acc, p) => {
    if (!acc[p.tipo_equipo]) acc[p.tipo_equipo] = {};
    if (!acc[p.tipo_equipo][p.tipo_mantenimiento]) acc[p.tipo_equipo][p.tipo_mantenimiento] = [];
    acc[p.tipo_equipo][p.tipo_mantenimiento].push(p);
    return acc;
  }, {});

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Mantenimiento</p>
          <h1 className="mt-1 text-3xl font-bold">Configuración</h1>
        </div>

        <MantenimientosSubNav />

        {/* ── Frecuencias ──────────────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-200">Frecuencias de mantenimiento preventivo</h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Define cada cuántos meses se debe realizar el mantenimiento preventivo por tipo de equipo.
          </p>

          {configMsg && (
            <p className={`mb-4 rounded-md px-3 py-2 text-sm ${configMsgOk ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200'}`}>
              {configMsg}
            </p>
          )}

          {configLoading ? (
            <p className="text-slate-500">Cargando configuración...</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Tipo de equipo</th>
                    <th className="px-4 py-3">Tiene mantenimiento</th>
                    <th className="px-4 py-3 w-40">Frecuencia (meses)</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3 text-right">Guardar</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((c) => (
                    <tr key={c.tipo_equipo} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{c.tipo_equipo}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.tiene_mantenimiento ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'}`}>
                          {c.tiene_mantenimiento ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          max="120"
                          value={editFrecuencia[c.tipo_equipo] ?? c.frecuencia_meses}
                          onChange={(e) => setEditFrecuencia((prev) => ({ ...prev, [c.tipo_equipo]: Number(e.target.value) }))}
                          className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{c.descripcion ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => saveFrecuencia(c.tipo_equipo)}
                          disabled={configSaving === c.tipo_equipo}
                          className="rounded-md bg-cyan-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
                        >
                          {configSaving === c.tipo_equipo ? '...' : 'Guardar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Plantillas checklist ─────────────────────────────────────────── */}
        <section>
          <h2 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-200">Plantillas de checklist</h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Define los pasos estándar que se copian automáticamente al crear una orden de trabajo según tipo de equipo y tipo de mantenimiento.
          </p>

          {/* Formulario nueva plantilla */}
          <form onSubmit={handleAddPlantilla} className="mb-6 rounded-xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900/40 dark:bg-slate-900">
            <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Agregar paso a plantilla</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Tipo de equipo</label>
                <select
                  value={newTipoEquipo}
                  onChange={(e) => setNewTipoEquipo(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {tiposEquipo.map((t) => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Tipo mantenimiento</label>
                <select
                  value={newTipoMant}
                  onChange={(e) => setNewTipoMant(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {TIPOS_MANT.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-48 space-y-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Descripción del paso</label>
                <input
                  type="text"
                  placeholder="Ej: Limpiar filtros de aire..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Tipo de dato</label>
                <select
                  value={newTipoCampo}
                  onChange={(e) => setNewTipoCampo(e.target.value as typeof newTipoCampo)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="checkbox">Verificación (Sí/No)</option>
                  <option value="numero">Número / medición</option>
                  <option value="texto">Texto</option>
                  <option value="seleccion">Selección</option>
                </select>
              </div>
            </div>

            {/* Config extra según tipo de dato */}
            {(newTipoCampo === 'numero' || newTipoCampo === 'seleccion') && (
              <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-cyan-200 bg-white/60 p-3 dark:border-cyan-900/40 dark:bg-slate-800/40">
                {newTipoCampo === 'numero' && (
                  <>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Unidad</label>
                      <input
                        type="text"
                        placeholder="Ej: J, kg, °C, disparos"
                        value={newUnidad}
                        onChange={(e) => setNewUnidad(e.target.value)}
                        className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Mínimo aceptable</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="—"
                        value={newMin}
                        onChange={(e) => setNewMin(e.target.value)}
                        className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Máximo aceptable</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="—"
                        value={newMax}
                        onChange={(e) => setNewMax(e.target.value)}
                        className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Fuera de rango se marca en rojo al técnico.</p>
                  </>
                )}
                {newTipoCampo === 'seleccion' && (
                  <div className="flex-1 min-w-48 space-y-1">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Opciones (separadas por coma)</label>
                    <input
                      type="text"
                      placeholder="Ej: Operativo, Requiere ajuste, Fuera de servicio"
                      value={newOpciones}
                      onChange={(e) => setNewOpciones(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={newObligatorio}
                  onChange={(e) => setNewObligatorio(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600 dark:bg-slate-800"
                />
                Obligatorio (bloquea el cierre de la OT si queda vacío)
              </label>
              <button
                type="submit"
                disabled={addingPlantilla || !newDesc.trim() || !newTipoEquipo}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
              >
                {addingPlantilla ? 'Agregando...' : '+ Agregar'}
              </button>
            </div>
            {plantillaMsg && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{plantillaMsg}</p>}
          </form>

          {/* Filtros */}
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Filtrar por tipo de equipo</label>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Todos</option>
                {tiposEquipo.map((t) => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Filtrar por tipo mantenimiento</label>
              <select
                value={filterMant}
                onChange={(e) => setFilterMant(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Todos</option>
                {TIPOS_MANT.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {plantillasLoading ? (
            <p className="text-slate-500">Cargando plantillas...</p>
          ) : plantillas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
              No hay pasos de plantilla definidos.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedPlantillas).map(([tipoEquipo, byMant]) => (
                <div key={tipoEquipo} className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">{tipoEquipo}</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    {Object.entries(byMant).map(([tipoMant, pasos]) => (
                      <div key={tipoMant}>
                        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {tipoMant}
                          <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {pasos.length} paso{pasos.length !== 1 ? 's' : ''}
                          </span>
                        </h4>
                        <div className="space-y-1.5">
                          {pasos.map((paso, idx) => (
                            <div key={paso.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
                              <span className="text-xs font-medium text-slate-400 w-5 text-right">{idx + 1}</span>
                              <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                                {paso.descripcion}
                                {!paso.obligatorio && <span className="ml-1 text-xs text-slate-400">(opcional)</span>}
                              </span>
                              {paso.tipo_campo && paso.tipo_campo !== 'checkbox' && (
                                <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-medium text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300">
                                  {paso.tipo_campo === 'numero'
                                    ? `número${paso.unidad ? ` (${paso.unidad})` : ''}${paso.valor_min != null || paso.valor_max != null ? ` · ${paso.valor_min != null ? String(Number(paso.valor_min)) : '−∞'}–${paso.valor_max != null ? String(Number(paso.valor_max)) : '∞'}` : ''}`
                                    : paso.tipo_campo === 'seleccion'
                                      ? `selección (${paso.opciones?.length ?? 0})`
                                      : 'texto'}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeletePlantilla(paso.id)}
                                className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
