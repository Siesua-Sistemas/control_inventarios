"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { NavBar } from '@/components/nav-bar';
import { isAuthenticated } from '@/lib/api';

import { MantenimientosDashboardContent } from './_components/mantenimientos-dashboard-content';

export default function MantenimientosDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
  }, [router]);

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Sistema de inventario</p>
          <h1 className="mt-1 text-3xl font-bold">Mantenimientos</h1>
        </div>

        <MantenimientosDashboardContent />
      </main>
    </>
  );
}
