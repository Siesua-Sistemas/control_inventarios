"use client";

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { getEquipment, isAuthenticated, updateEquipment, type EquipmentPayload } from '@/lib/api';

const TIPOS = ['Portátil', 'Celular', 'Tablet', 'Cámara', 'Audífonos', 'Monitor', 'Impresora', 'Red', 'Accesorio', 'Servidor', 'Otro'];
const ESTADOS = ['Disponible', 'Asignado', 'En mantenimiento', 'Dañado', 'Prestado', 'En bodega', 'Perdido', 'Dado de baja'];

export default function EditarEquipoPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [form, setForm] = useState<EquipmentPayload | null>(null);
  const [codigoInterno, setCodigoInterno] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    getEquipment(id)
      .then((data) => {
        setCodigoInterno(data.codigo_interno);
        setForm({
          serial: data.serial,
          tipo: data.tipo,
          marca: data.marca,
          modelo: data.modelo,
          placa: data.placa,
          sede: data.sede,
          ubicacion: data.ubicacion,
          estado: data.estado,
          specs: data.specs,
          fecha_compra: data.fecha_compra,
          valor: data.valor,
          proveedor: data.proveedor,
          numero_factura: data.numero_factura,
          garantia_vence: data.garantia_vence,
          observaciones: data.observaciones,
          bodega_id: data.bodega_id,
          empleado_id: data.empleado_id,
          parent_equipment_id: data.parent_equipment_id,
        });
      })
      .catch(() => setError('No se pudo cargar el equipo'))
      .finally(() => setFetching(false));
  }, [id, router]);

  function set(field: keyof EquipmentPayload, value: string | null) {
    setForm((prev) => prev ? { ...prev, [field]: value === '' ? null : value } : prev);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setLoading(true);
    setError('');
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
          <p className="text-slate-400">Cargando equipo...</p>
        </main>
      </>
    );
  }

  if (!form) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-red-300">{error || 'Equipo no encontrado'}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Equipos</p>
          <h1 className="mt-1 text-3xl font-bold">Editar equipo</h1>
          <p className="mt-1 font-mono text-sm text-cyan-500">{codigoInterno}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          {/* Identificación */}
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-cyan-400">Identificación</h2>
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
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-cyan-400">Ubicación</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sede">Sede *</label>
                <input id="sede" value={form.sede} onChange={(e) => set('sede', e.target.value)} required />
              </div>
              <div>
                <label htmlFor="ubicacion">Ubicación física</label>
                <input id="ubicacion" value={form.ubicacion ?? ''} onChange={(e) => set('ubicacion', e.target.value)} placeholder="Ej: Estante 3, Oficina 201" />
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
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-cyan-400">Información financiera</h2>
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
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {error ? <p className="rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p> : null}

          <div className="flex gap-3">
            <button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar cambios'}</button>
            <button type="button" className="bg-slate-800 text-slate-100" onClick={() => router.push('/equipos')}>
              Cancelar
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
