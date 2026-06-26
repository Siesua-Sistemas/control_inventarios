import type { AsignacionRow } from '@/lib/api';

const TIPO_BADGE: Record<string, string> = {
  'Entrega': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  'Devolución': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  'Traslado': 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
};

export function MovimientoRow({ m }: { m: AsignacionRow }) {
  const date = new Date(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  return (
    <div className="flex items-center justify-between border-t border-slate-200 py-2.5 first:border-0 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_BADGE[m.tipo] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
          {m.tipo}
        </span>
        <div>
          <p className="text-sm font-medium">
            <span className="font-mono text-cyan-600 dark:text-cyan-500">{m.equipment_codigo}</span>
            <span className="mx-1 text-slate-500">·</span>
            <span>{m.equipment_marca} {m.equipment_modelo}</span>
          </p>
          {m.empleado_nombre && (
            <p className="text-xs text-slate-600 dark:text-slate-400">{m.empleado_nombre}</p>
          )}
        </div>
      </div>
      <span className="shrink-0 text-xs text-slate-500">{date}</span>
    </div>
  );
}
