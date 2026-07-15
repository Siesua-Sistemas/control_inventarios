"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { useTheme } from '@/components/theme-provider';
import { logoutUser } from '@/lib/api';

type NavLink = { href: string; label: string; permission: string | null };
type NavGroup = { label: string; links: NavLink[] };
type NavItem = NavLink | NavGroup;

function isNavGroup(item: NavItem): item is NavGroup {
  return 'links' in item;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/inicio', label: 'Inicio', permission: null },
  { label: 'Inventario', links: [
    { href: '/equipos', label: 'Equipos', permission: 'equipment:read' },
    { href: '/bodegas', label: 'Bodegas', permission: 'bodegas:read' },
  ]},
  { label: 'Movimientos', links: [
    { href: '/asignaciones', label: 'Asignaciones', permission: 'asignaciones:read' },
    { href: '/historial', label: 'Historial', permission: 'asignaciones:read' },
    { href: '/actas', label: 'Actas de entrega', permission: null },
  ]},
  { label: 'Mantenimiento', links: [
    { href: '/mantenimientos', label: 'Panel', permission: 'mantenimientos:read' },
    { href: '/mantenimientos/mi-dia', label: 'Mi agenda', permission: 'mantenimientos:read' },
    { href: '/mantenimientos/registros', label: 'Órdenes de trabajo', permission: 'mantenimientos:read' },
    { href: '/mantenimientos/calendario', label: 'Calendario', permission: 'mantenimientos:read' },
    { href: '/mantenimientos/calibraciones', label: 'Calibraciones', permission: 'mantenimientos:read' },
    { href: '/mantenimientos/configuracion', label: 'Configuración', permission: 'mantenimientos:write' },
  ]},
  { label: 'Personal', links: [
    { href: '/empleados', label: 'Empleados', permission: 'empleados:read' },
    { href: '/credenciales', label: 'Credenciales', permission: 'credenciales:read' },
    { href: '/jornada/dashboard', label: 'Asistencia', permission: 'jornada:read' },
    { href: '/jornada/reporte', label: 'Reporte semanal', permission: 'jornada:read' },
    { href: '/jornada/admin/sedes', label: 'Ubicaciones', permission: 'jornada:admin' },
  ]},
  { label: 'Mi espacio', links: [
    { href: '/jornada', label: 'Mi Jornada', permission: null },
    { href: '/tickets', label: 'Mis tickets', permission: 'tickets:read' },
    { href: '/portal', label: 'Mi portal', permission: null },
  ]},
  { label: 'Administración', links: [
    { href: '/users', label: 'Usuarios', permission: 'users:read' },
    { href: '/users/roles', label: 'Roles y permisos', permission: 'roles:read' },
    { href: '/configuracion/tipos-equipo', label: 'Tipos de equipo', permission: 'equipment_types:write' },
    { href: '/configuracion/redes-wifi', label: 'Redes WiFi', permission: 'wifi:write' },
    { href: '/admin/integraciones', label: 'Integraciones', permission: 'roles:write' },
  ]},
];

function getVisibleItems(items: NavItem[], loading: boolean, hasPermission: (code: string) => boolean): NavItem[] {
  return items.reduce<NavItem[]>((acc, item) => {
    if (isNavGroup(item)) {
      const links = item.links.filter((l) => !l.permission || loading || hasPermission(l.permission));
      if (links.length > 0) acc.push({ ...item, links });
    } else if (!item.permission || loading || hasPermission(item.permission)) {
      acc.push(item);
    }
    return acc;
  }, []);
}

function getAllLinks(items: NavItem[]): NavLink[] {
  return items.flatMap((item) => (isNavGroup(item) ? item.links : [item]));
}

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

function NavDropdown({ group, isActive }: { group: NavGroup; isActive: (href: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const groupActive = group.links.some((l) => isActive(l.href));

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
          groupActive
            ? 'bg-slate-100 font-semibold text-cyan-600 dark:bg-slate-800 dark:text-cyan-400'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
        }`}
      >
        {group.label}
        <svg className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          {group.links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2 text-sm transition-colors ${
                isActive(href)
                  ? 'font-semibold text-cyan-600 dark:text-cyan-400'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}


export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { loading, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await logoutUser();
    router.replace('/login');
  };

  const visibleItems = useMemo(() => getVisibleItems(NAV_ITEMS, loading, hasPermission), [loading, hasPermission]);
  const allLinks = useMemo(() => getAllLinks(visibleItems), [visibleItems]);

  const activeHref = useMemo(() => {
    let best: string | null = null;
    for (const link of allLinks) {
      const matches = pathname === link.href || (link.href !== '/inicio' && pathname.startsWith(`${link.href}/`));
      if (matches && (!best || link.href.length > best.length)) {
        best = link.href;
      }
    }
    return best;
  }, [pathname, allLinks]);

  const isActive = (href: string) => href === activeHref;

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const activeLabel = allLinks.find((l) => isActive(l.href))?.label ?? '';

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
          {visibleItems.map((item) =>
            isNavGroup(item) ? (
              <NavDropdown key={item.label} group={item} isActive={isActive} />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive(item.href)
                    ? 'bg-slate-100 font-semibold text-cyan-600 dark:bg-slate-800 dark:text-cyan-400'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </Link>
            )
          )}
        </div>

        {/* Desktop: theme toggle + logout */}
        <div className="hidden md:flex items-center gap-2 ml-4">
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
            {activeLabel}
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
            {visibleItems.map((item) => {
              if (isNavGroup(item)) {
                const expanded = expandedGroups.has(item.label);
                const groupActive = item.links.some((l) => isActive(l.href));
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => toggleGroup(item.label)}
                      className={`flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                        groupActive
                          ? 'text-cyan-600 dark:text-cyan-400'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                      }`}
                    >
                      <span>{item.label}</span>
                      <svg className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expanded && (
                      <div className="ml-4 flex flex-col gap-1 border-l border-slate-200 pl-3 dark:border-slate-800">
                        {item.links.map(({ href, label }) => (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOpen(false)}
                            className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                              isActive(href)
                                ? 'bg-slate-100 text-cyan-600 dark:bg-slate-800 dark:text-cyan-400'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                            }`}
                          >
                            {label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-slate-100 text-cyan-600 dark:bg-slate-800 dark:text-cyan-400'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
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
