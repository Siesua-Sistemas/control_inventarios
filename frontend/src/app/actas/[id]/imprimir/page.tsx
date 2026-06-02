"use client";

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getActa, isAuthenticated, type ActaEntregaRow } from '@/lib/api';

export default function ImprimirActaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [acta, setActa] = useState<ActaEntregaRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getActa(Number(id))
      .then(setActa)
      .catch(() => setError('No se encontró el acta.'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-slate-500">Cargando acta...</p>
      </main>
    );
  }

  if (error || !acta) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white">
        <p className="text-red-600">{error || 'Error'}</p>
        <button onClick={() => router.back()} className="text-blue-600 underline">Volver</button>
      </main>
    );
  }

  const fecha = new Date(acta.fecha).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const TIPO_LABEL: Record<string, string> = {
    bodega: 'Acta de Entrega de Sede',
    asignacion: 'Acta de Entrega de Equipos',
  };

  return (
    <>
      {/* Controles — se ocultan al imprimir */}
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

      {/* Acta */}
      <main className="min-h-screen bg-white px-12 py-10 pt-24 print:pt-10 text-slate-900 font-sans text-sm">

        {/* Encabezado */}
        <div className="mb-8 flex items-start justify-between border-b-2 border-slate-800 pb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Sistema de Control de Inventarios</p>
            <h1 className="mt-1 text-2xl font-bold">{TIPO_LABEL[acta.tipo] ?? 'Acta de Entrega'}</h1>
            <p className="mt-1 text-sm capitalize text-slate-600">{fecha}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Sede</p>
            <p className="font-semibold">{acta.sede}</p>
            <p className="mt-0.5 text-base font-bold">{acta.titulo}</p>
          </div>
        </div>

        {/* Responsables */}
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Responsables</h2>
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">Quien entrega</p>
              <p className="mt-0.5 font-semibold">{acta.entrega_nombre}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Quien recibe</p>
              <p className="mt-0.5 font-semibold">{acta.recibe_nombre}</p>
            </div>
          </div>
        </section>

        {/* Equipos */}
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Equipos ({acta.total_equipos})
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Código</th>
                <th className="py-2 pr-4">Serial</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Marca / Modelo</th>
                <th className="py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {acta.equipos_snapshot.map((eq, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="py-2 pr-4 text-slate-400">{i + 1}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{eq.codigo_interno}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-500">{eq.serial}</td>
                  <td className="py-2 pr-4">{eq.tipo}</td>
                  <td className="py-2 pr-4">{eq.marca} {eq.modelo}</td>
                  <td className="py-2 text-xs">{eq.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Observaciones */}
        {acta.observaciones && (
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Observaciones</h2>
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">{acta.observaciones}</p>
          </section>
        )}

        {/* Firmas */}
        <div className="mt-12 grid grid-cols-2 gap-16">
          <div className="text-center">
            {acta.firma_entrega ? (
              <img src={acta.firma_entrega} alt="Firma quien entrega" className="mx-auto mb-2 h-24 w-auto object-contain" />
            ) : (
              <div className="mb-2 h-24 border-b border-slate-400" />
            )}
            <p className="text-xs text-slate-500">Firma quien entrega</p>
            <p className="mt-1 text-xs font-medium">{acta.entrega_nombre}</p>
          </div>
          <div className="text-center">
            {acta.firma_recibe ? (
              <img src={acta.firma_recibe} alt="Firma quien recibe" className="mx-auto mb-2 h-24 w-auto object-contain" />
            ) : (
              <div className="mb-2 h-24 border-b border-slate-400" />
            )}
            <p className="text-xs text-slate-500">Firma quien recibe</p>
            <p className="mt-1 text-xs font-medium">{acta.recibe_nombre}</p>
          </div>
        </div>

        {acta.created_by_nombre && (
          <p className="mt-8 text-xs text-slate-400">
            Registrado por: <span className="font-medium text-slate-600">{acta.created_by_nombre}</span>
            {' · '}Acta #{acta.id}
          </p>
        )}

        <p className="mt-4 hidden text-center text-xs text-slate-400 print:block">
          Documento generado — Sistema de Control de Inventarios · Acta #{acta.id}
        </p>
      </main>
    </>
  );
}
