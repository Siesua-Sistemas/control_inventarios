"use client";

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { useAuth } from '@/components/auth-provider';
import { MantenimientoModal } from '@/components/mantenimiento-modal';
import { getMisOt, getMisTickets, type MantenimientoRow, type TicketOut } from '@/lib/api';

// ── Colores ─────────────────────────────────────────────────────────────────

const OT_ESTADO_BADGE: Record<string, string> = {
  programado:           'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  en_proceso:           'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  pendiente_aprobacion: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
};
const OT_ESTADO_LABEL: Record<string, string> = {
  programado:           'Programado',
  en_proceso:           'En proceso',
  pendiente_aprobacion: 'Pend. aprobación',
};

const TICKET_ESTADO_BADGE: Record<string, string> = {
  abierto:           'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  en_revision:       'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300',
  en_proceso:        'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  pendiente_usuario: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
};
const TICKET_ESTADO_LABEL: Record<string, string> = {
  abierto:           'Abierto',
  en_revision:       'En revisión',
  en_proceso:        'En proceso',
  pendiente_usuario: 'Pend. usuario',
};

const PRIORIDAD_DOT: Record<string, string> = {
  Urgente: 'bg-red-500',
  Alta:    'bg-orange-500',
  Media:   'bg-amber-400',
  Baja:    'bg-slate-400',
};

// ── Componente principal ─────────────────────────────────────────────────────

export function AgendaContent() {
  const { hasPermission } = useAuth();
  const [ots, setOts] = useState<MantenimientoRow[]>([]);
  const [tickets, setTickets] = useState<TicketOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewingOt, setViewingOt] = useState<MantenimientoRow | null>(null);

  const isSupervisor = hasPermission('tickets:write');

  useEffect(() => {
    Promise.allSettled([getMisOt(), getMisTickets()])
      .then(([otResult, ticketResult]) => {
        if (otResult.status === 'fulfilled') setOts(otResult.value.items);
        if (ticketResult.status === 'fulfilled') setTickets(ticketResult.value.items);
        if (otResult.status === 'rejected' && ticketResult.status === 'rejected') {
          setError('No se pudo cargar la agenda.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
        {error}
      </div>
    );
  }

  const totalPendientes = ots.length + tickets.length;

  if (totalPendientes === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-8 py-16 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-4xl">🎉</p>
        <p className="mt-3 text-lg font-semibold text-slate-700 dark:text-slate-300">Sin pendientes</p>
        <p className="mt-1 text-sm text-slate-500">No hay OTs ni tickets pendientes en este momento.</p>
      </div>
    );
  }

  const otEnProceso = ots.filter((o) => o.estado === 'en_proceso');
  const otProgramadas = ots.filter((o) => o.estado === 'programado');
  const otPendAprobacion = ots.filter((o) => o.estado === 'pendiente_aprobacion');

  const ticketsSinAsignar = tickets.filter((t) => !t.asignado_a_nombre);
  const ticketsUrgentes = tickets.filter((t) => (t.prioridad === 'Alta' || t.prioridad === 'Urgente'));
  const ticketsNormales = tickets.filter((t) => t.prioridad !== 'Alta' && t.prioridad !== 'Urgente');

  return (
    <>
      {viewingOt && (
        <MantenimientoModal
          mantenimiento={viewingOt}
          onClose={() => setViewingOt(null)}
          onUpdate={(updated) => {
            setOts((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            setViewingOt(updated);
          }}
        />
      )}

      {/* KPI rápido */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="OTs en proceso" value={otEnProceso.length} color="blue" />
        <KpiCard label="OTs programadas" value={otProgramadas.length} color="slate" />
        <KpiCard label="Pend. aprobación" value={otPendAprobacion.length} color="amber" />
        <KpiCard
          label={isSupervisor ? 'Tickets activos' : 'Tickets asignados'}
          value={tickets.length}
          color="violet"
          badge={isSupervisor && ticketsSinAsignar.length > 0 ? `${ticketsSinAsignar.length} sin asignar` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Columna OTs */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Órdenes de trabajo ({ots.length})
          </h2>

          {ots.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900">
              Sin OTs pendientes
            </p>
          )}

          {otEnProceso.length > 0 && (
            <OtGroup title="En proceso" items={otEnProceso} onOpen={setViewingOt} />
          )}
          {otProgramadas.length > 0 && (
            <OtGroup title="Programadas" items={otProgramadas} onOpen={setViewingOt} />
          )}
          {otPendAprobacion.length > 0 && (
            <OtGroup title="Pendiente aprobación" items={otPendAprobacion} onOpen={setViewingOt} />
          )}

          <div className="pt-1">
            <Link
              href="/mantenimientos/registros"
              className="text-sm font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              Ver todos los registros →
            </Link>
          </div>
        </div>

        {/* Columna Tickets */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            {isSupervisor ? 'Todos los tickets activos' : 'Tickets asignados'} ({tickets.length})
          </h2>

          {tickets.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900">
              Sin tickets pendientes
            </p>
          )}

          {/* Sin asignar — visible solo para supervisores */}
          {isSupervisor && ticketsSinAsignar.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-rose-500 dark:text-rose-400">
                Sin asignar ({ticketsSinAsignar.length})
              </p>
              <div className="space-y-2">
                {ticketsSinAsignar.map((t) => (
                  <TicketCard key={t.id} ticket={t} showAssignee={isSupervisor} />
                ))}
              </div>
            </div>
          )}

          {ticketsUrgentes.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-red-500 dark:text-red-400">Alta / Urgente</p>
              <div className="space-y-2">
                {ticketsUrgentes
                  .filter((t) => isSupervisor ? t.asignado_a_nombre : true)
                  .map((t) => <TicketCard key={t.id} ticket={t} showAssignee={isSupervisor} />)}
              </div>
            </div>
          )}
          {ticketsNormales.length > 0 && (
            <div>
              {ticketsUrgentes.length > 0 && <p className="mb-2 text-xs font-medium text-slate-400">Media / Baja</p>}
              <div className="space-y-2">
                {ticketsNormales
                  .filter((t) => isSupervisor ? t.asignado_a_nombre : true)
                  .map((t) => <TicketCard key={t.id} ticket={t} showAssignee={isSupervisor} />)}
              </div>
            </div>
          )}

          <div className="pt-1">
            <Link
              href="/tickets"
              className="text-sm font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              Ver todos los tickets →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function KpiCard({ label, value, color, badge }: {
  label: string; value: number; color: string; badge?: string;
}) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-800',
    slate:  'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700',
    amber:  'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-800',
    violet: 'bg-violet-50 border-violet-200 dark:bg-violet-500/10 dark:border-violet-800',
  };
  const textColors: Record<string, string> = {
    blue:   'text-blue-700 dark:text-blue-300',
    slate:  'text-slate-700 dark:text-slate-300',
    amber:  'text-amber-700 dark:text-amber-300',
    violet: 'text-violet-700 dark:text-violet-300',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[color]}`}>
      <p className={`text-2xl font-bold ${textColors[color]}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</p>
      {badge && (
        <span className="mt-1 inline-block rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
          {badge}
        </span>
      )}
    </div>
  );
}

