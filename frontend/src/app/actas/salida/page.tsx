"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { EmpleadoAutocomplete } from '@/components/empleado-autocomplete';
import { NavBar } from '@/components/nav-bar';
import { SignaturePad } from '@/components/signature-pad';
import {
  createActaEntrega,
  isAuthenticated,
  listEquipment,
  type EquipmentRow,
} from '@/lib/api';

type Motivo = 'devolucion' | 'baja' | null;
type Step = 'seleccion' | 'datos' | 'listo';

const ESTADOS_TERMINALES = new Set(['Dado de baja', 'Devuelto a tercero']);

export default function SalidaEquipoPage() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const canSalida = authLoading || hasPermission('actas:salida') || hasPermission('asignaciones:write') || hasPermission('bodegas:write');
  const canBaja = authLoading || hasPermission('equipos:baja_solicitar');

  const [motivo, setMotivo] = useState<Motivo>(null);
  const [step, setStep] = useState<Step>('seleccion');

  // ── Devolución a tercero: selección de equipos (varios a la vez) ──────────
  const [cart, setCart] = useState<EquipmentRow[]>([]);
  const [eqSearch, setEqSearch] = useState('');
  const [eqResults, setEqResults] = useState<EquipmentRow[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  const [tipoSalida, setTipoSalida] = useState<'consignacion' | 'arrendamiento'>('consignacion');
  const [terceroPropietario, setTerceroPropietario] = useState('');
  const [entregaNombre, setEntregaNombre] = useState('');
  const [recibeNombre, setRecibeNombre] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [firmaEntrega, setFirmaEntrega] = useState<string | null>(null);
  const [firmaRecibe, setFirmaRecibe] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actaId, setActaId] = useState<number | null>(null);

  // ── Dar de baja: selección de un solo equipo → redirige al flujo existente ──
  const [bajaSearch, setBajaSearch] = useState('');
  const [bajaResults, setBajaResults] = useState<EquipmentRow[]>([]);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
  }, [router]);

  // Búsqueda en vivo — devolución (cualquier estado, incluye asignados actualmente)
  useEffect(() => {
    if (!eqSearch.trim()) { setEqResults([]); return; }
    const timer = setTimeout(() => {
      listEquipment({ search: eqSearch, limit: 10 })
        .then((r) => setEqResults(r.items.filter((e) => !ESTADOS_TERMINALES.has(e.estado))))
        .catch(() => setEqResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [eqSearch]);

  // Búsqueda en vivo — dar de baja
  useEffect(() => {
    if (!bajaSearch.trim()) { setBajaResults([]); return; }
    const timer = setTimeout(() => {
      listEquipment({ search: bajaSearch, limit: 10 })
        .then((r) => setBajaResults(r.items.filter((e) => !ESTADOS_TERMINALES.has(e.estado))))
        .catch(() => setBajaResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [bajaSearch]);

  const cartIds = new Set(cart.map((e) => e.id));

  const handleGuardar = async () => {
    if (!terceroPropietario.trim()) { setError('Indica el proveedor o tercero dueño del equipo.'); return; }
    if (!entregaNombre.trim() || !recibeNombre.trim()) { setError('Ingresa quién entrega y quién recibe.'); return; }
    setError('');
    setSaving(true);
    try {
      const snapshot = cart.map((eq) => ({
        id: eq.id, codigo_interno: eq.codigo_interno, serial: eq.serial,
        tipo: eq.tipo, marca: eq.marca, modelo: eq.modelo, estado: eq.estado,
      }));
      const acta = await createActaEntrega({
        tipo: 'salida',
        sede: cart[0]?.sede ?? 'N/A',
        titulo: `Devolución a ${terceroPropietario.trim()}`,
        entrega_nombre: entregaNombre.trim(),
        recibe_nombre: recibeNombre.trim(),
        firma_entrega: firmaEntrega ?? undefined,
        firma_recibe: firmaRecibe ?? undefined,
        equipos_snapshot: snapshot,
        observaciones: observaciones.trim() || undefined,
        tipo_salida: tipoSalida,
        cliente_empresa: terceroPropietario.trim(),
      });
      setActaId(acta.id);
      setStep('listo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el acta');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'listo' && actaId) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="mb-6 text-5xl">✅</div>
          <h1 className="text-2xl font-bold">Devolución registrada</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {cart.length} equipo{cart.length !== 1 ? 's' : ''} devuelto{cart.length !== 1 ? 's' : ''} a {terceroPropietario} ·
            marcado{cart.length !== 1 ? 's' : ''} como <strong>Devuelto a tercero</strong>.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link href={`/actas/${actaId}/imprimir`} className="rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition-colors">
              🖨 Imprimir / Guardar PDF
            </Link>
            <Link href="/actas" className="rounded-lg border border-slate-300 bg-slate-100 px-6 py-3 text-sm text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors">
              Ver historial de actas
            </Link>
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
          <Link href="/actas" className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">← Actas</Link>
          <h1 className="mt-1 text-2xl font-bold">Salida de equipo</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">¿Por qué motivo sale este equipo del inventario activo?</p>
        </div>

        {/* ── Selector de motivo ─────────────────────────────────────────── */}
        {motivo === null && (
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => { setMotivo('devolucion'); setStep('seleccion'); }}
              disabled={!canSalida}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-violet-400 hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-3xl">🔄</p>
              <p className="mt-2 font-semibold text-slate-800 dark:text-slate-200">Devolución a tercero</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                El equipo era de un proveedor (consignación o arrendamiento) y hay que devolvérselo. Se registra el acta y el equipo queda marcado como devuelto.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMotivo('baja')}
              disabled={!canBaja}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-red-400 hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-3xl">🗑️</p>
              <p className="mt-2 font-semibold text-slate-800 dark:text-slate-200">Dar de baja</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                El equipo es nuestro pero está dañado, obsoleto, perdido o llegó al fin de su vida útil. Requiere evidencia fotográfica y aprobación de un supervisor.
              </p>
            </button>
          </div>
        )}

        {/* ── Dar de baja: elegir el equipo y redirigir al flujo existente ── */}
        {motivo === 'baja' && (
          <div className="space-y-4">
            <button type="button" onClick={() => setMotivo(null)} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">← Cambiar motivo</button>
            <div className="relative">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Buscar el equipo a dar de baja</label>
              <input
                type="text"
                placeholder="Buscar por código, serial, marca, modelo..."
                value={bajaSearch}
                onChange={(e) => setBajaSearch(e.target.value)}
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
              />
              {bajaResults.length > 0 && (
                <ul className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 shadow-xl">
                  {bajaResults.map((eq) => (
                    <li key={eq.id}>
                      <button type="button" onClick={() => router.push(`/equipos/${eq.id}/dar-de-baja`)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                        <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400 w-20 shrink-0">{eq.codigo_interno}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{eq.marca} {eq.modelo}</span>
                        <span className="ml-auto text-xs text-slate-500 shrink-0">{eq.estado}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ── Devolución a tercero ───────────────────────────────────────── */}
        {motivo === 'devolucion' && (
          <>
            <div className="mb-6 flex items-center gap-0">
              {[{ key: 'seleccion', label: '1. Equipos' }, { key: 'datos', label: '2. Datos y firmas' }].map((s, i) => (
                <div key={s.key} className="flex items-center gap-0">
                  {i > 0 && <div className={`h-px w-12 ${step === 'datos' ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-700'}`} />}
                  <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                    step === s.key ? 'bg-violet-600 text-white'
                    : step === 'datos' && s.key === 'seleccion' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {step === 'datos' && s.key === 'seleccion' ? '✓ ' : ''}{s.label}
                  </div>
                </div>
              ))}
            </div>

            {step === 'seleccion' && (
              <div className="space-y-4">
                <button type="button" onClick={() => setMotivo(null)} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">← Cambiar motivo</button>
                <div className="relative">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Buscar equipos a devolver</label>
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Buscar por código, serial, marca, modelo..."
                    value={eqSearch}
                    onChange={(e) => setEqSearch(e.target.value)}
                    autoComplete="off"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                  />
                  {eqResults.filter((e) => !cartIds.has(e.id)).length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 shadow-xl">
                      {eqResults.filter((e) => !cartIds.has(e.id)).slice(0, 10).map((eq) => (
                        <li key={eq.id}>
                          <button type="button" onClick={() => { setCart((p) => [...p, eq]); setEqSearch(''); setEqResults([]); }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                            <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400 w-20 shrink-0">{eq.codigo_interno}</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">{eq.marca} {eq.modelo}</span>
                            <span className="ml-auto text-xs text-slate-500 shrink-0">{eq.estado}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {cart.length > 0 ? (
                  <ul className="space-y-1.5">
                    {cart.map((eq) => (
                      <li key={eq.id} className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400 shrink-0">{eq.codigo_interno}</span>
                          <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{eq.marca} {eq.modelo}</span>
                          <span className="text-xs text-slate-500 shrink-0">{eq.estado}</span>
                        </div>
                        <button type="button" onClick={() => setCart((p) => p.filter((x) => x.id !== eq.id))}
                          className="ml-3 shrink-0 text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400">✕</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-600">Busca por código, serial, marca o modelo — incluye equipos actualmente asignados.</p>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setStep('datos')}
                    disabled={cart.length === 0}
                    className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 transition-colors"
                  >
                    Continuar ({cart.length}) →
                  </button>
                </div>
              </div>
            )}

            {step === 'datos' && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">Datos de la devolución</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">El equipo estaba en *</label>
                      <div className="flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 w-fit">
                        <button type="button" onClick={() => setTipoSalida('consignacion')}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${tipoSalida === 'consignacion' ? 'bg-violet-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                          Consignación
                        </button>
                        <button type="button" onClick={() => setTipoSalida('arrendamiento')}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${tipoSalida === 'arrendamiento' ? 'bg-violet-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                          Arrendamiento
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Proveedor / tercero dueño del equipo *</label>
                      <input value={terceroPropietario} onChange={(e) => setTerceroPropietario(e.target.value)} placeholder="Nombre de la empresa o persona"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600" />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <EmpleadoAutocomplete label="Quien entrega (interno)" required value={entregaNombre} onChange={setEntregaNombre} placeholder="Buscar por nombre..." />
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Quien recibe (representante del tercero) *</label>
                      <input value={recibeNombre} onChange={(e) => setRecibeNombre(e.target.value)} placeholder="Nombre de quien recibe"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600" />
                    </div>
                  </div>

                  <label className="mt-4 flex flex-col gap-1.5">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Observaciones</span>
                    <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3}
                      placeholder="Estado en que se devuelve, novedades, referencia del contrato..."
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none resize-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600" />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                    <SignaturePad label="Firma quien entrega" name={entregaNombre || '—'} onChange={setFirmaEntrega} />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                    <SignaturePad label="Firma quien recibe" name={recibeNombre || '—'} onChange={setFirmaRecibe} />
                  </div>
                </div>

                {error && <p className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-300">{error}</p>}

                <div className="flex items-center justify-between">
                  <button onClick={() => setStep('seleccion')}
                    className="rounded-lg border border-slate-300 bg-slate-100 px-5 py-2 text-sm text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
                    ← Volver a equipos
                  </button>
                  <button onClick={handleGuardar} disabled={saving}
                    className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors">
                    {saving ? 'Guardando...' : 'Confirmar devolución ✓'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
