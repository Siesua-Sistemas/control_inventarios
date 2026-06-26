"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import { isAuthenticated } from '@/lib/api';

export default function ConfiguracionPage() {
  const router = useRouter();
  const { loading, hasPermission } = useAuth();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    if (!loading && !hasPermission('equipment_types:write')) {
      router.replace('/inicio');
    }
  }, [loading, hasPermission, router]);

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Sistema de inventario</p>
          <h1 className="mt-1 text-3xl font-bold">Configuración</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/configuracion/tipos-equipo"
            className="rounded-xl border border-slate-200 bg-white p-6 transition-colors hover:border-cyan-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-cyan-600"
          >
            <h2 className="text-lg font-semibold">Tipos de equipo</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Administra los tipos de equipo disponibles y los campos de su ficha técnica.
            </p>
          </Link>
        </div>
      </main>
    </>
  );
}
