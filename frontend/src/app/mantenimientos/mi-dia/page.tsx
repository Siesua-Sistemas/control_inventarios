"use client";

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { NavBar } from '@/components/nav-bar';
import { isAuthenticated } from '@/lib/api';

import { MantenimientosSubNav } from '@/app/mantenimientos/_components/mantenimientos-subnav';
import { AgendaContent } from '@/app/inicio/_components/agenda-content';

export default function MiDiaPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login');
  }, [router]);

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-4">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Mantenimiento</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">Mi agenda</h1>
          <p className="mt-1 text-sm text-slate-500">OTs y tickets asignados a ti</p>
        </div>
        <MantenimientosSubNav />
        <AgendaContent />
      </main>
    </>
  );
}