function OtGroup({ title, items, onOpen }: { title: string; items: MantenimientoRow[]; onOpen: (m: MantenimientoRow) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-400">{title}</p>
      <div className="space-y-2">
        {items.map((m) => {
          const totalPasos = m.pasos?.length ?? 0;
          const donePasos = m.pasos?.filter((p) => p.completado).length ?? 0;
          return (
            <button
              key={m.id}
              onClick={() => onOpen(m)}
              className="group w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${PRIORIDAD_DOT[m.prioridad ?? 'Media'] ?? PRIORIDAD_DOT.Media}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {m.numero_ot && (
                      <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">{m.numero_ot}</span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${OT_ESTADO_BADGE[m.estado] ?? ''}`}>
                      {OT_ESTADO_LABEL[m.estado] ?? m.estado}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {m.equipment_marca} {m.equipment_modelo}
                    <span className="ml-1.5 font-mono text-xs font-normal text-slate-400">{m.equipment_codigo}</span>
                  </p>
                  <p className="text-xs text-slate-500">{m.equipment_tipo} · {m.equipment_sede}</p>
                  {totalPasos > 0 && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700">
                        <div className="h-1 rounded-full bg-emerald-500" style={{ width: `${(donePasos / totalPasos) * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-400">{donePasos}/{totalPasos}</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TicketCard({ ticket: t, showAssignee }: { ticket: TicketOut; showAssignee: boolean }) {
  return (
    <Link
      href="/tickets"
      className="block rounded-xl border border-slate-200 bg-white px-4 py-3 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${PRIORIDAD_DOT[t.prioridad ?? 'Media'] ?? PRIORIDAD_DOT.Media}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs font-semibold text-slate-500">{t.numero}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_ESTADO_BADGE[t.estado] ?? 'bg-slate-100 text-slate-600'}`}>
              {TICKET_ESTADO_LABEL[t.estado] ?? t.estado}
            </span>
            {!t.asignado_a_nombre && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
                Sin asignar
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{t.asunto}</p>
          <p className="text-xs text-slate-500">{t.empleado_nombre} · {t.sede}</p>
          {showAssignee && t.asignado_a_nombre && (
            <p className="mt-0.5 text-xs text-slate-400">
              → {t.asignado_a_nombre}
            </p>
          )}
          {t.equipos?.length > 0 && (
            <p className="mt-0.5 text-xs text-slate-400">{t.equipos.map((e) => e.codigo_interno).join(', ')}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
