// Colores de estado del sistema — paleta cálida
export const ESTADO_COLORS: Record<string, string> = {
  'Disponible':       'bg-lime-100 text-lime-700 border-lime-300 dark:bg-lime-900/40 dark:text-lime-400 dark:border-lime-700/40',
  'Asignado':         'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/40 dark:text-teal-400 dark:border-teal-700/40',
  'En mantenimiento': 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700/40',
  'En reparación':    'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-700/40',
  'Dañado':           'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700/40',
  'En bodega':        'bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-800/40 dark:text-stone-400 dark:border-stone-700/40',
  'Prestado':         'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-700/40',
  'Perdido':          'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-700/40',
  'Dado de baja':     'bg-stone-200 text-stone-700 border-stone-300 dark:bg-stone-900/50 dark:text-stone-600 dark:border-stone-800',
};

// Colores por tipo de movimiento
export const TIPO_MOV_COLORS: Record<string, string> = {
  'Entrega':    'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/40 dark:text-teal-400 dark:border-teal-700/40',
  'Devolución': 'bg-lime-100 text-lime-700 border-lime-300 dark:bg-lime-900/40 dark:text-lime-400 dark:border-lime-700/40',
  'Traslado':   'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-700/40',
};
