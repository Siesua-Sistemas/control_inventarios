"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { SignaturePad } from '@/components/signature-pad';
import {
  createActaEntrega,
  getEquipmentProfile,
  isAuthenticated,
  listAsignacionesActivas,
  type AsignacionRow,
  type EquipmentProfile,
} from '@/lib/api';

type Step = 'checklist' | 'firmas' | 'guardando' | 'listo';

interface EquipoItem {
  id: number;
  codigo: string;
  serial: string;
  tipo: string;
  marca: string;
  modelo: string;
  estado: string;
  nota: string;
}

import { ESTADO_COLORS } from '@/lib/constants';

function EntregaAsignacionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const empId = Number(searchParams.get('emp'));
  const eqsParam = searchParams.get('eqs') ?? '';
  const eqIds = eqsParam.split(',').map(Number).filter(Boolean);

  const [asignacion, setAsignacion] = useState<AsignacionRow | null>(null);
  const [equipos, setEquipos] = useState<EquipoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('checklist');

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [entregaNombre, setEntregaNombre] = useState('');
  const [recibeNombre, setRecibeNombre] = useState('');
  const [firmaEntrega, setFirmaEntrega] = useState<string | null>(null);
  const [firmaRecibe, setFirmaRecibe] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [actaId, setActaId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (!empId || eqIds.length === 0) { setError('Parámetros inválidos.'); setLoading(false); return; }

    listAsignacionesActivas()
      .then(async (activas) => {
        const matching = activas.items.filter(
          (a) => a.empleado_id === empId && eqIds.includes(a.equipment_id)
        );
        if (matching.length === 0) { setError('No se encontraron asignaciones activas.'); return; }
        setAsignacion(matching[0]);
        setEntregaNombre(matching[0].created_by_nombre ?? '');
        setRecibeNombre(matching[0].empleado_nombre ?? '');

        const items: EquipoItem[] = [];
        await Promise.all(
          matching.map(async (a) => {
            const profile: EquipmentProfile = await getEquipmentProfile(a.equipment_id);
            items.push({
              id: profile.equipment.id,
              codigo: a.equipment_codigo,
              serial: a.equipment_serial,
              tipo: a.equipment_tipo,
              marca: a.equipment_marca,
              modelo: a.equipment_modelo,
              estado: profile.equipment.estado,
              nota: 'Principal',
            });
            for (const c of profile.children) {
              items.push({
                id: c.id,
                codigo: c.codigo_interno,
                serial: c.serial,
                tipo: c.tipo,
                marca: c.marca,
                modelo: c.modelo,
                estado: c.estado,
                nota: 'Periférico',
              });
            }
          })
        );
        setEquipos(items);
      })
      .catch(() => setError('Error al cargar los datos.'))
      .finally(() => setLoading(false));
  }, [empId, eqsParam, router]);

  const allChecked = checked.size === equipos.length && equipos.length > 0;
  const today = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

  const toggleCheck = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const checkAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(equipos.map((e, i) => `${e.id}-${i}`)));
  };

  const handleGuardar = async () => {
    if (!entregaNombre.trim() || !recibeNombre.trim()) {
      setSaveError('Ingresa los nombres de quien entrega y quien recibe.');
      return;
    }
    setSaveError('');
    setStep('guardando');
    try {
      const snapshot = equipos.map((e) => ({
        id: e.id,
        codigo_interno: e.codigo,
        serial: e.serial,
        tipo: e.tipo,
        marca: e.marca,
        modelo: e.modelo,
        estado: e.estado,
      }));
      const acta = await createActaEntrega({
        tipo: 'asignacion',
        sede: asignacion?.equipment_sede ?? '',
        titulo: asignacion?.empleado_nombre ?? 'Empleado',
        entrega_nombre: entregaNombre.trim(),
        recibe_nombre: recibeNombre.trim(),
        firma_entrega: firmaEntrega ?? undefined,
        firma_recibe: firmaRecibe ?? undefined,
        equipos_snapshot: snapshot,
        empleado_id: empId,
        observaciones: observaciones.trim() || undefined,
      });
      setActaId(acta.id);
      setStep('listo');
    } catch {
      setSaveError('Error al guardar el acta. Intenta nuevamente.');
      setStep('firmas');
    }
  };

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" />
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen flex-col items-center justify-center gap-4">
          <p className="text-red-300">{error}</p>
          <button onClick={() => router.back()} className="text-indigo-400 hover:underline">← Volver</button>
        </main>
      </>
    );
  }

  if (step === 'listo' && actaId) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="mb-6 text-5xl">✅</div>
          <h1 className="text-2xl font-bold">Acta guardada</h1>
          <p className="mt-2 text-slate-400">El acta de entrega ha sido registrada correctamente.</p>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={`/actas/${actaId}/imprimir`}
              className="rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors"
            >
              🖨 Imprimir / Guardar PDF
            </Link>
            <Link
              href="/actas"
              className="rounded-lg border border-slate-700 bg-slate-800 px-6 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Ver historial de actas
            </Link>
            <Link href="/asignaciones" className="text-sm text-slate-500 hover:text-slate-300">
              ← Volver a asignaciones
            </Link>
          </div>
        </main>
      </>
    );
  }

  if (step === 'guardando') {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" />
            <p className="text-slate-400">Guardando acta...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">

        <div className="mb-6">
          <Link href="/asignaciones" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← Asignaciones
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Proceso de Entrega</h1>
          <p className="text-sm text-slate-400">
            {asignacion?.empleado_nombre} · {asignacion?.equipment_sede}
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8 flex items-center gap-0">
          {[
            { key: 'checklist', label: '1. Revisión' },
            { key: 'firmas', label: '2. Firmas' },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-0">
              {i > 0 && <div className={`h-px w-12 ${step === 'firmas' ? 'bg-indigo-500' : 'bg-slate-700'}`} />}
              <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                step === s.key
                  ? 'bg-indigo-600 text-white'
                  : step === 'firmas' && s.key === 'checklist'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {step === 'firmas' && s.key === 'checklist' ? '✓ ' : ''}
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ─── Paso 1: Checklist ─────────────────────────────────────────────── */}
        {step === 'checklist' && (
          <div className="rounded-2xl border border-slate-700 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-semibold">Revisión de equipos</p>
                <p className="text-xs text-slate-400 mt-0.5">Verifica y marca cada equipo antes de continuar</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">{checked.size}/{equipos.length}</span>
                <button
                  onClick={checkAll}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  {allChecked ? 'Desmarcar todo' : 'Marcar todo'}
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-800">
              {equipos.map((eq, i) => {
                const key = `${eq.id}-${i}`;
                const isChecked = checked.has(key);
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-4 px-6 py-4 transition-colors ${
                      isChecked ? 'bg-emerald-500/5' : 'hover:bg-slate-900'
                    } ${eq.nota !== 'Principal' ? 'pl-14' : ''}`}
                  >
                    {eq.nota !== 'Principal' && <span className="text-slate-600 text-xs mr-1">└</span>}
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(key)}
                      className="h-5 w-5 shrink-0 cursor-pointer rounded accent-emerald-500"
                    />
                    <div className="grid flex-1 grid-cols-4 gap-3 items-center min-w-0">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">Código</p>
                        <p className={`font-mono text-sm font-bold truncate ${eq.nota === 'Principal' ? 'text-cyan-400' : 'text-slate-400'}`}>
                          {eq.codigo}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">Tipo</p>
                        <p className="text-sm text-slate-300 truncate">{eq.tipo}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">Marca / Modelo</p>
                        <p className="text-sm font-semibold text-white truncate">{eq.marca} {eq.modelo}</p>
                      </div>
                      <div>
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ESTADO_COLORS[eq.estado] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                          {eq.estado}
                        </span>
                      </div>
                    </div>
                    {isChecked && <span className="shrink-0 text-emerald-400">✓</span>}
                  </label>
                );
              })}
            </div>

            <div className="bg-slate-950 border-t border-slate-800 px-6 py-4 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {allChecked
                  ? 'Todos los equipos revisados. Listo para continuar.'
                  : `Faltan ${equipos.length - checked.size} por revisar.`}
              </p>
              <button
                onClick={() => setStep('firmas')}
                disabled={!allChecked}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Continuar a firmas →
              </button>
            </div>
          </div>
        )}

        {/* ─── Paso 2: Firmas ────────────────────────────────────────────────── */}
        {step === 'firmas' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Datos del acta</p>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-slate-400">Quien entrega *</span>
                  <input
                    value={entregaNombre}
                    onChange={(e) => setEntregaNombre(e.target.value)}
                    placeholder="Nombre completo"
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-slate-400">Quien recibe *</span>
                  <input
                    value={recibeNombre}
                    onChange={(e) => setRecibeNombre(e.target.value)}
                    placeholder="Nombre completo"
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </label>
              </div>
              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-xs text-slate-400">Observaciones (opcional)</span>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={2}
                  placeholder="Novedades, estado, aclaraciones..."
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none resize-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                <SignaturePad label="Firma quien entrega" name={entregaNombre || '—'} onChange={setFirmaEntrega} />
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                <SignaturePad label="Firma quien recibe" name={recibeNombre || '—'} onChange={setFirmaRecibe} />
              </div>
            </div>

            {saveError && (
              <p className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-300">{saveError}</p>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep('checklist')}
                className="rounded-lg border border-slate-700 bg-slate-800 px-5 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
              >
                ← Volver al checklist
              </button>
              <button
                onClick={handleGuardar}
                className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
              >
                Confirmar y guardar acta ✓
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default function EntregaAsignacionPage() {
  return (
    <Suspense fallback={
      <><NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-slate-400">Cargando...</p>
        </main>
      </>
    }>
      <EntregaAsignacionContent />
    </Suspense>
  );
}
