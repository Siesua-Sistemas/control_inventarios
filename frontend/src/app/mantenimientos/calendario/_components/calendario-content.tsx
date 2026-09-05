"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DatePickerPresets } from '@/components/date-picker-presets';
import { MantenimientoModal } from '@/components/mantenimiento-modal';
import {
  isAuthenticated,
  listEquiposProximosPreventivos,
  listMantenimientoConfig,
  listMantenimientos,
  patchMantenimiento,
  type EquipmentProximoPreventivoRow,
  type MantenimientoConfigRow,
  type MantenimientoRow,
} from '@/lib/api';

// ─── types ────────────────────────────────────────────────────────────────────

type Ocurrencia = 'fecha' | 'proximo';

type CalendarItem =
  | { _source: 'mantenimiento'; data: MantenimientoRow; ocurrencia: Ocurrencia }
  | { _source: 'auto_preventivo'; data: EquipmentProximoPreventivoRow };

// ─── constants ───────────────────────────────────────────────────────────────

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_VISIBLE_EVENTS = 3;

// ─── helpers ─────────────────────────────────────────────────────────────────

function toLocalDate(d: string) {
  return new Date(`${d}T00:00:00`);
}

function formatDateLong(d: string) {
  return toLocalDate(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
}

function dayDiff(a: string, b: string) {
  return Math.round((toLocalDate(a).getTime() - toLocalDate(b).getTime()) / 86400000);
}

type StatusInfo = { label: string; pill: string };

function getStatusInfo(prox: string | null, today: string, estado: string, ocurrencia: Ocurrencia = 'proximo'): StatusInfo {
  if (estado === 'aprobado') return {
    label: 'Aprobado ✓',
    pill: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  };
  if (estado === 'realizado') return {
    label: 'Realizado ✓',
    pill: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  };
  if (estado === 'pendiente_aprobacion') return {
    label: 'Pend. aprobación',
    pill: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  };
  if (estado === 'en_proceso') return {
    label: 'En proceso',
    pill: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
  };
  if (estado === 'rechazado') return {
    label: 'Rechazado',
    pill: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  };
  if (estado === 'cancelado') return {
    label: 'Cancelado',
    pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };
  // Pill del día en que se REALIZÓ (no el de la próxima fecha programada): el estado
  // todavía no es una fecha vencida/próxima, es simplemente el registro del día.
  if (ocurrencia === 'fecha') return {
    label: 'Registrado',
    pill: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  if (!prox) return {
    label: 'Sin fecha',
    pill: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  const diff = dayDiff(prox, today);
  if (diff < 0) return { label: 'Vencido', pill: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200' };
  if (diff === 0) return { label: 'Hoy', pill: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200' };
  if (diff <= 15) return { label: `En ${diff} día${diff !== 1 ? 's' : ''}`, pill: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200' };
  if (diff <= 30) return { label: `En ${diff} días`, pill: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200' };
  return { label: `En ${diff} días`, pill: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200' };
}

function getPillColors(prox: string | null, today: string, estado: string, ocurrencia: Ocurrencia = 'proximo') {
  if (estado === 'aprobado' || estado === 'realizado') return 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300';
  if (estado === 'pendiente_aprobacion') return 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300';
  if (estado === 'en_proceso') return 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300';
  if (estado === 'rechazado') return 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300';
  if (estado === 'cancelado') return 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500';
  if (ocurrencia === 'fecha') return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400';
  if (!prox) return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400';
  const diff = dayDiff(prox, today);
  if (diff < 0) return 'border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300';
  if (diff <= 15) return 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300';
  if (diff <= 30) return 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300';
  return 'border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-300';
}

function getTipoAccent(tipo: string) {
  return tipo === 'Preventivo' ? 'border-l-cyan-500' : 'border-l-rose-500';
}

function buildCalendar(year: number, month: number) {
  const firstDow = new Date(year, month, 1).getDay();
  const offset = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrev = new Date(prevYear, prevMonth + 1, 0).getDate();
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const cells: { dateStr: string; day: number; current: boolean }[] = [];

  for (let i = offset - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    cells.push({ dateStr: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, current: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ dateStr: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, current: false });
  }
  return cells;
}

// ─── EventPill (real mantenimientos) ─────────────────────────────────────────

function EventPill({ item, ocurrencia, today, onClick, isSelected }: {
  item: MantenimientoRow; ocurrencia: Ocurrencia; today: string; onClick: () => void; isSelected: boolean;
}) {
  const colors = getPillColors(item.proximo_mantenimiento, today, item.estado, ocurrencia);
  const accent = getTipoAccent(item.tipo);
  const sedeWord = item.equipment_sede.split(' ')[0];
  const isDone = item.estado === 'aprobado' || item.estado === 'realizado';
  const prefix = isDone ? '✓' : item.estado === 'en_proceso' ? '▶' : item.estado === 'pendiente_aprobacion' ? '⏳' : ocurrencia === 'fecha' ? '●' : item.tipo[0];

  return (
    <button
      onClick={onClick}
      title={`${item.equipment_codigo} · ${item.equipment_sede} · ${item.tipo} · ${item.estado}${ocurrencia === 'fecha' ? ' · realizado este día' : ' · próximo mantenimiento'}`}
      className={`mt-0.5 block w-full truncate rounded border border-l-[3px] px-1 py-px text-left text-[11px] font-medium leading-4 transition-all
        ${colors} ${accent} ${isSelected ? 'ring-1 ring-cyan-500 ring-offset-0' : 'hover:opacity-80'}`}
    >
      <span className="font-bold">{prefix}</span>
      {' '}{item.equipment_codigo}
      <span className="opacity-60"> · {sedeWord}</span>
    </button>
  );
}

// ─── AutoPreventivoPill (equipos sin primer mantenimiento) ───────────────────

function AutoPreventivoPill({ item, onClick, isSelected }: {
  item: EquipmentProximoPreventivoRow; onClick: () => void; isSelected: boolean;
}) {
  const sedeWord = item.equipment_sede.split(' ')[0];
  return (
    <button
      onClick={onClick}
      title={`Primer mantenimiento · ${item.equipment_codigo} · ${item.equipment_sede}`}
      className={`mt-0.5 block w-full truncate rounded border border-l-[3px] border-dashed border-indigo-300 border-l-indigo-500 bg-indigo-50 px-1 py-px text-left text-[11px] font-medium leading-4 text-indigo-700 transition-all
        dark:border-indigo-500/40 dark:border-l-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-300
        ${isSelected ? 'ring-1 ring-indigo-400 ring-offset-0' : 'hover:opacity-80'}`}
    >
      <span className="font-bold">!</span>
      {' '}{item.equipment_codigo}
      <span className="opacity-60"> · {sedeWord}</span>
    </button>
  );
}

// ─── DetailRow ───────────────────────────────────────────────────────────────

function DetailRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-sm ${accent ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
        {value}
      </p>
    </div>
  );
}

// ─── AutoPreventivoPanel ─────────────────────────────────────────────────────

function AutoPreventivoPanel({ item, today, onClose }: {
  item: EquipmentProximoPreventivoRow;
  today: string;
  onClose: () => void;
}) {
  const { label: statusLabel, pill: statusPill } = getStatusInfo(item.proximo_preventivo, today, 'programado');
  const isVencido = item.proximo_preventivo < today;

  const razon = item.garantia_vence
    ? `Fin de garantía (${formatDateLong(item.garantia_vence)})`
    : item.fecha_compra
      ? `Fecha de compra + ${item.frecuencia_meses ?? '?'} meses`
      : `Fecha de ingreso + ${item.frecuencia_meses ?? '?'} meses`;

  return (
    <aside className="flex w-full flex-col overflow-hidden rounded-2xl border border-indigo-200 bg-white lg:w-80 lg:shrink-0 dark:border-indigo-900/60 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-500/5">
        <div className="min-w-0 flex-1">
          <Link
            href={`/equipos/${item.equipment_id}/hoja-de-vida`}
            className="font-mono text-xl font-bold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
          >
            {item.equipment_codigo}
          </Link>
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
            {item.equipment_marca} {item.equipment_modelo}
          </p>
          <p className="text-xs text-slate-500">{item.equipment_sede}</p>
          <p className="text-xs text-slate-400">{item.equipment_tipo}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="ml-2 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2 border-b border-indigo-100 px-4 py-2.5 dark:border-indigo-900/40">
        <span className="rounded-full border-l-2 border-l-indigo-500 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-300">
          Preventivo
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPill}`}>
          {statusLabel}
        </span>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Sin mantenimiento
        </span>
        {item.frecuencia_meses && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Cada {item.frecuencia_meses} mes{item.frecuencia_meses !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <DetailRow
            label="Primer mantenimiento programado"
            value={formatDateLong(item.proximo_preventivo)}
            accent={isVencido}
          />
          <DetailRow label="Calculado a partir de" value={razon} />
          {item.garantia_vence && (
            <DetailRow label="Garantía vence" value={formatDateLong(item.garantia_vence)} />
          )}
          {item.fecha_compra && (
            <DetailRow label="Fecha de compra" value={formatDateLong(item.fecha_compra)} />
          )}
        </div>
        <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-500/5">
          <p className="text-xs text-indigo-700 dark:text-indigo-300">
            Este equipo no tiene mantenimientos preventivos registrados. Al registrar el primero, desaparecerá de esta vista automáticamente.
          </p>
        </div>
      </div>

      {/* Action */}
      <div className="border-t border-indigo-100 p-4 dark:border-indigo-900/40">
        <Link
          href={`/equipos/${item.equipment_id}/hoja-de-vida`}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Registrar primer mantenimiento
        </Link>
      </div>
    </aside>
  );
}

// ─── OtActionButton ──────────────────────────────────────────────────────────

function OtActionButton({ estado, onOpen }: { estado: string; onOpen: () => void }) {
  const config: Record<string, { label: string; cls: string }> = {
    programado:           { label: '▶ Iniciar OT', cls: 'bg-blue-600 hover:bg-blue-700 text-white' },
    en_proceso:           { label: '✏ Firmar y completar', cls: 'bg-cyan-600 hover:bg-cyan-700 text-white' },
    pendiente_aprobacion: { label: '⚠ Aprobar / Rechazar OT', cls: 'bg-amber-500 hover:bg-amber-600 text-white' },
    rechazado:            { label: '↩ OT rechazada — reabrir', cls: 'bg-rose-600 hover:bg-rose-700 text-white' },
  };
  const c = config[estado] ?? { label: 'Gestionar OT', cls: 'bg-slate-600 hover:bg-slate-700 text-white' };
  return (
    <button
      onClick={onOpen}
      className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${c.cls}`}
    >
      {c.label}
    </button>
  );
}

// ─── DetailPanel (real mantenimientos) ───────────────────────────────────────

function DetailPanel({ item, today, configs, onClose, onUpdated }: {
  item: MantenimientoRow;
  today: string;
  configs: MantenimientoConfigRow[];
  onClose: () => void;
  onUpdated: (updated: MantenimientoRow) => void;
}) {
  const [otModalOpen, setOtModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nextDate, setNextDate] = useState(item.proximo_mantenimiento ?? '');

  useEffect(() => {
    setNextDate(item.proximo_mantenimiento ?? '');
    setSaveError(null);
  }, [item.id]);

  const dateChanged = nextDate !== (item.proximo_mantenimiento ?? '');

  const handleSaveDate = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await patchMantenimiento(item.id, {
        ...(nextDate ? { proximo_mantenimiento: nextDate } : {}),
      });
      onUpdated(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const { label: statusLabel, pill: statusPill } = getStatusInfo(item.proximo_mantenimiento, today, item.estado);
  const isVencido = item.estado === 'programado' && !!item.proximo_mantenimiento && item.proximo_mantenimiento < today;
  const isDone = item.estado === 'aprobado' || item.estado === 'realizado';
  const isCancelado = item.estado === 'cancelado';

  const config = item.tipo === 'Preventivo'
    ? configs.find((c) => c.tipo_equipo === item.equipment_tipo)
    : null;

  return (
    <aside className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white lg:w-80 lg:shrink-0 dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 p-4 dark:border-slate-800">
        <div className="min-w-0 flex-1">
          <button
            onClick={() => setOtModalOpen(true)}
            className="font-mono text-xl font-bold text-cyan-600 underline-offset-2 hover:underline dark:text-cyan-400"
            title="Gestionar OT"
          >
            {item.equipment_codigo}
          </button>
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
            {item.equipment_marca} {item.equipment_modelo}
          </p>
          <p className="text-xs text-slate-500">{item.equipment_sede}</p>
          <p className="text-xs text-slate-400">{item.equipment_tipo}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="ml-2 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
        <span className={`inline-flex items-center gap-1 rounded-full border-l-2 px-2.5 py-0.5 text-xs font-medium ${
          item.tipo === 'Preventivo'
            ? 'border-l-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-300'
            : 'border-l-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300'
        }`}>
          {item.tipo}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPill}`}>
          {isDone && '✓ '}{statusLabel}
        </span>
        {config && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Cada {config.frecuencia_meses} mes{config.frecuencia_meses !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {/* Content — read-only except next date */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">

          {/* Próximo mantenimiento — editable inline */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Próximo mantenimiento
            </p>
            <div className="flex flex-col gap-2">
              <DatePickerPresets
                value={nextDate}
                onChange={setNextDate}
              />
              {dateChanged && (
                <button
                  onClick={handleSaveDate}
                  disabled={saving}
                  className="rounded-md bg-cyan-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
                >
                  {saving ? '…' : 'Guardar'}
                </button>
              )}
            </div>
            {isVencido && !dateChanged && (
              <p className="mt-1 text-[11px] font-semibold text-red-600 dark:text-red-400">Vencido</p>
            )}
          </div>

          <DetailRow
            label="Último mantenimiento"
            value={formatDateLong(item.fecha.split('T')[0])}
          />
          {item.tecnico && <DetailRow label="Técnico" value={item.tecnico} />}
          <DetailRow label="Descripción" value={item.descripcion} />
          {item.observaciones && <DetailRow label="Observaciones" value={item.observaciones} />}
          {item.costo && (
            <DetailRow label="Costo" value={`$${Number(item.costo).toLocaleString('es-CO')}`} />
          )}
          <DetailRow label="Registrado por" value={item.created_by_nombre} />
        </div>

        {saveError && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {saveError}
          </p>
        )}
      </div>

      {/* Footer actions */}
      <div className="space-y-2 border-t border-slate-200 p-4 dark:border-slate-800">
        {isDone ? (
          <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {item.estado === 'aprobado' ? 'OT Aprobada' : 'Realizado'}
          </div>
        ) : !isCancelado && (
          <OtActionButton estado={item.estado} onOpen={() => setOtModalOpen(true)} />
        )}
        <Link
          href={`/equipos/${item.equipment_id}/hoja-de-vida`}
          className="block w-full rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Ver hoja de vida →
        </Link>
      </div>

      {otModalOpen && (
        <MantenimientoModal
          mantenimiento={item}
          onClose={() => setOtModalOpen(false)}
          onUpdate={(updated) => { onUpdated(updated); setOtModalOpen(false); }}
        />
      )}
    </aside>
  );
}

// ─── CalendarioContent ───────────────────────────────────────────────────────

export function CalendarioContent() {
  const router = useRouter();
  const now = new Date();
  // Use local date (not UTC) to avoid timezone off-by-one in color comparisons
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [items, setItems] = useState<MantenimientoRow[]>([]);
  const [autoItems, setAutoItems] = useState<EquipmentProximoPreventivoRow[]>([]);
  const [configs, setConfigs] = useState<MantenimientoConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSede, setFilterSede] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [sedeInput, setSedeInput] = useState('');
  const sedeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listMantenimientoConfig().then((r) => setConfigs(r.items)).catch(() => null);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const desde = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const hasta = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    try {
      const [mantRes, autoRes] = await Promise.all([
        listMantenimientos({
          proximo_desde: desde,
          proximo_hasta: hasta,
          ...(filterSede ? { sede: filterSede } : {}),
          ...(filterTipo && filterTipo !== 'Sin mantenimiento' ? { tipo: filterTipo } : {}),
          limit: 200,
        }),
        (filterTipo === '' || filterTipo === 'Sin mantenimiento')
          ? listEquiposProximosPreventivos(desde, hasta)
          : Promise.resolve({ total: 0, items: [] as EquipmentProximoPreventivoRow[] }),
      ]);
      setItems(mantRes.items);
      // Filter auto items by sede if filter is active
      const filteredAuto = filterSede
        ? autoRes.items.filter((i) => i.equipment_sede.toLowerCase().includes(filterSede.toLowerCase()))
        : autoRes.items;
      setAutoItems(filteredAuto);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el calendario');
    } finally {
      setLoading(false);
    }
  }, [year, month, filterSede, filterTipo]);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    fetchData();
  }, [fetchData, router]);

  const handleSedeInput = (val: string) => {
    setSedeInput(val);
    if (sedeTimer.current) clearTimeout(sedeTimer.current);
    sedeTimer.current = setTimeout(() => setFilterSede(val), 400);
  };

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  // Unified events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};

    for (const item of items) {
      // Cada mantenimiento se ubica en el día en que se REALIZÓ (para que el registro
      // siempre aparezca, incluido un Correctivo sin reprogramación) y, si tiene una
      // próxima fecha programada distinta, también ahí como recordatorio a futuro.
      const fechaKey = item.fecha.split('T')[0];
      (map[fechaKey] ??= []).push({ _source: 'mantenimiento', data: item, ocurrencia: 'fecha' });
      if (item.proximo_mantenimiento && item.proximo_mantenimiento !== fechaKey) {
        (map[item.proximo_mantenimiento] ??= []).push({ _source: 'mantenimiento', data: item, ocurrencia: 'proximo' });
      }
    }
    for (const item of autoItems) {
      const key = item.proximo_preventivo;
      (map[key] ??= []).push({ _source: 'auto_preventivo', data: item });
    }

    // Sort each day: auto_preventivo last; within mantenimientos: vencido first, realizado last
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        if (a._source === 'auto_preventivo' && b._source !== 'auto_preventivo') return 1;
        if (b._source === 'auto_preventivo' && a._source !== 'auto_preventivo') return -1;
        if (a._source === 'mantenimiento' && b._source === 'mantenimiento') {
          const aDone = a.data.estado === 'aprobado' || a.data.estado === 'realizado';
          const bDone = b.data.estado === 'aprobado' || b.data.estado === 'realizado';
          if (aDone && !bDone) return 1;
          if (bDone && !aDone) return -1;
          const da = a.data.proximo_mantenimiento ? dayDiff(a.data.proximo_mantenimiento, todayStr) : 999;
          const db = b.data.proximo_mantenimiento ? dayDiff(b.data.proximo_mantenimiento, todayStr) : 999;
          return da - db;
        }
        return 0;
      });
    }
    return map;
  }, [items, autoItems, todayStr]);

  const calendarCells = useMemo(() => buildCalendar(year, month), [year, month]);

  const handleUpdated = useCallback((updated: MantenimientoRow) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    setSelected({ _source: 'mantenimiento', data: updated });
  }, []);

  // Stats
  const vencidos = items.filter((i) => i.estado === 'programado' && i.proximo_mantenimiento && i.proximo_mantenimiento < todayStr).length;
  const proximos30 = items.filter((i) => {
    if (i.estado !== 'programado' || !i.proximo_mantenimiento || i.proximo_mantenimiento < todayStr) return false;
    return dayDiff(i.proximo_mantenimiento, todayStr) <= 30;
  }).length;
  const realizados = items.filter((i) => i.estado === 'aprobado' || i.estado === 'realizado').length;
  const sinMantto = autoItems.length;

  const isSelectedItem = (ci: CalendarItem) => {
    if (!selected) return false;
    if (ci._source !== selected._source) return false;
    if (ci._source === 'mantenimiento' && selected._source === 'mantenimiento') return ci.data.id === selected.data.id;
    if (ci._source === 'auto_preventivo' && selected._source === 'auto_preventivo') return ci.data.equipment_id === selected.data.equipment_id;
    return false;
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

      {/* ── Calendar column ── */}
      <div className={`min-w-0 flex-1 ${selected ? 'hidden lg:block' : ''}`}>

        {/* Controls */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              aria-label="Mes anterior"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="min-w-[160px] text-center text-base font-bold text-slate-900 dark:text-slate-100">
              {MESES[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              aria-label="Mes siguiente"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Hoy
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {vencidos > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300">
                {vencidos} vencido{vencidos !== 1 ? 's' : ''}
              </span>
            )}
            {proximos30 > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                {proximos30} próximo{proximos30 !== 1 ? 's' : ''}
              </span>
            )}
            {realizados > 0 && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                {realizados} completado{realizados !== 1 ? 's' : ''}
              </span>
            )}
            {sinMantto > 0 && (
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                {sinMantto} sin mantto.
              </span>
            )}
            <input
              type="text"
              placeholder="Sede..."
              value={sedeInput}
              onChange={(e) => handleSedeInput(e.target.value)}
              className="w-28 text-sm"
            />
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="text-sm"
            >
              <option value="">Todos</option>
              <option>Preventivo</option>
              <option>Correctivo</option>
              <option value="Sin mantenimiento">Sin mantenimiento</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Grid */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
            {DIAS_CORTO.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">Cargando calendario...</p>
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarCells.map(({ dateStr, day, current }) => {
                const evs = eventsByDate[dateStr] ?? [];
                const isToday = dateStr === todayStr;
                return (
                  <div
                    key={dateStr}
                    className={`min-h-[100px] border-b border-r border-slate-100 p-1.5 dark:border-slate-800
                      ${!current ? 'bg-slate-50/70 dark:bg-slate-950/70' : ''}
                      ${isToday ? 'ring-2 ring-inset ring-cyan-400 dark:ring-cyan-500' : ''}
                    `}
                  >
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs leading-none
                      ${isToday ? 'bg-cyan-600 font-bold text-white'
                        : current ? 'font-medium text-slate-700 dark:text-slate-300'
                        : 'text-slate-300 dark:text-slate-600'}`}
                    >
                      {day}
                    </span>
                    {evs.slice(0, MAX_VISIBLE_EVENTS).map((ci) => (
                      ci._source === 'mantenimiento' ? (
                        <EventPill
                          key={`m-${ci.data.id}-${ci.ocurrencia}`}
                          item={ci.data}
                          ocurrencia={ci.ocurrencia}
                          today={todayStr}
                          onClick={() => setSelected(ci)}
                          isSelected={isSelectedItem(ci)}
                        />
                      ) : (
                        <AutoPreventivoPill
                          key={`a-${ci.data.equipment_id}`}
                          item={ci.data}
                          onClick={() => setSelected(ci)}
                          isSelected={isSelectedItem(ci)}
                        />
                      )
                    ))}
                    {evs.length > MAX_VISIBLE_EVENTS && (
                      <p className="mt-0.5 text-center text-[10px] text-slate-400">
                        +{evs.length - MAX_VISIBLE_EVENTS} más
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Vencido</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" /> Crítico ≤15d</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Próximo ≤30d</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Programado</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Realizado</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border-2 border-dashed border-indigo-400" />
            Sin mantto.
          </span>
          <span className="flex items-center gap-1.5">● Registrado (día en que se realizó)</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-1 rounded-sm bg-cyan-500" /> Preventivo
            <span className="ml-2 inline-block h-3 w-1 rounded-sm bg-rose-500" /> Correctivo
          </span>
          {!loading && (
            <span className="ml-auto text-slate-400">
              {items.length + autoItems.length} en este mes
            </span>
          )}
        </div>
      </div>

      {/* ── Panel column ── */}
      <div className={`${selected ? 'flex' : 'hidden lg:flex'} flex-col`}>
        {selected ? (
          <>
            <button
              onClick={() => setSelected(null)}
              className="mb-3 flex items-center gap-1 text-sm text-cyan-600 lg:hidden dark:text-cyan-400"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Volver al calendario
            </button>
            {selected._source === 'mantenimiento' ? (
              <DetailPanel
                item={selected.data}
                today={todayStr}
                configs={configs}
                onClose={() => setSelected(null)}
                onUpdated={handleUpdated}
              />
            ) : (
              <AutoPreventivoPanel
                item={selected.data}
                today={todayStr}
                onClose={() => setSelected(null)}
              />
            )}
          </>
        ) : (
          <div className="hidden rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center lg:flex lg:w-80 lg:shrink-0 lg:flex-col lg:items-center lg:justify-center dark:border-slate-700 dark:bg-slate-900">
            <svg className="mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Haz clic en un evento del calendario para ver los detalles y editarlo
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
