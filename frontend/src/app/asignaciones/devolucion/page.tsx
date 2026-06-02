"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { SignaturePad } from '@/components/signature-pad';
import {
  createActaEntrega,
  devolver,
  getEquipmentProfile,
  isAuthenticated,
  listAsignacionesActivas,
  listBodegas,
  type AsignacionRow,
  type BodegaRow,
  type EquipmentProfile,
} from '@/lib/api';
import { ESTADO_COLORS } from '@/lib/constants';

type Step = 'checklist' | 'firmas' | 'procesando' | 'listo';

interface EquipoItem {
  id: number;
  codigo: string;
  serial: string;
  tipo: string;
  marca: string;
  modelo: string;
  estado: string;
  esPrincipal: boolean;
}

function DevolucionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const equipoId = Number(searchParams.get('eq'));

  const [profile, setProfile] = useState<EquipmentProfile | null>(null);
  const [asignacion, setAsignacion] = useState<AsignacionRow | null>(null);
  const [bodegas, setBodegas] = useState<BodegaRow[]>([]);
  const [equipos, setEquipos] = useState<EquipoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('checklist');

  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [bodegaDestinoId, setBodegaDestinoId] = useState('');
  const [entregaNombre, setEntregaNombre] = useState('');
  const [recibeNombre, setRecibeNombre] = useState('');
  const [firmaEntrega, setFirmaEntrega] = useState<string | null>(null);
  const [firmaRecibe, setFirmaRecibe] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [actaId, setActaId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (!equipoId) { setError('Parámetro de equipo inválido.'); setLoading(false); return; }

    Promise.all([
      getEquipmentProfile(equipoId),
      listAsignacionesActivas(),
      listBodegas(),
    ])
      .then(([prof, activas, bods]) => {
        setProfile(prof);
        setBodegas(bods.items);

        const asig = activas.items.find((a) => a.equipment_id === equipoId);
        if (!asig) { setError('Este equipo no tiene asignación activa.'); return; }
        setAsignacion(asig);
        setEntregaNombre(asig.empleado_nombre ?? '');
        setRecibeNombre(asig.created_by_nombre ?? '');

        const items: EquipoItem[] = [
          {
            id: prof.equipment.id,
            codigo: prof.equipment.codigo_interno,
            serial: prof.equipment.serial,
            tipo: prof.equipment.tipo,
            marca: prof.equipment.marca,
            modelo: prof.equipment.modelo,
            estado: prof.equipment.estado,
            esPrincipal: true,
          },
          ...prof.children.map((c) => ({
            id: c.id,
            codigo: c.codigo_interno,
            serial: c.serial,
            tipo: c.tipo,
            marca: c.marca,
            modelo: c.modelo,
            estado: c.estado,
            esPrincipal: false,
          })),
        ];
        setEquipos(items);
      })
      .catch(() => setError('Error al cargar los datos del equipo.'))
      .finally(() => setLoading(false));
  }, [equipoId, router]);

  const allChecked = checked.size === equipos.length && equipos.length > 0;

  const toggleCheck = (id: number) => setChecked((p) => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const checkAll = () => {
    allChecked ? setChecked(new Set()) : setChecked(new Set(equipos.map((e) => e.id)));
  };

  const handleGuardar = async () => {
    if (!entregaNombre.trim() || !recibeNombre.trim()) {
      setSaveError('Ingresa los nombres de quien entrega y quien recibe.');
      return;
    }
    setSaveError('');
    setStep('procesando');

    try {
      // 1. Registrar devolución en DB
      await devolver({
        equipment_id: equipoId,
        bodega_destino_id: bodegaDestinoId ? Number(bodegaDestinoId) : undefined,
        observaciones: observaciones.trim() || undefined,
      });

      // 2. Crear acta firmada
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
        tipo: 'devolucion',
        sede: profile?.equipment.sede ?? '',
        titulo: asignacion?.empleado_nombre ?? 'Empleado',
        entrega_nombre: entregaNombre.trim(),
        recibe_nombre: recibeNombre.trim(),
        firma_entrega: firmaEntrega ?? undefined,
        firma_recibe: firmaRecibe ?? undefined,
        equipos_snapshot: snapshot,
        empleado_id: asignacion?.empleado_id ?? undefined,
        observaciones: observaciones.trim() || undefined,
      });

      setActaId(acta.id);
      setStep('listo');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al procesar la devolución.');
      setStep('firmas');
    }
  };

  // ─── Cargando / Error ───────────────────────────────────────────────────────
  if (loading) return (
    <><NavBar />
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-500" />
      </main>
    </>
  );

  if (error || !profile || !asignacion) return (
    <><NavBar />
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">{error || 'Error'}</p>
        <button onClick={() => router.back()} className="text-cyan-400 hover:underline">← Volver</button>
      </main>
    </>
  );

  // ─── Listo ──────────────────────────────────────────────────────────────────
  if (step === 'listo' && actaId) return (
    <><NavBar />
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mb-6 text-5xl">✅</div>
        <h1 className="text-2xl font-bold">Devolución completada</h1>
        <p className="mt-2 text-slate-400">El equipo fue devuelto y el acta fue registrada correctamente.</p>
        <div className="mt-8 flex flex-col gap-3">
          <Link href={`/actas/${actaId}/imprimir`}
            className="rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors">
            🖨 Imprimir acta de devolución
          </Link>
          <Link href="/asignaciones"
            className="rounded-lg border border-slate-700 bg-slate-800 px-6 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors">
            ← Volver a asignaciones
          </Link>
        </div>
      </main>
    </>
  );

  // ─── Procesando ─────────────────────────────────────────────────────────────
  if (step === 'procesando') return (
    <><NavBar />
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-500" />
          <p className="text-slate-400">Registrando devolución...</p>
        </div>
      </main>
    </>
  );

  const eq = profile.equipment;

  return (
    <><NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/asignaciones" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← Asignaciones
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Acta de Devolución</h1>
          <p className="text-sm text-slate-400">
            <span className="font-mono text-cyan-400">{eq.codigo_interno}</span>
            {' · '}{eq.marca} {eq.modelo}
            {' · '}{asignacion.empleado_nombre}
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8 flex items-center gap-0">
          {[{ key: 'checklist', label: '1. Revisión' }, { key: 'firmas', label: '2. Firma y devolución' }].map((s, i) => (
            <div key={s.key} className="flex items-center">
              {i > 0 && <div className={`h-px w-12 ${step === 'firmas' ? 'bg-cyan-500' : 'bg-slate-700'}`} />}
              <div className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                step === s.key ? 'bg-cyan-500 text-slate-950'
                  : step === 'firmas' && s.key === 'checklist' ? 'bg-lime-900/40 text-lime-400'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {step === 'firmas' && s.key === 'checklist' ? '✓ ' : ''}{s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ─── Paso 1: Checklist ─────────────────────────────────────────────── */}
        {step === 'checklist' && (
          <div className="rounded-2xl border border-slate-700 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-semibold">Verificación de equipos devueltos</p>
                <p className="text-xs text-slate-400 mt-0.5">Confirma que cada elemento fue recibido en buen estado</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">{checked.size}/{equipos.length}</span>
                <button onClick={checkAll}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors">
                  {allChecked ? 'Desmarcar todo' : 'Marcar todo'}
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-800">
              {equipos.map((eq) => {
                const isChecked = checked.has(eq.id);
                return (
                  <label key={eq.id}
                    className={`flex cursor-pointer items-center gap-4 px-6 py-4 transition-colors ${
                      isChecked ? 'bg-lime-900/10' : 'hover:bg-slate-900'
                    } ${!eq.esPrincipal ? 'pl-14' : ''}`}>
                    {!eq.esPrincipal && <span className="text-slate-600 text-xs mr-1">└</span>}
                    <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(eq.id)}
                      className="h-5 w-5 shrink-0 cursor-pointer rounded accent-lime-500" />
                    <div className="grid flex-1 grid-cols-4 gap-3 items-center min-w-0">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">Código</p>
                        <p className={`font-mono text-sm font-bold truncate ${eq.esPrincipal ? 'text-cyan-400' : 'text-slate-400'}`}>
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
                    {isChecked && <span className="shrink-0 text-lime-400">✓</span>}
                  </label>
                );
              })}
            </div>

            {/* Bodega destino */}
            <div className="border-t border-slate-800 bg-slate-900/50 px-6 py-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Devolver a bodega (opcional)
              </label>
              <select value={bodegaDestinoId} onChange={(e) => setBodegaDestinoId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none">
                <option value="">— Disponible (sin bodega) —</option>
                {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre} · {b.sede}</option>)}
              </select>
            </div>

            <div className="bg-slate-950 border-t border-slate-800 px-6 py-4 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {allChecked ? 'Todos los equipos verificados.' : `Faltan ${equipos.length - checked.size} por verificar.`}
              </p>
              <button onClick={() => setStep('firmas')} disabled={!allChecked}
                className="rounded-lg bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Continuar a firma →
              </button>
            </div>
          </div>
        )}

        {/* ─── Paso 2: Firmas ────────────────────────────────────────────────── */}
        {step === 'firmas' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Datos del acta de devolución</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-slate-400">Quien entrega (empleado) *</span>
                  <input value={entregaNombre} onChange={(e) => setEntregaNombre(e.target.value)}
                    placeholder="Nombre del empleado"
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-slate-400">Quien recibe (empresa) *</span>
                  <input value={recibeNombre} onChange={(e) => setRecibeNombre(e.target.value)}
                    placeholder="Nombre de quien recibe"
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none" />
                </label>
              </div>
              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-xs text-slate-400">Observaciones del estado del equipo</span>
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                  rows={2} placeholder="Estado en que se devuelve, novedades..."
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none resize-none" />
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
              <p className="rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">{saveError}</p>
            )}

            <div className="flex items-center justify-between">
              <button onClick={() => setStep('checklist')}
                className="rounded-lg border border-slate-700 bg-slate-800 px-5 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                ← Volver al checklist
              </button>
              <button onClick={handleGuardar}
                className="rounded-lg bg-lime-700 px-6 py-2 text-sm font-semibold text-white hover:bg-lime-600 transition-colors">
                Confirmar devolución y guardar acta ✓
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default function DevolucionPage() {
  return (
    <Suspense fallback={<><NavBar /><main className="flex min-h-screen items-center justify-center"><p className="text-slate-400">Cargando...</p></main></>}>
      <DevolucionContent />
    </Suspense>
  );
}
