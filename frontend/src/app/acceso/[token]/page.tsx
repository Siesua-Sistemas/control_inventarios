"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  AccesoModulo, AccesoSesion, ModuloAcceso,
  completarPasoAcceso, infoAcceso, verificarAcceso,
} from '@/lib/api';

const inputCls = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800';

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm font-medium">{label}</label>{children}</div>;
}

export default function AccesoPage() {
  const { token } = useParams<{ token: string }>();
  const [estado, setEstado] = useState<'cargando' | 'invalido' | 'cedula' | 'pasos'>('cargando');
  const [mensaje, setMensaje] = useState('');
  const [modulos, setModulos] = useState<AccesoModulo[]>([]);
  const [cedula, setCedula] = useState('');
  const [sesion, setSesion] = useState<AccesoSesion | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});

  useEffect(() => {
    infoAcceso(token)
      .then((i) => { setModulos(i.modulos); setEstado('cedula'); })
      .catch((e) => { setMensaje(e.message); setEstado('invalido'); });
  }, [token]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const s = await verificarAcceso(token, cedula);
      setSesion(s); setEstado('pasos');
      setF(Object.fromEntries(Object.entries(s.prefill).map(([k, v]) => [k, String(v)])));
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setBusy(false); }
  };

  const pendiente: ModuloAcceso | undefined = sesion?.modulos.find((m) => !sesion.completados.includes(m.codigo))?.codigo;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendiente) return;
    setError('');
    if ((pendiente === 'password' || pendiente === 'nuevo') && f.password !== f.password2) {
      setError('Las contraseñas no coinciden'); return;
    }
    const datos: Record<string, unknown> =
      pendiente === 'nuevo' ? { nombres: f.nombres, apellidos: f.apellidos, email: f.email, telefono: f.telefono || null, cargo: f.cargo || null, password: f.password }
      : pendiente === 'password' ? { password: f.password }
      : pendiente === 'datos' ? { email: f.email, telefono: f.telefono || null }
      : { direccion: f.direccion, ciudad: f.ciudad, latitud: Number(f.latitud), longitud: Number(f.longitud) };
    setBusy(true);
    try {
      const s = await completarPasoAcceso(token, pendiente, cedula, datos);
      setSesion(s);
      setF((p) => ({ ...Object.fromEntries(Object.entries(s.prefill).map(([k, v]) => [k, String(v)])), nombres: p.nombres ?? '' }));
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setBusy(false); }
  };

  const ubicarme = () => {
    if (!navigator.geolocation) { setError('Tu navegador no permite geolocalización; escribe las coordenadas.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setF((x) => ({ ...x, latitud: p.coords.latitude.toFixed(6), longitud: p.coords.longitude.toFixed(6) })),
      () => setError('No se pudo obtener tu ubicación. Revisa los permisos o escribe las coordenadas.'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const paso = sesion ? sesion.modulos.findIndex((m) => m.codigo === pendiente) + 1 : 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        {estado === 'cargando' && <p className="text-center text-slate-500">Cargando…</p>}

        {estado === 'invalido' && (
          <div className="text-center">
            <h1 className="text-xl font-bold">Enlace no disponible</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{mensaje}</p>
          </div>
        )}

        {estado === 'cedula' && (
          <form onSubmit={entrar} className="space-y-4">
            <h1 className="text-xl font-bold">Verifica tu identidad</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Trámites: {modulos.map((m) => m.titulo).join(' → ')}</p>
            <Campo label="Número de cédula">
              <input className={inputCls} value={cedula} onChange={(e) => setCedula(e.target.value)} inputMode="numeric" required autoFocus />
            </Campo>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className="w-full rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">Continuar</button>
          </form>
        )}

        {estado === 'pasos' && sesion && (sesion.terminado || !pendiente ? (
          <div className="text-center">
            <h1 className="text-xl font-bold">¡Listo{sesion.nombre ? `, ${sesion.nombre}` : ''}!</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">Completaste todos los trámites. Este enlace ya no puede usarse de nuevo.</p>
            {sesion.modulos.some((m) => m.codigo === 'nuevo') && (
              <p className="mt-2 text-sm text-slate-500">Tu cuenta quedará activa cuando un administrador la apruebe.</p>
            )}
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-4">
            {sesion.modulos.length > 1 && <p className="text-xs uppercase tracking-widest text-cyan-700 dark:text-cyan-300">Paso {paso} de {sesion.modulos.length}</p>}
            <h1 className="text-xl font-bold">{sesion.modulos.find((m) => m.codigo === pendiente)?.titulo}</h1>

            {pendiente === 'nuevo' && (<>
              <Campo label="Nombres"><input className={inputCls} value={f.nombres ?? ''} onChange={set('nombres')} required minLength={2} /></Campo>
              <Campo label="Apellidos"><input className={inputCls} value={f.apellidos ?? ''} onChange={set('apellidos')} required minLength={2} /></Campo>
              <Campo label="Correo"><input type="email" className={inputCls} value={f.email ?? ''} onChange={set('email')} required /></Campo>
              <Campo label="Teléfono"><input className={inputCls} value={f.telefono ?? ''} onChange={set('telefono')} /></Campo>
              <Campo label="Cargo"><input className={inputCls} value={f.cargo ?? ''} onChange={set('cargo')} /></Campo>
            </>)}
            {pendiente === 'datos' && (<>
              <Campo label="Correo"><input type="email" className={inputCls} value={f.email ?? ''} onChange={set('email')} required /></Campo>
              <Campo label="Teléfono"><input className={inputCls} value={f.telefono ?? ''} onChange={set('telefono')} /></Campo>
            </>)}
            {(pendiente === 'nuevo' || pendiente === 'password') && (<>
              <Campo label="Contraseña (mínimo 8 caracteres)"><input type="password" className={inputCls} value={f.password ?? ''} onChange={set('password')} required minLength={8} autoComplete="new-password" /></Campo>
              <Campo label="Confirmar contraseña"><input type="password" className={inputCls} value={f.password2 ?? ''} onChange={set('password2')} required autoComplete="new-password" /></Campo>
            </>)}
            {pendiente === 'ubicacion' && (<>
              <Campo label="Dirección"><input className={inputCls} value={f.direccion ?? ''} onChange={set('direccion')} required minLength={5} /></Campo>
              <Campo label="Ciudad"><input className={inputCls} value={f.ciudad ?? ''} onChange={set('ciudad')} required /></Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Latitud"><input className={inputCls} value={f.latitud ?? ''} onChange={set('latitud')} required inputMode="decimal" /></Campo>
                <Campo label="Longitud"><input className={inputCls} value={f.longitud ?? ''} onChange={set('longitud')} required inputMode="decimal" /></Campo>
              </div>
              <button type="button" onClick={ubicarme} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold dark:border-slate-600">Usar mi ubicación actual</button>
              <p className="text-xs text-slate-500">Hazlo desde tu lugar de trabajo para que las coordenadas sean correctas.</p>
            </>)}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className="w-full rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">
              {busy ? 'Guardando…' : paso < sesion.modulos.length ? 'Guardar y continuar' : 'Finalizar'}
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}
