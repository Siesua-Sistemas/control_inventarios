"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { useTheme } from '@/components/theme-provider';
import { logoutUser } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/inicio', label: 'Inicio', permission: null as string | null },
  { href: '/equipos', label: 'Equipos', permission: 'equipment:read' },
  { href: '/bodegas', label: 'Bodegas', permission: 'bodegas:read' },
  { href: '/asignaciones', label: 'Asignaciones', permission: 'asignaciones:read' },
  { href: '/historial', label: 'Historial', permission: 'asignaciones:read' },
  { href: '/empleados', label: 'Empleados', permission: 'empleados:read' },
  { href: '/users', label: 'Usuarios', permission: 'users:read' },
];

function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
      className={className}
    >
      {theme === 'dark' ? (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.36 6.36l-.7-.7M6.34 6.34l-.7-.7m12.02 0l-.7.7M6.34 17.66l-.7.7M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { loading, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await logoutUser();
    router.replace('/login');
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/inicio' && pathname.startsWith(href));

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || loading || hasPermission(item.permission));

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-0">

        {/* Brand */}
        <Link
          href="/inicio"
          className="flex items-center gap-2 py-3 font-bold tracking-wide text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
          onClick={() => setOpen(false)}
        >
          <span className="text-xs">◈</span>
          <span>Inventario</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {visibleItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
                isActive(href)
                  ? 'bg-slate-100 font-semibold text-cyan-600 dark:bg-slate-800 dark:text-cyan-400'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop: theme toggle + logout */}
        <div className="hidden md:flex items-center gap-1 ml-4">
          <ThemeToggle className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors" />
          <button
            onClick={handleLogout}
            className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            Salir
          </button>
        </div>

        {/* Mobile: active page + theme toggle + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
            {visibleItems.find((i) => isActive(i.href))?.label ?? ''}
          </span>
          <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors" />
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
            aria-label="Menú"
          >
            {open ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pb-4 pt-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-1">
            {visibleItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-slate-100 text-cyan-600 dark:bg-slate-800 dark:text-cyan-400'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
              <button
                onClick={() => { setOpen(false); toggleTheme(); }}
                className="w-full rounded-lg px-4 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                {theme === 'dark' ? '☀ Modo claro' : '🌙 Modo oscuro'}
              </button>
              <button
                onClick={() => { setOpen(false); handleLogout(); }}
                className="w-full rounded-lg px-4 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
