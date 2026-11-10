"use client";

import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import {
  CedulaInfo, EnlaceAcceso, EnlaceAccesoCreado, ModuloAcceso,
  consultarCedulaEnlace, crearEnlaceAcceso, isAuthenticated, listarEnlacesAcceso, revocarEnlaceAcceso,
} from '@/lib/api';

const MODULOS: { codigo: ModuloAcceso; titulo: string; desc: string }[] = [
  { codigo: 'nuevo', titulo: 'Alta nueva: empleado + usuario de acceso', desc: 'Cédula no registrada: datos de la persona y su cuenta (correo y contraseña)' },
  { codigo: 'nuevo_empleado', titulo: 'Alta nueva: solo empleado', desc: 'Cédula no registrada: solo la ficha del empleado, sin cuenta de ingreso' },
  { codigo: 'cuenta', titulo: 'Crear usuario de acceso', desc: 'Empleado ya registrado sin cuenta: define su correo y contraseña' },
  { codigo: 'password', titulo: 'Cambio / restablecimiento de contraseña', desc: 'Definir una nueva clave' },
  { codigo: 'datos', titulo: 'Actualización de datos generales', desc: 'Correo y teléfono de contacto' },
  { codigo: 'ubicacion', titulo: 'Ubicación Home Office', desc: 'Dirección, ciudad y coordenadas del puesto remoto' },
];

const ESTADO_BADGE: Record<string, string> = {
  activo: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  usado: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  expirado: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  revocado: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  bloqueado: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
};

