"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import { SignaturePad } from '@/components/signature-pad';
import { createActaEntrega, getBodegaInventario, isAuthenticated, type BodegaInventario } from '@/lib/api';
import { ESTADO_COLORS } from '@/lib/constants';

type Step = 'revision' | 'firmas' | 'guardando' | 'listo';

export default function PazYSalvoBodegaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();

  const [data, setData] = useState<BodegaInventario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('revision');

  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [responsableEntrega, setResponsableEntrega] = useState('');
  const [responsableRecibe, setResponsableRecibe] = useState('');
  const [firmaEntrega, setFirmaEntrega] = useState<string | null>(null);
  const [firmaRecibe, setFirmaRecibe] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [actaId, setActaId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (!authLoading && !hasPermission('bodegas:write')) {
      router.replace(`/bodegas/${id}/inventario`);
      return;
    }
    if (authLoading) return;
    getBodegaInventario(Number(id))
      .then((d) => {
        setData(d);
        setResponsableEntrega(d.bodega.responsable ?? '');
      })
      .catch(() => setError('Error al cargar el inventario.'))
      .finally(() => setLoading(false));
  }, [id, router, authLoading, hasPermission]);

  if (loading) return (
    <><NavBar /><main className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-600 dark:border-slate-700 dark:border-t-cyan-500" />
    </main></>
  );

  if (error || !data) return (
    <><NavBar /><main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-red-600 dark:text-red-300">{error || 'Error'}</p>
      <button onClick={() => router.back()} className="text-cyan-600 dark:text-cyan-400 hover:underline">← Volver</button>
    </main></>
  );

  const allChecked = checked.size === data.equipos.length && data.equipos.length > 0;
  const toggleCheck = (eqId: number) => setChecked((p) => {
    const n = new Set(p); n.has(eqId) ? n.delete(eqId) : n.add(eqId); return n;
  });
  const checkAll = () => allChecked ? setChecked(new Set()) : setChecked(new Set(data.equipos.map((e) => e.id)));

  const handleGuardar = async () => {
    if (!responsableEntrega.trim() || !responsableRecibe.trim()) {
      setSaveError('Ingresa los nombres de ambos responsables.');
      return;
    }
    setSaveError('');
    setStep('guardando');
    try {
      const snapshot = data.equipos.map((e) => ({
        id: e.id,
        codigo_interno: e.codigo_interno,
        serial: e.serial,
        tipo: e.tipo,
        marca: e.marca,
        modelo: e.modelo,
        estado: e.estado,
      }));
      const acta = await createActaEntrega({
        tipo: 'bodega',
        sede: data.bodega.sede,
        titulo: `Paz y Salvo — ${data.bodega.nombre}`,
        entrega_nombre: responsableEntrega.trim(),
        recibe_nombre: responsableRecibe.trim(),
        firma_entrega: firmaEntrega ?? undefined,
        firma_recibe: firmaRecibe ?? undefined,
        equipos_snapshot: snapshot,
        bodega_id: Number(id),
        observaciones: observaciones.trim() || undefined,
      });
      setActaId(acta.id);
      setStep('listo');
    } catch {
      setSaveError('Error al guardar el paz y salvo.');
      setStep('firmas');
    }
  };

  if (step === 'listo' && actaId) return (
    <><NavBar /><main className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="mb-6 text-5xl">✅</div>
      <h1 className="text-2xl font-bold">Paz y Salvo generado</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">La bodega fue confirmada en buen estado por ambas partes.</p>
      <div className="mt-8 flex flex-col gap-3">
        <Link href={`/actas/${actaId}/imprimir`}
          className="rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors">
          🖨 Imprimir Paz y Salvo
        </Link>
        <Link href={`/bodegas/${id}/inventario`}
          className="rounded-lg border border-slate-300 bg-slate-100 px-6 py-3 text-sm text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors">
          ← Volver al inventario
        </Link>
      </div>
    </main></>
  );

  if (step === 'guardando') return (
    <><NavBar /><main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-600 dark:border-slate-700 dark:border-t-cyan-500" />
        <p className="text-slate-600 dark:text-slate-400">Generando paz y salvo...</p>
      </div>
    </main></>
  );

  return (
    <><NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">

        <div className="mb-6">
          <Link href={`/bodegas/${id}/inventario`} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            ← Inventario
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Paz y Salvo</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{data.bodega.nombre} · {data.bodega.sede} · {data.total} equipos</p>
        </div>

        {/* Stepper */}
        <div className="mb-8 flex items-center">
          {[{ key: 'revision', label: '1. Verificación' }, { key: 'firmas', label: '2. Confirmación y firma' }].map((s, i) => (
            <div key={s.key} className="flex items-center">
              {i > 0 && <div className={`h-px w-12 ${step === 'firmas' ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'}`} />}
              <div className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                step === s.key ? 'bg-cyan-500 text-slate-950'
                  : step === 'firmas' && s.key === 'revision' ? 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-400'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {step === 'firmas' && s.key === 'revision' ? '✓ ' : ''}{s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ─── Revisión ─── */}
        {step === 'revision' && (
          <div className="rounded-2xl border border-slate-300 dark:border-slate-700 overflow-hidden">
            <div className="bg-white px-6 py-4 border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-semibold">Verificación del inventario</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Confirma que todos los equipos están presentes y en buen estado</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-400">{checked.size}/{data.equipos.length}</span>
                <button onClick={checkAll}
                  className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
                  {allChecked ? 'Desmarcar todo' : 'Marcar todo'}
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {data.equipos.length === 0 ? (
                <p className="px-6 py-10 text-center text-slate-500">Bodega vacía — no hay equipos que verificar.</p>
              ) : data.equipos.map((eq) => {
                const isChecked = checked.has(eq.id);
                return (
                  <label key={eq.id}
                    className={`flex cursor-pointer items-center gap-4 px-6 py-4 transition-colors ${isChecked ? 'bg-lime-50 dark:bg-lime-900/10' : 'hover:bg-slate-100 dark:hover:bg-slate-900'}`}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(eq.id)}
                      className="h-5 w-5 shrink-0 cursor-pointer rounded accent-lime-500" />
                    <div className="grid flex-1 grid-cols-4 gap-3 items-center min-w-0">
                      <div><p className="text-xs text-slate-500">Código</p>
                        <p className="font-mono text-sm font-bold text-cyan-600 dark:text-cyan-400">{eq.codigo_interno}</p></div>
                      <div><p className="text-xs text-slate-500">Tipo</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{eq.tipo}</p></div>
                      <div><p className="text-xs text-slate-500">Marca / Modelo</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{eq.marca} {eq.modelo}</p></div>
                      <div>
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ESTADO_COLORS[eq.estado] ?? 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
                          {eq.estado}
                        </span>
                      </div>
                    </div>
                    {isChecked && <span className="shrink-0 text-lime-600 dark:text-lime-400">✓</span>}
                  </label>
                );
              })}
            </div>

            <div className="bg-slate-100 border-t border-slate-200 dark:bg-slate-950 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {allChecked ? `Todos los ${data.total} equipos verificados.` : `Faltan ${data.equipos.length - checked.size} por verificar.`}
              </p>
              <button onClick={() => setStep('firmas')} disabled={!allChecked && data.equipos.length > 0}
                className="rounded-lg bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Continuar a firma →
              </button>
            </div>
          </div>
        )}

        {/* ─── Firmas ─── */}
        {step === 'firmas' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">Responsables del paz y salvo</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Responsable de la bodega (quien certifica) *</span>
                  <input value={responsableEntrega} onChange={(e) => setResponsableEntrega(e.target.value)}
                    placeholder="Nombre del responsable actual"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Supervisor / Administrador (quien aprueba) *</span>
                  <input value={responsableRecibe} onChange={(e) => setResponsableRecibe(e.target.value)}
                    placeholder="Nombre del supervisor"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600" />
                </label>
              </div>
              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-400">Observaciones</span>
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                  rows={2} placeholder="Estado general de la bodega, novedades..."
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none resize-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600" />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                <SignaturePad label="Firma responsable bodega" name={responsableEntrega || '—'} onChange={setFirmaEntrega} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                <SignaturePad label="Firma supervisor" name={responsableRecibe || '—'} onChange={setFirmaRecibe} />
              </div>
            </div>

            {saveError && <p className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{saveError}</p>}

            <div className="flex items-center justify-between">
              <button onClick={() => setStep('revision')}
                className="rounded-lg border border-slate-300 bg-slate-100 px-5 py-2 text-sm text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
                ← Volver
              </button>
              <button onClick={handleGuardar}
                className="rounded-lg bg-lime-700 px-6 py-2 text-sm font-semibold text-white hover:bg-lime-600 transition-colors">
                Generar Paz y Salvo ✓
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
