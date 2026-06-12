"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { createEquipment, isAuthenticated, listBodegas, type BodegaRow, type EquipmentPayload } from '@/lib/api';

const TIPOS = ['Portátil', 'Celular', 'Tablet', 'Cámara', 'Audífonos', 'Monitor', 'Impresora', 'Red', 'Accesorio', 'Servidor', 'Otro'];
const ESTADOS = ['Disponible', 'En bodega', 'En mantenimiento', 'Dañado', 'Prestado', 'Perdido', 'Dado de baja'];

const EMPTY: EquipmentPayload = {
  serial: '', tipo: 'Portátil', marca: '', modelo: '',
  placa: null, sede: '', ubicacion: null,
  bodega_id: null, empleado_id: null, parent_equipment_id: null, specs: null,
  estado: 'Disponible', fecha_compra: null, valor: null,
  proveedor: null, numero_factura: null, garantia_vence: null, observaciones: null,
};

export default function NuevoEquipoPage() {
  const router = useRouter();
  const [form, setForm] = useState<EquipmentPayload>(EMPTY);
  const [bodegas, setBodegas] = useState<BodegaRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    listBodegas().then((r) => setBodegas(r.items)).catch(() => null);
  }, [router]);

  function set(field: keyof EquipmentPayload, value: string | null) {
    setForm((prev) => ({ ...prev, [field]: value === '' ? null : value }));
  }

  function handleBodegaChange(bodegaId: string) {
    if (!bodegaId) {
      setForm((prev) => ({ ...prev, bodega_id: null, sede: '', estado: 'Disponible' }));
      return;
    }
    const bodega = bodegas.find((b) => b.id === Number(bodegaId));
    if (bodega) {
      setForm((prev) => ({ ...prev, bodega_id: bodega.id, sede: bodega.sede, estado: 'En bodega' }));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.bodega_id) { setError('Debes seleccionar una bodega'); return; }
    setLoading(true); setError('');
    try {
      await createEquipment(form);
      router.push('/equipos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el equipo');
    } finally {
      setLoading(false);
    }
  }

  const selectedBodega = bodegas.find((b) => b.id === form.bodega_id);

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Equipos</p>
          <h1 className="mt-1 text-3xl font-bold">Nuevo equipo</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          {/* Identificación */}
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">Identificación</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="serial">Serial *</label>
                <input id="serial" value={form.serial} onChange={(e) => set('serial', e.target.value)} required />
              </div>
             
              <div>
                <label htmlFor="tipo">Tipo *</label>
                <select id="tipo" value={form.tipo} onChange={(e) => set('tipo', e.target.value)} required>
                  {TIPOS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="marca">Marca *</label>
                <input id="marca" value={form.marca} onChange={(e) => set('marca', e.target.value)} required />
              </div>
              <div>
                <label htmlFor="modelo">Modelo *</label>
                <input id="modelo" value={form.modelo} onChange={(e) => set('modelo', e.target.value)} required />
              </div>
              
              <div>
                <label htmlFor="placa">Placa interna</label>
                <input id="placa" value={form.placa ?? ''} onChange={(e) => set('placa', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Ubicación */}
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">Ubicación</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="bodega">Bodega *</label>
                <select
                  id="bodega"
                  value={form.bodega_id ?? ''}
                  onChange={(e) => handleBodegaChange(e.target.value)}
                  required
                >
                  <option value="">— Selecciona bodega —</option>
                  {bodegas.map((b) => (
                    <option key={b.id} value={b.id}>{b.nombre} · {b.sede}</option>
                  ))}
                </select>
              </div>
              {selectedBodega && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-500">Sede: <span className="text-slate-700 dark:text-slate-300">{selectedBodega.sede}</span></p>
                </div>
              )}
              <div>
                <label htmlFor="ubicacion">Ubicación física</label>
                <input
                  id="ubicacion"
                  value={form.ubicacion ?? ''}
                  onChange={(e) => set('ubicacion', e.target.value)}
                  placeholder="Ej: Estante 3, Oficina 201"
                />
              </div>
              <div>
                <label htmlFor="estado">Estado *</label>
                <select id="estado" value={form.estado} onChange={(e) => set('estado', e.target.value)} required>
                  {ESTADOS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Información financiera */}
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">Información financiera</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="fecha_compra">Fecha de compra</label>
                <input id="fecha_compra" type="date" value={form.fecha_compra ?? ''} onChange={(e) => set('fecha_compra', e.target.value)} />
              </div>
              <div>
                <label htmlFor="valor">Valor</label>
                <input id="valor" type="number" min="0" step="0.01" value={form.valor ?? ''} onChange={(e) => set('valor', e.target.value)} />
              </div>
              <div>
                <label htmlFor="proveedor">Proveedor</label>
                <input id="proveedor" value={form.proveedor ?? ''} onChange={(e) => set('proveedor', e.target.value)} />
              </div>
              <div>
                <label htmlFor="numero_factura">N° Factura</label>
                <input id="numero_factura" value={form.numero_factura ?? ''} onChange={(e) => set('numero_factura', e.target.value)} />
              </div>
              <div>
                <label htmlFor="garantia_vence">Garantía vence</label>
                <input id="garantia_vence" type="date" value={form.garantia_vence ?? ''} onChange={(e) => set('garantia_vence', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Observaciones */}
          <div>
            <label htmlFor="observaciones">Observaciones</label>
            <textarea
              id="observaciones"
              rows={3}
              value={form.observaciones ?? ''}
              onChange={(e) => set('observaciones', e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-cyan-400"
            />
          </div>

          {error && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400">{loading ? 'Guardando...' : 'Crear equipo'}</button>
            <button type="button" className="bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700" onClick={() => router.push('/equipos')}>
              Cancelar
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
