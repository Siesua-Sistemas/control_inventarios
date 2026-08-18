"use client";

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DatePickerPresets } from '@/components/date-picker-presets';
import { NavBar } from '@/components/nav-bar';
import { getEquipment, isAuthenticated, listBodegas, listEquipmentTipos, updateEquipment, type BodegaRow, type EquipmentPayload, type EquipmentTipo } from '@/lib/api';

const ESTADOS = ['Disponible', 'Asignado', 'En mantenimiento', 'Dañado', 'Prestado', 'En bodega', 'Perdido', 'Dado de baja'];
const CRITICIDADES = ['Alta', 'Media', 'Baja'];
const DOMINIOS = ['IT', 'Bioingeniería', 'General'];

const fieldClass = 'flex flex-col gap-1.5';
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300';
const sectionTitle = 'flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-4';

export default function EditarEquipoPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [form, setForm] = useState<EquipmentPayload | null>(null);
  const [codigoInterno, setCodigoInterno] = useState('');
  const [allTipos, setAllTipos] = useState<EquipmentTipo[]>([]);
  const [allBodegas, setAllBodegas] = useState<BodegaRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const tipos = allTipos.filter((t) => !form || t.dominio === form.dominio);
  // Cada sede tiene una bodega por dominio (IT/Bioingeniería/General) con el mismo
  // nombre; filtrar por el dominio del equipo evita mostrarlas duplicadas.
  const bodegas = allBodegas.filter((b) => !form || b.dominio === form.dominio);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getEquipment(id)
      .then((data) => {
        setCodigoInterno(data.codigo_interno);
        setForm({
          serial: data.serial, tipo: data.tipo, marca: data.marca, modelo: data.modelo,
          placa: data.placa, sede: data.sede, ubicacion: data.ubicacion,
          estado: data.estado, criticidad: data.criticidad, dominio: data.dominio ?? 'IT', specs: data.specs,
          fecha_compra: data.fecha_compra, valor: data.valor,
          proveedor: data.proveedor, numero_factura: data.numero_factura,
          garantia_vence: data.garantia_vence, observaciones: data.observaciones,
          fecha_calibracion: data.fecha_calibracion,
          vencimiento_calibracion: data.vencimiento_calibracion,
          frecuencia_calibracion_meses: data.frecuencia_calibracion_meses,
          bodega_id: data.bodega_id, empleado_id: data.empleado_id,
          parent_equipment_id: data.parent_equipment_id,
        });
        listEquipmentTipos().then((r) => {
          setAllTipos(r.items.filter((t) => t.activo || t.nombre === data.tipo));
        }).catch(() => null);
        listBodegas().then((r) => setAllBodegas(r.items)).catch(() => null);
      })
      .catch(() => setError('No se pudo cargar el equipo'))
      .finally(() => setFetching(false));
  }, [id, router]);

  useEffect(() => {
    if (form?.bodega_id && !bodegas.some((b) => b.id === form.bodega_id)) {
      setForm((prev) => prev ? { ...prev, bodega_id: null } : prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.dominio, bodegas.length]);

  function set(field: keyof EquipmentPayload, value: string | null) {
    setForm((prev) => prev ? { ...prev, [field]: value === '' ? null : value } : prev);
  }

  function handleBodegaChange(bodegaId: string) {
    if (!bodegaId) {
      setForm((prev) => prev ? { ...prev, bodega_id: null } : prev);
      return;
    }
    const bodega = bodegas.find((b) => b.id === Number(bodegaId));
    if (bodega) {
      setForm((prev) => prev ? { ...prev, bodega_id: bodega.id, sede: bodega.sede } : prev);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setLoading(true); setError('');
    try {
      await updateEquipment(id, form);
      router.push('/equipos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el equipo');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500" />
        </main>
      </>
    );
  }

  const selectedBodega = bodegas.find((b) => b.id === form?.bodega_id);

  if (!form) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-red-600 dark:text-red-300">{error || 'Equipo no encontrado'}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Equipos</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Editar equipo</h1>
          <p className="mt-1 font-mono text-sm text-cyan-600 dark:text-cyan-500">{codigoInterno}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">

          {/* Identificación */}
          <section className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className={sectionTitle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5" />
              </svg>
              Identificación
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className={fieldClass}>
                <label htmlFor="serial" className={labelClass}>Serial *</label>
                <input id="serial" className="w-full" value={form.serial} onChange={(e) => set('serial', e.target.value)} required />
              </div>
              <div className={fieldClass}>
                <label htmlFor="tipo" className={labelClass}>Tipo *</label>
                <select id="tipo" className="w-full" value={form.tipo} onChange={(e) => set('tipo', e.target.value)} required>
                  {tipos.map((t) => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                </select>
              </div>
              <div className={fieldClass}>
                <label htmlFor="marca" className={labelClass}>Marca *</label>
                <input id="marca" className="w-full" value={form.marca} onChange={(e) => set('marca', e.target.value)} required />
              </div>
              <div className={fieldClass}>
                <label htmlFor="modelo" className={labelClass}>Modelo *</label>
                <input id="modelo" className="w-full" value={form.modelo} onChange={(e) => set('modelo', e.target.value)} required />
              </div>
              <div className={fieldClass}>
                <label htmlFor="placa" className={labelClass}>Placa interna</label>
                <input id="placa" className="w-full" value={form.placa ?? ''} onChange={(e) => set('placa', e.target.value)} />
              </div>
              <div className={fieldClass}>
                <label htmlFor="dominio" className={labelClass}>Dominio *</label>
                <select id="dominio" className="w-full" value={form.dominio} onChange={(e) => set('dominio', e.target.value)} required>
                  {DOMINIOS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Ubicación */}
          <section className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className={sectionTitle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              Ubicación
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className={`${fieldClass} sm:col-span-2`}>
                <label htmlFor="bodega" className={labelClass}>Bodega</label>
                <select
                  id="bodega"
                  className="w-full"
                  value={form.bodega_id ?? ''}
                  onChange={(e) => handleBodegaChange(e.target.value)}
                >
                  <option value="">— Sin bodega (equipo asignado a un empleado) —</option>
                  {bodegas.map((b) => (
                    <option key={b.id} value={b.id}>{b.nombre} · {b.sede}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sede: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedBodega ? selectedBodega.sede : form.sede || '—'}</span>
                </p>
              </div>
              <div className={fieldClass}>
                <label htmlFor="ubicacion" className={labelClass}>Ubicación física</label>
                <input id="ubicacion" className="w-full" value={form.ubicacion ?? ''} onChange={(e) => set('ubicacion', e.target.value)} placeholder="Ej: Estante 3, Oficina 201" />
              </div>
              <div className={fieldClass}>
                <label htmlFor="estado" className={labelClass}>Estado *</label>
                <select id="estado" className="w-full" value={form.estado} onChange={(e) => set('estado', e.target.value)} required>
                  {ESTADOS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className={fieldClass}>
                <label htmlFor="criticidad" className={labelClass}>Criticidad *</label>
                <select id="criticidad" className="w-full" value={form.criticidad ?? 'Media'} onChange={(e) => set('criticidad', e.target.value)} required>
                  {CRITICIDADES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Información financiera */}
          <section className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className={sectionTitle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" />
              </svg>
              Información financiera
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className={fieldClass}>
                <label htmlFor="fecha_compra" className={labelClass}>Fecha de compra</label>
                <input id="fecha_compra" className="w-full" type="date" value={form.fecha_compra ?? ''} onChange={(e) => set('fecha_compra', e.target.value)} />
              </div>
              <div className={fieldClass}>
                <label htmlFor="valor" className={labelClass}>Valor</label>
                <input id="valor" className="w-full" type="number" min="0" step="0.01" value={form.valor ?? ''} onChange={(e) => set('valor', e.target.value)} />
              </div>
              <div className={fieldClass}>
                <label htmlFor="proveedor" className={labelClass}>Proveedor</label>
                <input id="proveedor" className="w-full" value={form.proveedor ?? ''} onChange={(e) => set('proveedor', e.target.value)} />
              </div>
              <div className={fieldClass}>
                <label htmlFor="numero_factura" className={labelClass}>N° Factura</label>
                <input id="numero_factura" className="w-full" value={form.numero_factura ?? ''} onChange={(e) => set('numero_factura', e.target.value)} />
              </div>
              <div className={fieldClass}>
                <label htmlFor="garantia_vence" className={labelClass}>Garantía vence</label>
                <DatePickerPresets id="garantia_vence" value={form.garantia_vence ?? ''} onChange={(v) => set('garantia_vence', v)} />
              </div>
            </div>
          </section>

          {/* Calibración */}
          <section className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className={sectionTitle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Calibración / Metrología
            </h2>
            <div className="grid gap-5 sm:grid-cols-3">
              <div className={fieldClass}>
                <label htmlFor="fecha_calibracion" className={labelClass}>Última calibración</label>
                <input id="fecha_calibracion" className="w-full" type="date" value={form.fecha_calibracion ?? ''} onChange={(e) => set('fecha_calibracion', e.target.value)} />
              </div>
              <div className={fieldClass}>
                <label htmlFor="vencimiento_calibracion" className={labelClass}>Vencimiento calibración</label>
                <DatePickerPresets id="vencimiento_calibracion" value={form.vencimiento_calibracion ?? ''} onChange={(v) => set('vencimiento_calibracion', v)} />
              </div>
              <div className={fieldClass}>
                <label htmlFor="frecuencia_calibracion_meses" className={labelClass}>Recalibrar cada (meses)</label>
                <input
                  id="frecuencia_calibracion_meses"
                  className="w-full"
                  type="number" min="1" max="120"
                  value={form.frecuencia_calibracion_meses ?? ''}
                  onChange={(e) => setForm((prev) => prev ? { ...prev, frecuencia_calibracion_meses: e.target.value ? Number(e.target.value) : null } : prev)}
                  placeholder="Ej: 12"
                />
              </div>
            </div>
          </section>

          {/* Observaciones + acciones */}
          <section className="p-6 space-y-5">
            <div className={fieldClass}>
              <label htmlFor="observaciones" className={labelClass}>Observaciones</label>
              <textarea
                id="observaciones"
                rows={3}
                value={form.observaciones ?? ''}
                onChange={(e) => set('observaciones', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-orange-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
              >
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                onClick={() => router.push('/equipos')}
              >
                Cancelar
              </button>
            </div>
          </section>
        </form>
      </main>
    </>
  );
}
