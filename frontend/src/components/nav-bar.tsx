"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { logoutUser } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/inicio', label: 'Inicio' },
  { href: '/equipos', label: 'Equipos' },
  { href: '/bodegas', label: 'Bodegas' },
  { href: '/asignaciones', label: 'Asignaciones' },
  { href: '/historial', label: 'Historial' },
  { href: '/empleados', label: 'Empleados' },
  { href: '/users', label: 'Usuarios' },
];

export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logoutUser();
    router.replace('/login');
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/inicio' && pathname.startsWith(href));

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-0">

        {/* Brand */}
        <Link
          href="/inicio"
          className="flex items-center gap-2 py-3 font-bold tracking-wide text-cyan-400 hover:text-cyan-300"
          onClick={() => setOpen(false)}
        >
          <span className="text-xs">◈</span>
          <span>Inventario</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
                isActive(href)
                  ? 'bg-slate-800 font-semibold text-cyan-400'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop logout */}
        <button
          onClick={handleLogout}
          className="hidden md:block ml-4 rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-800 hover:text-slate-200"
        >
          Salir
        </button>

        {/* Mobile: active page + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <span className="text-xs font-medium text-cyan-400">
            {NAV_ITEMS.find((i) => isActive(i.href))?.label ?? ''}
          </span>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
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
        <div className="md:hidden border-t border-slate-800 bg-slate-950 px-4 pb-4 pt-2">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-slate-800 text-cyan-400'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="mt-2 border-t border-slate-800 pt-2">
              <button
                onClick={() => { setOpen(false); handleLogout(); }}
                className="w-full rounded-lg px-4 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-colors"
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
