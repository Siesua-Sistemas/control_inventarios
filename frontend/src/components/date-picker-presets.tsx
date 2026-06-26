"use client";

import { useEffect, useRef, useState } from 'react';

type Preset = { label: string; months: number | null };

const PRESETS: Preset[] = [
  { label: '1 Mes', months: 1 },
  { label: '3 Meses', months: 3 },
  { label: '6 Meses', months: 6 },
  { label: '1 Año', months: 12 },
  { label: '2 Años', months: 24 },
  { label: 'Sin fecha', months: null },
];

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function formatDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

interface DatePickerPresetsProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function DatePickerPresets({ id, value, onChange, required }: DatePickerPresetsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    if (open) dateRef.current?.focus();
  }, [open]);

  function selectPreset(months: number | null) {
    onChange(months !== null ? addMonths(months) : '');
    setOpen(false);
  }

  const triggerBase =
    'w-full flex items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-left outline-none transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
  const triggerFocus = open ? 'border-[#D46A3A] dark:border-[#D46A3A]' : 'hover:border-slate-400 dark:hover:border-slate-600';

  return (
    <div ref={ref} className="relative">
      {/* Hidden input for form required validation */}
      {required && <input type="hidden" value={value} required />}

      {/* Trigger */}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${triggerBase} ${triggerFocus}`}
      >
        <span className={value ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}>
          {value ? formatDisplay(value) : 'dd/mm/aaaa'}
        </span>
        <svg className="ml-2 h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 z-50 mt-1 w-full min-w-[240px] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          {/* Quick presets */}
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Acceso rápido</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const target = p.months !== null ? addMonths(p.months) : '';
              const isActive = value === target || (p.months === null && !value);
              return (
                <button
                  key={p.label}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectPreset(p.months)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="mb-3 border-t border-slate-200 dark:border-slate-700" />

          {/* Native date input */}
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Fecha personalizada</p>
          <input
            ref={dateRef}
            type="date"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              if (e.target.value) setOpen(false);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#D46A3A] dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </div>
      )}
    </div>
  );
}
