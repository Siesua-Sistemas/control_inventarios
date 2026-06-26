export type SortDir = 'asc' | 'desc';

export function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es', { sensitivity: 'base' });
}

export function SortableTh<T extends string>(props: {
  field: T; label: string; sortField: T; sortDir: SortDir;
  onSort: (field: T) => void; className?: string;
}) {
  const { field, label, sortField, sortDir, onSort, className = '' } = props;
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
        {label}
        <span className={sortField === field ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-600'}>
          {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    </th>
  );
}
