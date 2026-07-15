"use client";

import { useEffect, useRef, useState } from 'react';
import { listEmpleados, type EmpleadoRow } from '@/lib/api';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (emp: EmpleadoRow) => void;
  placeholder?: string;
  label?: string;
  sede?: string;
  required?: boolean;
  className?: string;
}

export function EmpleadoAutocomplete({ value, onChange, onSelect, placeholder = 'Nombre completo', label, sede, required, className }: Props) {
  const [query, setQuery] = useState(value);
  const [options, setOptions] = useState<EmpleadoRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g. pre-fill)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await listEmpleados({ search: q, sede, limit: 8 });
        setOptions(res.items);
        setOpen(res.items.length > 0);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, sede]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function select(emp: EmpleadoRow) {
    const name = emp.nombre_completo;
    setQuery(name);
    onChange(name);
    onSelect?.(emp);
    setOpen(false);
    setOptions([]);
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      {label && (
        <span className="mb-1 block text-xs text-slate-600 dark:text-slate-400">{label}{required && ' *'}</span>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => { if (options.length > 0) setOpen(true); }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-600 dark:border-t-indigo-400" />
          </div>
        )}
      </div>

      {open && options.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
          {options.map((emp) => (
            <li key={emp.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(emp); }}
                className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
              >
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{emp.nombre_completo}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {[emp.cargo, emp.sede].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
