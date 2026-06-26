"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import { isAuthenticated } from '@/lib/api';

import { AgendaContent } from './_components/agenda-content';
import { EntregasDashboardContent } from './_components/entregas-dashboard';
import { GeneralDashboardContent } from './_components/general-dashboard';
import { InventarioDashboardContent } from './_components/inventario-dashboard';

const HEADERS: Record<string, { title: string }> = {
  general: { title: 'Panel de control' },
  inventario: { title: 'Inventario y compras' },
  entregas: { title: 'Entregas y movimientos' },
  tecnico: { title: 'Mi agenda' },
};

export default function InicioPage() {
  const router = useRouter();
  const { loading: authLoading, profile } = useAuth();

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
  }, [router]);

  const dashboard = profile?.home_dashboard ?? 'general';
  const { title } = HEADERS[dashboard] ?? HEADERS.general;

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Sistema de inventario</p>
          <h1 className="mt-1 text-3xl font-bold">{title}</h1>
        </div>

        {authLoading ? (
          <p className="text-slate-600 dark:text-slate-400">Cargando...</p>
        ) : dashboard === 'tecnico' ? (
          <AgendaContent />
        ) : dashboard === 'inventario' ? (
          <InventarioDashboardContent />
        ) : dashboard === 'entregas' ? (
          <EntregasDashboardContent />
        ) : (
          <GeneralDashboardContent />
        )}
      </main>
    </>
  );
}
