"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/mantenimientos', label: 'Dashboard' },
  { href: '/mantenimientos/mi-dia', label: 'Mi agenda' },
  { href: '/mantenimientos/registros', label: 'Registros' },
  { href: '/mantenimientos/calendario', label: 'Calendario' },
  { href: '/mantenimientos/calibraciones', label: 'Calibraciones' },
  { href: '/mantenimientos/configuracion', label: 'Configuración' },
];

export function MantenimientosSubNav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-800">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'border-b-2 border-cyan-500 text-cyan-700 dark:border-cyan-400 dark:text-cyan-300'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