const fmt = (iso: string) =>
  new Date(iso + 'Z').toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function EnlacesPage() {
  const router = useRouter();
  const [cedula, setCedula] = useState('');
  const [info, setInfo] = useState<CedulaInfo | null>(null);
  const [modulos, setModulos] = useState<ModuloAcceso[]>([]);
  const [horas, setHoras] = useState(24);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [creado, setCreado] = useState<EnlaceAccesoCreado | null>(null);
  const [url, setUrl] = useState('');
  const [qr, setQr] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [lista, setLista] = useState<EnlaceAcceso[]>([]);

  const cargarLista = useCallback(() => {
    listarEnlacesAcceso().then(setLista).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    cargarLista();
  }, [router, cargarLista]);

  // Validación inicial: al escribir la cédula se consulta si existe y se preselecciona el flujo.
  useEffect(() => {
    const c = cedula.replace(/[\s.\-]/g, '');
    setInfo(null);
    if (c.length < 5) return;
    const t = setTimeout(() => {
      consultarCedulaEnlace(c).then((i) => {
        setInfo(i);
        const altas: ModuloAcceso[] = ['nuevo', 'nuevo_empleado'];
        setModulos(i.existe
          ? (m) => m.filter((x) => !altas.includes(x))
          : (m) => (m.some((x) => altas.includes(x)) ? m : ['nuevo', ...m.filter((x) => x === 'ubicacion')]));
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [cedula]);

  // Las dos altas son excluyentes entre sí; "crear usuario" y "cambiar contraseña" también.
  const EXCLUYE: Partial<Record<ModuloAcceso, ModuloAcceso>> = {
    nuevo: 'nuevo_empleado', nuevo_empleado: 'nuevo', cuenta: 'password', password: 'cuenta',
  };
  const toggle = (m: ModuloAcceso) =>
    setModulos((cur) => {
      if (cur.includes(m)) return cur.filter((x) => x !== m);
      return [...cur.filter((x) => x !== EXCLUYE[m]), m];
    });

  const bloqueado = (m: ModuloAcceso) => {
    if (!info) return true;
    if (info.existe) {
      if (m === 'nuevo' || m === 'nuevo_empleado') return true;
      if (m === 'cuenta') return info.tiene_cuenta;
      return m === 'password' && !info.tiene_cuenta;
    }
    return !['nuevo', 'nuevo_empleado', 'ubicacion'].includes(m);
  };

  const generar = async () => {
    setBusy(true); setError('');
    try {
      const e = await crearEnlaceAcceso(cedula.replace(/[\s.\-]/g, ''), modulos, horas);
      const link = `${window.location.origin}${e.ruta}`;
      setCreado(e); setUrl(link);
      setQr(await QRCode.toDataURL(link, { width: 320, margin: 2 }));
      setCopiado(false);
      cargarLista();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el enlace');
    } finally { setBusy(false); }
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
  };

  const revocar = async (id: number) => {
    if (!confirm('¿Revocar este enlace? Dejará de funcionar de inmediato.')) return;
    await revocarEnlaceAcceso(id).catch(() => {});
    cargarLista();
  };

  const input = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800';

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Administración</p>
        <h1 className="mt-2 text-3xl font-bold">Enlaces y QR de acceso</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Genera un enlace de un solo uso para que una persona complete sus trámites. Debe confirmar su cédula al abrirlo.
        </p>

        <section className="mt-6 grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Cédula (obligatoria)</label>
              <input className={input} value={cedula} onChange={(e) => setCedula(e.target.value)} inputMode="numeric" placeholder="Documento de identidad" />
              {info && (
                <p className={`mt-1 text-sm ${info.existe && !info.activo ? 'text-red-600' : 'text-slate-600 dark:text-slate-400'}`}>
                  {info.existe
                    ? `${info.nombre} — ${info.activo ? 'empleado registrado' : 'empleado inactivo'}${info.activo ? (info.tiene_cuenta ? ' · ya tiene cuenta de acceso' : ' · sin cuenta de acceso: puedes crearle una') : ''}`
                    : 'Cédula no registrada: elige el tipo de alta (empleado + usuario, o solo empleado).'}
                </p>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Trámites a habilitar</legend>
              {MODULOS.map((m) => (
                <label key={m.codigo} className={`flex items-start gap-3 rounded-lg border p-3 ${bloqueado(m.codigo) ? 'opacity-40' : 'cursor-pointer'} border-slate-200 dark:border-slate-700`}>
                  <input type="checkbox" className="mt-1" disabled={bloqueado(m.codigo)} checked={modulos.includes(m.codigo)} onChange={() => toggle(m.codigo)} />
                  <span><span className="block font-medium">{m.titulo}</span><span className="text-xs text-slate-500">{m.desc}</span></span>
                </label>
              ))}
            </fieldset>

            <div>
              <label className="mb-1 block text-sm font-medium">Vigencia</label>
              <select className={input} value={horas} onChange={(e) => setHoras(Number(e.target.value))}>
                <option value={1}>1 hora</option><option value={24}>24 horas</option>
                <option value={48}>48 horas</option><option value={72}>72 horas</option><option value={168}>7 días</option>
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={generar} disabled={busy || !info || modulos.length === 0 || (info.existe && !info.activo)}
              className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">
              {busy ? 'Generando…' : 'Generar enlace'}
            </button>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
            {creado ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Código QR del enlace" className="h-56 w-56 rounded bg-white p-1" />
                <input readOnly value={url} onFocus={(e) => e.target.select()} className={`${input} text-xs`} />
                <div className="flex gap-2">
                  <button onClick={copiar} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold dark:border-slate-600">
                    {copiado ? '¡Copiado!' : 'Copiar enlace'}
                  </button>
                  <a href={qr} download={`qr-acceso-${creado.cedula}.png`} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold dark:border-slate-600">
                    Descargar QR
                  </a>
                </div>
                <p className="text-center text-xs text-slate-500">Vence {fmt(creado.expires_at)}. Este enlace no se vuelve a mostrar: cópialo ahora.</p>
              </>
            ) : (
              <p className="text-center text-sm text-slate-500">El enlace y el QR aparecerán aquí.</p>
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Enlaces recientes</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
                <tr><th className="p-3">Cédula</th><th className="p-3">Persona</th><th className="p-3">Trámites</th><th className="p-3">Estado</th><th className="p-3">Vence</th><th className="p-3" /></tr>
              </thead>
              <tbody>
                {lista.map((e) => (
                  <tr key={e.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="p-3">{e.cedula}</td>
                    <td className="p-3">{e.nombre ?? '—'}</td>
                    <td className="p-3">{e.modulos.map((m) => `${e.pasos_completados.includes(m) ? '✓ ' : ''}${MODULOS.find((x) => x.codigo === m)?.titulo.replace('Alta nueva: ', '').split(' ').slice(0, 2).join(' ')}`).join(', ')}</td>
                    <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_BADGE[e.estado]}`}>{e.estado}</span></td>
                    <td className="p-3">{fmt(e.expires_at)}</td>
                    <td className="p-3 text-right">{e.estado === 'activo' && <button onClick={() => revocar(e.id)} className="text-red-600 hover:underline">Revocar</button>}</td>
                  </tr>
                ))}
                {lista.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-500">Sin enlaces generados.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
