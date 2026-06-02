// Colores de estado del sistema — paleta cálida
export const ESTADO_COLORS: Record<string, string> = {
  'Disponible':       'bg-lime-900/40 text-lime-400 border-lime-700/40',
  'Asignado':         'bg-teal-900/40 text-teal-400 border-teal-700/40',
  'En mantenimiento': 'bg-amber-900/40 text-amber-400 border-amber-700/40',
  'En reparación':    'bg-orange-900/40 text-orange-400 border-orange-700/40',
  'Dañado':           'bg-red-900/40 text-red-400 border-red-700/40',
  'En bodega':        'bg-stone-800/40 text-stone-400 border-stone-700/40',
  'Prestado':         'bg-violet-900/40 text-violet-400 border-violet-700/40',
  'Perdido':          'bg-orange-900/40 text-orange-400 border-orange-700/40',
  'Dado de baja':     'bg-stone-900/50 text-stone-600 border-stone-800',
};

// Colores por tipo de movimiento
export const TIPO_MOV_COLORS: Record<string, string> = {
  'Entrega':    'bg-teal-900/40 text-teal-400 border-teal-700/40',
  'Devolución': 'bg-lime-900/40 text-lime-400 border-lime-700/40',
  'Traslado':   'bg-violet-900/40 text-violet-400 border-violet-700/40',
};
