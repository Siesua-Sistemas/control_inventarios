"use client";

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { getBodegaInventario, isAuthenticated, type BodegaInventario } from '@/lib/api';

function ImprimirBodegaContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<BodegaInventario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entrega, setEntrega] = useState(searchParams.get('entrega') ?? '');
  const [recibe, setRecibe] = useState(searchParams.get('recibe') ?? '');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getBodegaInventario(Number(id))
      .then((d) => {
        setData(d);
        if (!entrega && d.bodega.responsable) setEntrega(d.bodega.responsable);
      })
      .catch(() => setError('Error al cargar el inventario.'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-slate-500">Cargando inventario...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white">
        <p className="text-red-600">{error || 'Error al cargar los datos'}</p>
        <button onClick={() => router.back()} className="text-blue-600 underline">Volver</button>
      </main>
    );
  }

  const equiposPorTipo = data.equipos.reduce<Record<string, typeof data.equipos>>((acc, eq) => {
    if (!acc[eq.tipo]) acc[eq.tipo] = [];
    acc[eq.tipo].push(eq);
    return acc;
  }, {});

  return (
    <>
      {/* Barra de controles — se oculta al imprimir */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex flex-wrap items-center gap-3 bg-slate-900 px-6 py-3 shadow-lg">
        <button
          onClick={() => router.back()}
          className="rounded-md bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600"
        >
          ← Volver
        </button>
        <div className="flex flex-1 flex-wrap items-end gap-3">
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500">Asesora que entrega</span>
            <input
              value={entrega}
              onChange={(e) => setEntrega(e.target.value)}
              placeholder="Nombre de quien entrega"
              className="w-52 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500">Asesora que recibe</span>
            <input
              value={recibe}
              onChange={(e) => setRecibe(e.target.value)}
              placeholder="Nombre de quien recibe"
              className="w-52 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </label>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          🖨 Imprimir / Guardar PDF
        </button>
      </div>

      {/* Acta imprimible */}
      <main className="min-h-screen bg-white px-12 py-10 pt-28 print:pt-10 text-slate-900 font-sans text-sm">

        {/* Encabezado */}
        <div className="mb-8 flex items-start justify-between border-b-2 border-slate-800 pb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Sistema de Control de Inventarios</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Acta de Entrega de SEDE</h1>
            <p className="mt-1 text-sm capitalize text-slate-600">{today}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Sede</p>
            <p className="font-semibold">{data.bodega.sede}</p>
            <p className="mt-0.5 text-base font-bold">{data.bodega.nombre}</p>
          </div>
        </div>

        {/* Responsables */}
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Responsables del acta</h2>
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">Asesora que entrega</p>
              <p className="mt-0.5 font-semibold">{entrega || '___________________________'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Asesora que recibe</p>
              <p className="mt-0.5 font-semibold">{recibe || '___________________________'}</p>
            </div>
          </div>
        </section>

        {/* Resumen */}
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Resumen del inventario</h2>
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(data.por_tipo).map(([tipo, count]) => (
              <span key={tipo} className="rounded border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium">
                {tipo}: <strong>{count}</strong>
              </span>
            ))}
            <span className="rounded border border-slate-800 bg-slate-800 px-3 py-1 text-xs font-bold text-white">
              Total: {data.total} equipos
            </span>
          </div>
        </section>

        {/* Inventario agrupado por tipo */}
        {Object.entries(equiposPorTipo).map(([tipo, equipos]) => (
          <section key={tipo} className="mb-6 break-inside-avoid">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              {tipo} <span className="font-normal text-slate-400">({equipos.length})</span>
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-1.5 pr-4">#</th>
                  <th className="py-1.5 pr-4">Código</th>
                  <th className="py-1.5 pr-4">Serial</th>
                  <th className="py-1.5 pr-4">Marca / Modelo</th>
                  <th className="py-1.5">Estado</th>
                </tr>
              </thead>
              <tbody>
                {equipos.map((eq, i) => (
                  <tr key={eq.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 text-slate-400">{i + 1}</td>
                    <td className="py-1.5 pr-4 font-mono text-xs">{eq.codigo_interno}</td>
                    <td className="py-1.5 pr-4 font-mono text-xs text-slate-500">{eq.serial}</td>
                    <td className="py-1.5 pr-4">{eq.marca} {eq.modelo}</td>
                    <td className="py-1.5 text-xs text-slate-600">{eq.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        {/* Firmas */}
        <div className="mt-16 grid grid-cols-2 gap-16">
          <div className="text-center">
            <div className="mb-2 border-t border-slate-400" />
            <p className="text-xs text-slate-500">Firma quien entrega</p>
            <p className="mt-1 text-xs font-medium text-slate-700">{entrega || '___________________________'}</p>
          </div>
          <div className="text-center">
            <div className="mb-2 border-t border-slate-400" />
            <p className="text-xs text-slate-500">Firma quien recibe</p>
            <p className="mt-1 text-xs font-medium text-slate-700">{recibe || '___________________________'}</p>
          </div>
        </div>

        <p className="mt-12 hidden text-center text-xs text-slate-400 print:block">
          Documento generado el {today} — Sistema de Control de Inventarios
        </p>
      </main>
    </>
  );
}

export default function ImprimirBodegaPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-slate-500">Cargando...</p>
      </main>
    }>
      <ImprimirBodegaContent />
    </Suspense>
  );
}
