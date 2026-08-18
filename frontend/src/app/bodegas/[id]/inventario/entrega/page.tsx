"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { EmpleadoAutocomplete } from '@/components/empleado-autocomplete';
import { NavBar } from '@/components/nav-bar';
import { SignaturePad } from '@/components/signature-pad';
import {
  createActaEntrega,
  getBodegaInventario,
  isAuthenticated,
  type BodegaInventario,
  type EquipmentRow,
} from '@/lib/api';
import { ESTADO_COLORS } from '@/lib/constants';

type Step = 'checklist' | 'firmas' | 'guardando' | 'listo';

export default function EntregaBodegaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const [data, setData] = useState<BodegaInventario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('checklist');

  // Checklist: checked = OK sin observacion
  const [checked, setChecked] = useState<Set<number>>(new Set());
  // Novedades por equipo id
  const [novedades, setNovedades] = useState<Record<number, string>>({});
  // Qué textarea de novedad está expandido (id del equipo)
  const [openNovedad, setOpenNovedad] = useState<number | null>(null);
  const novedadRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  // Equipos confirmados para entrega (se fija al pasar a firmas)
  const [equiposParaEntrega, setEquiposParaEntrega] = useState<EquipmentRow[]>([]);

  // Firmas
  const [entregaNombre, setEntregaNombre] = useState('');
  const [recibeNombre, setRecibeNombre] = useState('');
  const [firmaEntrega, setFirmaEntrega] = useState<string | null>(null);
  const [firmaRecibe, setFirmaRecibe] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');

  // Resultado
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
        setEntregaNombre(d.bodega.responsable ?? '');
      })
      .catch(() => setError('Error al cargar el inventario.'))
      .finally(() => setLoading(false));
  }, [id, router, authLoading, hasPermission]);

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
        </main>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen flex-col items-center justify-center gap-4">
          <p className="text-red-600 dark:text-red-300">{error || 'Error'}</p>
          <button onClick={() => router.back()} className="text-indigo-600 dark:text-indigo-400 hover:underline">← Volver</button>
        </main>
      </>
    );
  }

  // Un equipo está "seleccionado" si está marcado OK o tiene novedad registrada
  const isSelected = (eqId: number) => checked.has(eqId) || (novedades[eqId] ?? '').trim().length > 0;
  const selectedCount = data.equipos.filter((e) => isSelected(e.id)).length;
  const anySelected = selectedCount > 0;
  const isPartial = selectedCount < data.equipos.length;
  const anyNovedad = Object.values(novedades).some((n) => n.trim().length > 0);

  const today = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

  // Agrupar equipos: cada dispositivo padre junto con sus periféricos/hijos
  const equipoIds = new Set(data.equipos.map((e) => e.id));
  const childrenByParent = new Map<number, EquipmentRow[]>();
  for (const eq of data.equipos) {
    if (eq.parent_equipment_id != null && equipoIds.has(eq.parent_equipment_id)) {
      const arr = childrenByParent.get(eq.parent_equipment_id) ?? [];
      arr.push(eq);
      childrenByParent.set(eq.parent_equipment_id, arr);
    }
  }
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.codigo_interno.localeCompare(b.codigo_interno));
  }
  const topLevelEquipos = data.equipos
    .filter((eq) => eq.parent_equipment_id == null || !equipoIds.has(eq.parent_equipment_id))
    .slice()
    .sort((a, b) => a.codigo_interno.localeCompare(b.codigo_interno));

  // Agrupar por ubicación física para poder hacer la revisión recorriendo el espacio zona por zona
  const SIN_UBICACION = 'Sin ubicación';
  const gruposUbicacion = new Map<string, EquipmentRow[]>();
  for (const eq of topLevelEquipos) {
    const key = eq.ubicacion?.trim() || SIN_UBICACION;
    const arr = gruposUbicacion.get(key) ?? [];
    arr.push(eq);
    gruposUbicacion.set(key, arr);
  }
  const ubicacionesOrdenadas = [...gruposUbicacion.keys()].sort((a, b) => {
    if (a === SIN_UBICACION) return 1;
    if (b === SIN_UBICACION) return -1;
    return a.localeCompare(b);
  });

  const toggleCheck = (equipoId: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(equipoId)) next.delete(equipoId);
      else next.add(equipoId);
      return next;
    });
  };

  const toggleNovedad = (equipoId: number) => {
    if (openNovedad === equipoId) {
      // Cerrar: si está vacía, solo cerrar
      setOpenNovedad(null);
    } else {
      setOpenNovedad(equipoId);
      // Si tenía check, quitarlo (novedad es alternativa)
      setChecked((prev) => {
        const next = new Set(prev);
        next.delete(equipoId);
        return next;
      });
      setTimeout(() => novedadRefs.current[equipoId]?.focus(), 50);
    }
  };

  const setNovedad = (equipoId: number, value: string) => {
    setNovedades((prev) => ({ ...prev, [equipoId]: value }));
  };

  const checkAll = () => {
    const allOk = data.equipos.every((e) => checked.has(e.id));
    if (allOk) {
      setChecked(new Set());
      setNovedades({});
      setOpenNovedad(null);
    } else {
      const allIds = new Set(data.equipos.map((e) => e.id));
      setChecked(allIds);
      setNovedades({});
      setOpenNovedad(null);
    }
  };

  const selectAll = () => {
    const allIds = new Set(data.equipos.map((e) => e.id));
    setChecked(allIds);
    setNovedades({});
    setOpenNovedad(null);
  };

  const handleEntregaTotal = () => {
    // Fija TODOS los equipos para entrega e ignora la selección actual
    setEquiposParaEntrega(data.equipos);
    setStep('firmas');
  };

  const buildNovedadSummary = () => {
    const lines: string[] = [];
    for (const eq of data.equipos) {
      const n = (novedades[eq.id] ?? '').trim();
      if (n) {
        lines.push(`• [${eq.codigo_interno}] ${eq.tipo} ${eq.marca} ${eq.modelo}: ${n}`);
      }
    }
    return lines.join('\n');
  };

  const handleContinuarAFirmas = () => {
    const seleccionados = data.equipos.filter((e) => isSelected(e.id));
    setEquiposParaEntrega(seleccionados);
    if (anyNovedad) {
      const summary = buildNovedadSummary();
      setObservaciones((prev) => prev.trim() ? `NOVEDADES:\n${summary}\n\n${prev}` : `NOVEDADES:\n${summary}`);
    }
    setStep('firmas');
  };

  const handleGuardar = async () => {
    if (!entregaNombre.trim() || !recibeNombre.trim()) {
      setSaveError('Ingresa los nombres de quien entrega y quien recibe.');
      return;
    }
    setSaveError('');
    setStep('guardando');
    try {
      const snapshot = equiposParaEntrega.map((e) => {
        const novedad = (novedades[e.id] ?? '').trim();
        return {
          id: e.id,
          codigo_interno: e.codigo_interno,
          serial: e.serial,
          tipo: e.tipo,
          marca: e.marca,
          modelo: e.modelo,
          estado: e.estado,
          ...(novedad ? { novedad } : {}),
        };
      });

      const esTotal = equiposParaEntrega.length === data.equipos.length;
      const tieneNovedades = equiposParaEntrega.some((e) => (novedades[e.id] ?? '').trim().length > 0);
      const sufijos = [
        !esTotal ? 'Entrega Parcial' : null,
        tieneNovedades ? 'Con Novedad' : null,
      ].filter(Boolean).join(' — ');
      const titulo = sufijos ? `${data.bodega.nombre} — ${sufijos}` : data.bodega.nombre;

      const acta = await createActaEntrega({
        tipo: 'bodega',
        sede: data.bodega.sede,
        titulo,
        entrega_nombre: entregaNombre.trim(),
        recibe_nombre: recibeNombre.trim(),
        firma_entrega: firmaEntrega ?? undefined,
        firma_recibe: firmaRecibe ?? undefined,
        equipos_snapshot: snapshot,
        bodega_id: Number(id),
        observaciones: observaciones.trim() || undefined,
      });
      setActaId(acta.id);
      setStep('listo');
    } catch {
      setSaveError('Error al guardar el acta. Intenta nuevamente.');
      setStep('firmas');
    }
  };

  // ─── Paso: listo ────────────────────────────────────────────────────────────
  if (step === 'listo' && actaId) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="mb-6 text-5xl">{anyNovedad ? '⚠️' : '✅'}</div>
          <h1 className="text-2xl font-bold">Acta guardada{anyNovedad ? ' — Con Novedad' : ''}</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {anyNovedad
              ? 'El acta fue registrada con novedades. Revisa la impresión para el detalle.'
              : 'El acta de entrega ha sido registrada correctamente.'}
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={`/actas/${actaId}/imprimir`}
              className="rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors"
            >
              🖨 Imprimir / Guardar PDF
            </Link>
            <Link
              href="/actas"
              className="rounded-lg border border-slate-300 bg-slate-100 px-6 py-3 text-sm text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Ver historial de actas
            </Link>
            <Link
              href={`/bodegas/${id}/inventario`}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              ← Volver al inventario
            </Link>
          </div>
        </main>
      </>
    );
  }

  // ─── Paso: guardando ────────────────────────────────────────────────────────
  if (step === 'guardando') {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
            <p className="text-slate-600 dark:text-slate-400">Guardando acta...</p>
          </div>
        </main>
      </>
    );
  }

  const renderEquipoRow = (eq: EquipmentRow, isChild: boolean, peripheralCount = 0) => {
    const ok = checked.has(eq.id);
    const novedad = novedades[eq.id] ?? '';
    const hasNovedad = novedad.trim().length > 0;
    const novedadOpen = openNovedad === eq.id;
    const reviewed = isSelected(eq.id);

    return (
      <div key={eq.id} className={`border-b border-slate-200 dark:border-slate-800 last:border-0 ${isChild ? 'bg-slate-50 dark:bg-slate-950/40' : ''}`}>
        {/* Fila principal */}
        <div
          className={`flex items-center gap-4 px-6 py-3 transition-colors ${isChild ? 'pl-14' : ''} ${
            hasNovedad
              ? 'bg-amber-50 dark:bg-amber-500/5'
              : ok
              ? 'bg-emerald-50 dark:bg-emerald-500/5'
              : 'hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          {isChild && <span className="shrink-0 text-slate-400 dark:text-slate-600">↳</span>}

          {/* Checkbox OK */}
          <input
            type="checkbox"
            checked={ok}
            disabled={hasNovedad}
            onChange={() => toggleCheck(eq.id)}
            title={hasNovedad ? 'Quita la novedad para marcar como OK' : 'Marcar como revisado'}
            className="h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 dark:border-slate-600 accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          />

          {/* Info del equipo */}
          <div className="grid flex-1 grid-cols-4 gap-3 items-center min-w-0">
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Código</p>
              <p className="flex items-center gap-2 font-mono text-sm font-bold text-cyan-600 dark:text-cyan-400 truncate">
                {eq.codigo_interno}
                {peripheralCount > 0 && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                    +{peripheralCount} periférico{peripheralCount > 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Tipo</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{eq.tipo}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Marca / Modelo</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{eq.marca} {eq.modelo}</p>
            </div>
            <div className="min-w-0">
              <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ESTADO_COLORS[eq.estado] ?? 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
                {eq.estado}
              </span>
            </div>
          </div>

          {/* Estado de revisión + botón novedad */}
          <div className="flex shrink-0 items-center gap-2">
            {hasNovedad && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                ⚠ Novedad
              </span>
            )}
            {ok && !hasNovedad && (
              <span className="text-emerald-600 dark:text-emerald-400">✓</span>
            )}
            <button
              onClick={() => toggleNovedad(eq.id)}
              title={hasNovedad ? 'Ver / editar novedad' : 'Registrar novedad'}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                hasNovedad || novedadOpen
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              {novedadOpen ? '▲ Novedad' : '⚠ Novedad'}
            </button>
          </div>
        </div>

        {/* Panel de novedad (expandible) */}
        {novedadOpen && (
          <div className={`px-6 pb-3 pt-1 ${isChild ? 'pl-14' : ''} bg-amber-50 dark:bg-amber-500/5 border-t border-amber-200 dark:border-amber-500/20`}>
            <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              Descripción de la novedad — {eq.codigo_interno} · {eq.tipo}
            </p>
            <textarea
              ref={(el) => { novedadRefs.current[eq.id] = el; }}
              rows={2}
              value={novedad}
              onChange={(e) => setNovedad(eq.id, e.target.value)}
              placeholder="Ej: pantalla con rayones, cable de poder faltante, teclado sin tecla..."
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none resize-none dark:border-amber-500/40 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-600"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                Este equipo quedará registrado con novedad en el acta de entrega.
              </p>
              <button
                onClick={() => {
                  if (!novedad.trim()) {
                    // Si está vacía, cerrar sin guardar
                    setNovedad(eq.id, '');
                  }
                  setOpenNovedad(null);
                }}
                className="text-xs text-amber-700 hover:underline dark:text-amber-400"
              >
                Listo
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <Link href={`/bodegas/${id}/inventario/acta`} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            ← Acta
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Proceso de Entrega</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{data.bodega.nombre} · {data.bodega.sede}</p>
        </div>

        {/* Stepper */}
        <div className="mb-8 flex items-center gap-0">
          {[
            { key: 'checklist', label: '1. Revisión' },
            { key: 'firmas', label: '2. Firmas' },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-0">
              {i > 0 && <div className={`h-px w-12 ${step === 'firmas' ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`} />}
              <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                step === s.key
                  ? 'bg-indigo-600 text-white'
                  : step === 'firmas' && s.key === 'checklist'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {step === 'firmas' && s.key === 'checklist' ? '✓' : null}
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ─── Paso 1: Checklist ─────────────────────────────────────────────── */}
        {step === 'checklist' && (
          <div className="rounded-2xl border border-slate-300 dark:border-slate-700 overflow-hidden">
            <div className="bg-white px-6 py-4 border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-semibold">Revisión de inventario</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Marca ✓ si el equipo está OK, o usa ⚠ Novedad para registrar una observación
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedCount}/{data.equipos.length} sel.
                  {anyNovedad && (
                    <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                      {Object.values(novedades).filter((n) => n.trim()).length} novedad
                    </span>
                  )}
                </span>
                <button
                  onClick={checkAll}
                  className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  {data.equipos.every((e) => checked.has(e.id)) ? 'Desmarcar todo' : 'Marcar todo OK'}
                </button>
              </div>
            </div>

            <div className="divide-y-0">
              {ubicacionesOrdenadas.map((ubic) => (
                <div key={ubic}>
                  <div className="border-y border-slate-200 bg-slate-100 px-6 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    📍 {ubic}
                    <span className="ml-1.5 font-normal normal-case text-slate-400 dark:text-slate-500">
                      ({gruposUbicacion.get(ubic)!.length})
                    </span>
                  </div>
                  {gruposUbicacion.get(ubic)!.map((eq) => {
                    const children = childrenByParent.get(eq.id) ?? [];
                    return (
                      <div key={eq.id}>
                        {renderEquipoRow(eq, false, children.length)}
                        {children.map((child) => renderEquipoRow(child, true))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="bg-slate-100 border-t border-slate-200 dark:bg-slate-950 dark:border-slate-800 px-6 py-4 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {data.equipos.length === 1
                  ? anyNovedad ? 'Equipo con novedad registrada.' : 'Listo para continuar.'
                  : isPartial
                  ? `${selectedCount} de ${data.equipos.length} equipos seleccionados.`
                  : selectedCount === 0
                  ? 'Sin selección: se entregarán todos los equipos.'
                  : anyNovedad
                  ? `Todos · ${Object.values(novedades).filter((n) => n.trim()).length} con novedad.`
                  : 'Todos los equipos seleccionados.'}
              </p>
              <button
                onClick={isPartial ? handleContinuarAFirmas : handleEntregaTotal}
                className={`rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors ${
                  isPartial
                    ? 'bg-orange-500 hover:bg-orange-400'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {data.equipos.length === 1
                  ? 'Continuar a firmas →'
                  : isPartial
                  ? `Entrega parcial (${selectedCount}/${data.equipos.length}) →`
                  : `Entrega total (${data.equipos.length}) →`}
              </button>
            </div>
          </div>
        )}

        {/* ─── Paso 2: Firmas ────────────────────────────────────────────────── */}
        {step === 'firmas' && (
          <div className="space-y-6">
            {/* Resumen de lo que se entrega */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {equiposParaEntrega.length === data.equipos.length ? 'Entrega total' : `Entrega parcial · ${equiposParaEntrega.length} de ${data.equipos.length} equipos`}
              </p>
              {equiposParaEntrega.some((e) => (novedades[e.id] ?? '').trim()) && (
                <>
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">⚠ Equipos con novedad:</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {equiposParaEntrega.filter((e) => (novedades[e.id] ?? '').trim()).map((e) => (
                      <li key={e.id} className="text-xs text-amber-700 dark:text-amber-300">
                        <span className="font-mono font-bold">{e.codigo_interno}</span> — {(novedades[e.id] ?? '').trim()}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Datos del acta */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">Datos del acta</p>
              <div className="grid grid-cols-2 gap-4">
                <EmpleadoAutocomplete
                  label="Asesora que entrega"
                  required
                  value={entregaNombre}
                  onChange={setEntregaNombre}
                  sede={data.bodega.sede}
                  placeholder="Buscar por nombre..."
                />
                <EmpleadoAutocomplete
                  label="Asesora que recibe"
                  required
                  value={recibeNombre}
                  onChange={setRecibeNombre}
                  placeholder="Buscar por nombre..."
                />
              </div>
              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-400">Observaciones generales</span>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                  placeholder="Novedades, estado general, aclaraciones..."
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none resize-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                />
              </label>
            </div>

            {/* Pads de firma */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                <SignaturePad
                  label="Firma quien entrega"
                  name={entregaNombre || '—'}
                  onChange={setFirmaEntrega}
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                <SignaturePad
                  label="Firma quien recibe"
                  name={recibeNombre || '—'}
                  onChange={setFirmaRecibe}
                />
              </div>
            </div>

            {saveError && (
              <p className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-300">{saveError}</p>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep('checklist')}
                className="rounded-lg border border-slate-300 bg-slate-100 px-5 py-2 text-sm text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                ← Volver al checklist
              </button>
              <div className="flex items-center gap-3">
                <p className="text-xs text-slate-500">
                  {today} · {equiposParaEntrega.length} equipo{equiposParaEntrega.length !== 1 ? 's' : ''}
                  {equiposParaEntrega.length < data.equipos.length ? ` (parcial)` : ''}
                  {equiposParaEntrega.some((e) => (novedades[e.id] ?? '').trim()) ? ' · ⚠ Con Novedad' : ''}
                </p>
                <button
                  onClick={handleGuardar}
                  className={`rounded-lg px-6 py-2 text-sm font-semibold text-white transition-colors ${
                    equiposParaEntrega.some((e) => (novedades[e.id] ?? '').trim())
                      ? 'bg-amber-500 hover:bg-amber-400'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {equiposParaEntrega.some((e) => (novedades[e.id] ?? '').trim())
                    ? 'Confirmar — Con Novedad ⚠'
                    : 'Confirmar y guardar acta ✓'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
