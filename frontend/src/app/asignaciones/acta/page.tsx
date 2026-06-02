"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import {
  getEquipmentProfile,
  isAuthenticated,
  listAsignacionesActivas,
  type AsignacionRow,
  type EquipmentProfile,
} from '@/lib/api';

interface EquipmentEntry {
  asignacion: AsignacionRow;
  profile: EquipmentProfile;
}

interface FlatItem {
  codigo: string;
  tipo: string;
  marca: string;
  modelo: string;
  serial: string;
  isPrimary: boolean;
}

function ActaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const empId = Number(searchParams.get('emp'));
  const eqsParam = searchParams.get('eqs') ?? '';
  const eqIds = eqsParam.split(',').map(Number).filter(Boolean);

  const [entries, setEntries] = useState<EquipmentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (!empId || eqIds.length === 0) { setError('Parámetros inválidos.'); setLoading(false); return; }

    listAsignacionesActivas()
      .then(async (activas) => {
        const matching = activas.items.filter(
          (a) => a.empleado_id === empId && eqIds.includes(a.equipment_id)
        );
        if (matching.length === 0) {
          setError('No se encontraron asignaciones activas para estos equipos.');
          return;
        }
        const results = await Promise.all(
          matching.map(async (a) => {
            const profile = await getEquipmentProfile(a.equipment_id);
            return { asignacion: a, profile };
          })
        );
        setEntries(results);
      })
      .catch(() => setError('Error al cargar los datos.'))
      .finally(() => setLoading(false));
  }, [empId, eqsParam]);

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" />
            <p className="text-slate-400">Generando acta...</p>
          </div>
        </main>
      </>
    );
  }

  if (error || entries.length === 0) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen flex-col items-center justify-center gap-4">
          <p className="rounded-md bg-red-500/20 px-4 py-2 text-sm text-red-300">{error || 'Sin datos'}</p>
          <Link href="/asignaciones" className="text-indigo-400 hover:underline">← Volver a asignaciones</Link>
        </main>
      </>
    );
  }

  const firstA = entries[0].asignacion;
  const empleadoNombre = firstA.empleado_nombre ?? '—';
  const empleadoCedula = firstA.empleado_cedula ?? '—';
  const fecha = new Date(firstA.fecha).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const today = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const allItems: FlatItem[] = [];
  for (const { asignacion: a, profile } of entries) {
    allItems.push({
      codigo: a.equipment_codigo,
      tipo: a.equipment_tipo,
      marca: a.equipment_marca,
      modelo: a.equipment_modelo,
      serial: a.equipment_serial,
      isPrimary: true,
    });
    for (const c of profile.children) {
      allItems.push({
        codigo: c.codigo_interno,
        tipo: c.tipo,
        marca: c.marca,
        modelo: c.modelo,
        serial: c.serial,
        isPrimary: false,
      });
    }
  }

  const primaryCount = allItems.filter((i) => i.isPrimary).length;
  const peripheralCount = allItems.filter((i) => !i.isPrimary).length;

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">

        {/* Top bar */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/asignaciones" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              ← Asignaciones
            </Link>
            <h1 className="mt-1 text-2xl font-bold">Acta de Entrega</h1>
            <p className="text-sm text-slate-400">Emitida el {today}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/asignaciones/entrega?emp=${empId}&eqs=${eqIds.join(',')}`}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              Iniciar Entrega →
            </Link>
            <Link
              href={`/asignaciones/${eqIds[0]}/imprimir`}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
            >
              🖨 Imprimir
            </Link>
          </div>
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-slate-700 overflow-hidden shadow-xl">

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-950 to-slate-900 border-b border-indigo-900/50 px-8 py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">Acta de entrega de equipos</p>
                <h2 className="mt-2 text-xl font-bold text-white capitalize">{fecha}</h2>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-300">
                  {allItems.length} {allItems.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </div>
            </div>
          </div>

          {/* Employee */}
          <div className="bg-slate-800/50 border-b border-slate-700 px-8 py-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Responsable del equipo
            </p>
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Nombre completo</p>
                <p className="text-lg font-bold text-white">{empleadoNombre}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Cédula de ciudadanía</p>
                <p className="text-lg font-bold text-white">{empleadoCedula}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Sede</p>
                <p className="text-base font-semibold text-slate-200">{entries[0].profile.equipment.sede}</p>
              </div>
            </div>
            {firstA.observaciones && (
              <p className="mt-3 text-sm text-amber-200/60 italic">"{firstA.observaciones}"</p>
            )}
          </div>

          {/* Equipment table */}
          <div className="bg-slate-900 px-8 py-6">
            <div className="mb-4 flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Equipos entregados</p>
              {peripheralCount > 0 && (
                <span className="text-xs text-slate-500">
                  {primaryCount} principal{primaryCount !== 1 ? 'es' : ''} + {peripheralCount} periférico{peripheralCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              {allItems.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-4 rounded-xl px-4 py-3 transition-colors ${
                    item.isPrimary
                      ? 'bg-slate-800 border border-slate-700'
                      : 'bg-slate-800/40 border border-slate-800 ml-6'
                  }`}
                >
                  {!item.isPrimary && (
                    <span className="text-slate-600 text-xs">└</span>
                  )}
                  <div className="grid flex-1 grid-cols-4 gap-3 items-center min-w-0">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 mb-0.5">Código</p>
                      <p className={`font-mono text-sm font-bold truncate ${item.isPrimary ? 'text-cyan-400' : 'text-slate-400'}`}>
                        {item.codigo}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 mb-0.5">Tipo</p>
                      <p className="text-sm text-slate-300 truncate">{item.tipo}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 mb-0.5">Marca / Modelo</p>
                      <p className="text-sm font-semibold text-white truncate">{item.marca} {item.modelo}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 mb-0.5">Serial</p>
                      <p className="font-mono text-xs text-slate-400 truncate">{item.serial}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    item.isPrimary
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {item.isPrimary ? 'Principal' : 'Periférico'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-950 border-t border-slate-800 px-8 py-4 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Registrado por: <span className="font-medium text-slate-300">{firstA.created_by_nombre}</span>
            </p>
            <p className="text-xs text-slate-600">
              Acta #{firstA.id} · {new Date(firstA.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-8 grid grid-cols-2 gap-6">
          {[
            { label: 'Quien entrega', name: firstA.created_by_nombre, icon: '✍' },
            { label: 'Quien recibe', name: empleadoNombre, icon: '✍' },
          ].map(({ label, name, icon }) => (
            <div key={label} className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-8 text-center">
              <div className="mx-auto mb-4 h-14 w-full max-w-[160px] border-b border-slate-600" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{icon} {label}</p>
              <p className="mt-1.5 text-sm font-medium text-slate-200">{name}</p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="mt-6 text-center text-xs text-slate-600">
          Este documento es un registro digital del acta de entrega. Para la versión física, use la opción "Imprimir / PDF".
        </p>

      </main>
    </>
  );
}

export default function ActaPage() {
  return (
    <Suspense fallback={
      <><NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-slate-400">Cargando...</p>
        </main>
      </>
    }>
      <ActaContent />
    </Suspense>
  );
}
