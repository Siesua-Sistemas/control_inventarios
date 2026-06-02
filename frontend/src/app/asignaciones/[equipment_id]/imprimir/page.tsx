"use client";

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  getEquipmentProfile,
  isAuthenticated,
  listAsignacionesActivas,
  type AsignacionRow,
  type EquipmentBrief,
  type EquipmentProfile,
} from '@/lib/api';

export default function ImprimirAsignacionPage() {
  const { equipment_id } = useParams<{ equipment_id: string }>();
  const eqId = Number(equipment_id);
  const router = useRouter();

  const [asignacion, setAsignacion] = useState<AsignacionRow | null>(null);
  const [profile, setProfile] = useState<EquipmentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    Promise.all([
      listAsignacionesActivas(),
      getEquipmentProfile(eqId),
    ])
      .then(([activas, prof]) => {
        const found = activas.items.find((a) => a.equipment_id === eqId);
        if (!found) { setError('No hay asignación activa para este equipo.'); return; }
        setAsignacion(found);
        setProfile(prof);
      })
      .catch(() => setError('Error al cargar los datos.'))
      .finally(() => setLoading(false));
  }, [eqId, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-slate-800">
        <p>Cargando acta...</p>
      </main>
    );
  }

  if (error || !asignacion || !profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white text-slate-800">
        <p className="text-red-600">{error || 'Datos no encontrados'}</p>
        <button onClick={() => router.back()} className="text-blue-600 underline">Volver</button>
      </main>
    );
  }

  const eq = profile.equipment;
  const children: EquipmentBrief[] = profile.children;
  const fecha = new Date(asignacion.fecha).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const today = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const allEquipment = [
    { codigo: eq.codigo_interno, tipo: eq.tipo, marca: eq.marca, modelo: eq.modelo, serial: eq.serial, nota: 'Equipo principal' },
    ...children.map((c) => ({
      codigo: c.codigo_interno, tipo: c.tipo, marca: c.marca, modelo: c.modelo, serial: c.serial, nota: 'Periférico',
    })),
  ];

  return (
    <>
      {/* Print controls — hidden when printing */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-slate-900 px-6 py-3 shadow-lg">
        <button onClick={() => router.back()} className="rounded-md bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600">
          ← Volver
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          🖨 Imprimir / Guardar PDF
        </button>
      </div>

      {/* Acta — print-friendly layout */}
      <main className="min-h-screen bg-white px-12 py-10 pt-24 print:pt-10 text-slate-900 font-sans text-sm">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between border-b-2 border-slate-800 pb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Sistema de Control de Inventarios</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Acta de Entrega de Equipos</h1>
            <p className="mt-1 text-sm text-slate-600">Fecha de emisión: {today}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Sede</p>
            <p className="font-semibold">{eq.sede}</p>
            {eq.ubicacion && <p className="text-xs text-slate-500">{eq.ubicacion}</p>}
          </div>
        </div>

        {/* Empleado */}
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Datos del responsable</h2>
          <div className="grid grid-cols-3 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">Nombre completo</p>
              <p className="font-semibold">{asignacion.empleado_nombre ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Cédula</p>
              <p className="font-semibold">{asignacion.empleado_cedula ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Fecha de asignación</p>
              <p className="font-semibold">{fecha}</p>
            </div>
          </div>
        </section>

        {/* Equipment list */}
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Equipos entregados ({allEquipment.length})
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-4">Código</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Marca / Modelo</th>
                <th className="py-2 pr-4">Serial</th>
                <th className="py-2">Nota</th>
              </tr>
            </thead>
            <tbody>
              {allEquipment.map((item, i) => (
                <tr key={i} className={`border-b border-slate-200 ${i === 0 ? 'font-semibold' : ''}`}>
                  <td className="py-2 pr-4 font-mono text-xs">{item.codigo}</td>
                  <td className="py-2 pr-4">{item.tipo}</td>
                  <td className="py-2 pr-4">{item.marca} {item.modelo}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{item.serial}</td>
                  <td className="py-2 text-xs text-slate-500">{item.nota}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Observations */}
        {asignacion.observaciones && (
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Observaciones</h2>
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">{asignacion.observaciones}</p>
          </section>
        )}

        {/* Registrado por */}
        <p className="mb-10 text-xs text-slate-500">Registrado por: <span className="font-medium text-slate-700">{asignacion.created_by_nombre}</span></p>

        {/* Signatures */}
        <div className="mt-16 grid grid-cols-2 gap-16">
          <div className="text-center">
            <div className="mb-1 border-t border-slate-400"></div>
            <p className="text-xs text-slate-500">Firma quien entrega</p>
            <p className="mt-1 text-xs font-medium">{asignacion.created_by_nombre}</p>
          </div>
          <div className="text-center">
            <div className="mb-1 border-t border-slate-400"></div>
            <p className="text-xs text-slate-500">Firma quien recibe</p>
            <p className="mt-1 text-xs font-medium">{asignacion.empleado_nombre ?? '—'}</p>
          </div>
        </div>

        <p className="mt-12 text-center text-xs text-slate-400 print:block hidden">
          Documento generado el {today} — Sistema de Control de Inventarios
        </p>
      </main>
    </>
  );
}
