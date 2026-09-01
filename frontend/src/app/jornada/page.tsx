"use client";

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  DiaRegistros,
  HoyJornadaResponse,
  SedeInfoOut,
  SemanaJornadaResponse,
  getJornadaHoy,
  getJornadaSemana,
  registrarJornada,
} from '@/lib/api';
import { CamaraJornada, CamaraJornadaRef } from '@/components/camara-jornada';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });
}

function formatFechaLarga() {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  });
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useReloj() {
  const [hora, setHora] = useState('');
  useEffect(() => {
    const tick = () =>
      setHora(
        new Date().toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'America/Bogota',
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return hora;
}

type GpsEstado = 'obteniendo' | 'ok' | 'denegado' | 'no-soportado';

function useGps() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [estado, setEstado] = useState<GpsEstado>('obteniendo');

  useEffect(() => {
    if (!navigator.geolocation) {
      setEstado('no-soportado');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setEstado('ok');
      },
      () => setEstado('denegado'),
      { timeout: 12000, enableHighAccuracy: true },
    );
  }, []);

  return { coords, estado };
}

// ── Geovalla helpers ──────────────────────────────────────────────────────────

function distanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type GeovallaEstado = 'obteniendo' | 'dentro' | 'fuera' | 'sin-config' | 'sin-gps' | 'ip-ok';

function calcGeovalla(
  gpsEstado: GpsEstado,
  coords: { lat: number; lon: number } | null,
  sedesInfo: SedeInfoOut[],
): { estado: GeovallaEstado; distancia: number | null; sedeActual: SedeInfoOut | null } {
  if (gpsEstado === 'obteniendo') return { estado: 'obteniendo', distancia: null, sedeActual: null };
  if (sedesInfo.length === 0) return { estado: 'sin-config', distancia: null, sedeActual: null };
  if (!coords) return { estado: 'sin-gps', distancia: null, sedeActual: null };

  const conDist = sedesInfo.map((s) => ({
    sede: s,
    dist: distanciaMetros(coords.lat, coords.lon, s.latitud, s.longitud),
  }));

  const dentro = conDist.find((x) => x.dist <= x.sede.radio_metros);
  if (dentro) return { estado: 'dentro', distancia: Math.round(dentro.dist), sedeActual: dentro.sede };

  const closest = conDist.reduce((a, b) => (a.dist < b.dist ? a : b));
  return { estado: 'fuera', distancia: Math.round(closest.dist), sedeActual: closest.sede };
}

// ── GeovallaBadge ─────────────────────────────────────────────────────────────

function GeovallaBadge({
  estado,
  sedeActual,
}: {
  estado: GeovallaEstado;
  sedeActual: SedeInfoOut | null;
}) {
  const cfgs: Record<GeovallaEstado, { cls: string; dot: string; label: string }> = {
    'ip-ok': {
      cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      dot: 'bg-emerald-500',
      label: sedeActual ? `Red verificada · ${sedeActual.nombre}` : 'Red de sede verificada',
    },
    obteniendo: {
      cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      dot: 'bg-amber-400 animate-pulse',
      label: 'Obteniendo ubicación…',
    },
    dentro: {
      cls: sedeActual?.tipo === 'home_office'
        ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      dot: sedeActual?.tipo === 'home_office' ? 'bg-violet-500' : 'bg-emerald-500',
      label: sedeActual?.tipo === 'home_office'
        ? `Home Office${sedeActual ? ` · ${sedeActual.nombre}` : ''}`
        : `En sede${sedeActual ? ` ${sedeActual.nombre}` : ''}`,
    },
    fuera: {
      cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      dot: 'bg-red-500',
      label: `Fuera de rango${sedeActual ? ` · ${sedeActual.nombre}` : ''}`,
    },
    'sin-config': {
      cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
      dot: 'bg-slate-400',
      label: 'Sin restricción de zona',
    },
    'sin-gps': {
      cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
      dot: 'bg-slate-400',
      label: 'Ubicación no disponible',
    },
  };
  const cfg = cfgs[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cfg.cls}`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── SemanaView ────────────────────────────────────────────────────────────────

function SemanaView({ semana }: { semana: SemanaJornadaResponse }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-cyan-600 dark:text-cyan-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
        </svg>
        <h2 className="text-sm font-semibold">Esta semana</h2>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {semana.dias.map((dia) => (
          <DiaRow key={dia.fecha} dia={dia} />
        ))}
      </div>
    </div>
  );
}

function DiaRow({ dia }: { dia: DiaRegistros }) {
  const esFuturo = !dia.es_hoy && dia.registros.length === 0 &&
    new Date(dia.fecha + 'T00:00:00') > new Date();

  const entrada = dia.registros.find((r) => r.tipo === 'entrada');
  const salida = dia.registros.find((r) => r.tipo === 'salida');

  return (
    <div className={`flex items-center gap-3 px-5 py-3 ${
      dia.es_hoy
        ? 'bg-cyan-50 dark:bg-cyan-900/10'
        : ''
    }`}>
      {/* Día */}
      <div className="w-20 shrink-0">
        <p className={`text-xs font-semibold ${dia.es_hoy ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-600 dark:text-slate-300'}`}>
          {dia.es_hoy ? 'Hoy' : dia.dia_semana}
        </p>
        <p className="text-[11px] text-slate-400">
          {new Date(dia.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
        </p>
      </div>

      {/* Entrada */}
      <div className="flex-1">
        {entrada ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />
            </svg>
            {formatHora(entrada.timestamp)}
          </span>
        ) : (
          <span className={`text-xs ${esFuturo ? 'text-slate-200 dark:text-slate-700' : 'text-slate-300 dark:text-slate-600'}`}>—</span>
        )}
      </div>

      {/* Salida */}
      <div className="flex-1">
        {salida ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            {formatHora(salida.timestamp)}
          </span>
        ) : entrada && dia.es_hoy ? (
          <span className="text-xs text-amber-500 dark:text-amber-400">En curso</span>
        ) : (
          <span className={`text-xs ${esFuturo ? 'text-slate-200 dark:text-slate-700' : 'text-slate-300 dark:text-slate-600'}`}>—</span>
        )}
      </div>

      {/* Tiempo en sede */}
      <div className="w-16 shrink-0 text-right">
        {dia.tiempo_sede ? (
          <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">{dia.tiempo_sede}</span>
        ) : (
          <span className="text-xs text-slate-200 dark:text-slate-700">—</span>
        )}
      </div>
    </div>
  );
}

// ── JornadaContent ────────────────────────────────────────────────────────────

function JornadaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const hora = useReloj();
  const { coords, estado: gpsEstado } = useGps();
  const camaraRef = useRef<CamaraJornadaRef>(null);
  const prevUrlRef = useRef<string | null>(null);

  const [step, setStep] = useState<'input' | 'jornada' | 'confirmado'>('input');
  const [cedula, setCedula] = useState('');
  const [data, setData] = useState<HoyJornadaResponse | null>(null);
  const [semana, setSemana] = useState<SemanaJornadaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [registrando, setRegistrando] = useState(false);
  const [regError, setRegError] = useState('');
  const [ultimoTipo, setUltimoTipo] = useState<'entrada' | 'salida'>('entrada');
  const [selfiePrevUrl, setSelfiePrevUrl] = useState<string | null>(null);
  const [ultimaHora, setUltimaHora] = useState('');

  const didLoad = useRef(false);
  const docParam = searchParams.get('doc');

  useEffect(() => {
    if (docParam && !didLoad.current) {
      didLoad.current = true;
      setCedula(docParam);
      cargar(docParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docParam]);

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  async function cargar(doc: string) {
    setLoading(true);
    setError('');
    try {
      const [hoy, sem] = await Promise.all([getJornadaHoy(doc), getJornadaSemana(doc)]);
      setData(hoy);
      setSemana(sem);
      setStep('jornada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar');
    } finally {
      setLoading(false);
    }
  }

  const handleVerificar = async (e: React.FormEvent) => {
    e.preventDefault();
    await cargar(cedula.trim());
  };

  const handleRegistrar = async () => {
    if (!data) return;
    setRegistrando(true);
    setRegError('');
    try {
      const tipoActual = data.proximo;

      const blob = await camaraRef.current?.capturar() ?? null;

      if (!blob) {
        setRegError('La foto es obligatoria. Asegúrate de que la cámara esté activa y vuelve a intentarlo.');
        return;
      }

      if (blob) {
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        const url = URL.createObjectURL(blob);
        prevUrlRef.current = url;
        setSelfiePrevUrl(url);
      }

      await registrarJornada(cedula, {
        foto: blob ?? undefined,
        latitud: coords?.lat,
        longitud: coords?.lon,
      });

      setUltimoTipo(tipoActual);
      setUltimaHora(new Date().toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota',
      }));

      const [updated, sem] = await Promise.all([getJornadaHoy(cedula), getJornadaSemana(cedula)]);
      setData(updated);
      setSemana(sem);
      setStep('confirmado');
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Error al registrar');
    } finally {
      setRegistrando(false);
    }
  };

  const volverAJornada = () => {
    setStep('jornada');
    setRegError('');
  };

  const cerrar = () => {
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }
    setSelfiePrevUrl(null);
    setStep('input');
    setCedula('');
    setData(null);
    setSemana(null);
    setError('');
    didLoad.current = false;
  };

  // ── Step: input ──────────────────────────────────────────────────────────

  if (step === 'input') {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm items-center justify-center px-4">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 dark:bg-cyan-900/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8 text-cyan-600 dark:text-cyan-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Control de asistencia</p>
          <h1 className="mt-2 text-2xl font-bold">Nuestro Horario</h1>
          <p className="mt-2 mb-6 text-sm text-slate-600 dark:text-slate-300">
            Ingresa tu cédula para registrar tu entrada o salida.
          </p>
          <form onSubmit={handleVerificar} className="space-y-4">
            <div>
              <label htmlFor="cedula">Número de documento</label>
              <input
                id="cedula"
                type="text"
                inputMode="numeric"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="Ej: 12345678"
                required
                autoFocus
              />
            </div>
            {error && (
              <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 disabled:opacity-60">
              {loading ? 'Verificando...' : 'Continuar'}
            </button>
            <button type="button" onClick={() => router.push('/login')}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              ← Volver al inicio
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ── Step: confirmado ─────────────────────────────────────────────────────

  if (step === 'confirmado' && data) {
    const isEntrada = ultimoTipo === 'entrada';
    return (
      <main className="mx-auto flex min-h-screen max-w-sm items-center justify-center px-4">
        <div className={`w-full rounded-2xl border bg-white p-8 text-center shadow-2xl dark:bg-slate-900 ${
          isEntrada ? 'border-emerald-200 dark:border-emerald-700' : 'border-slate-200 dark:border-slate-700'
        }`}>
          {/* Selfie */}
          {selfiePrevUrl ? (
            <div className="mx-auto mb-5 h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-lg dark:border-slate-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selfiePrevUrl} alt="Tu foto" className="h-full w-full object-cover [transform:scaleX(-1)]" />
            </div>
          ) : (
            <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full ${
              isEntrada ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-slate-100 dark:bg-slate-800'
            }`}>
              {isEntrada ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10 text-emerald-600 dark:text-emerald-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10 text-slate-500 dark:text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              )}
            </div>
          )}

          <h2 className="text-xl font-bold">{isEntrada ? '¡Bienvenido!' : '¡Hasta pronto!'}</h2>
          <p className="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">
            {data.nombres} {data.apellidos}
          </p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {isEntrada ? 'Entrada' : 'Salida'} registrada correctamente
          </p>

          <div className="mt-4 inline-block rounded-xl bg-slate-50 px-8 py-3 dark:bg-slate-800">
            <p className="font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {ultimaHora}
            </p>
            {data.sede && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{data.sede}</p>
            )}
          </div>

          <div className="mt-6 space-y-2">
            <button onClick={volverAJornada}
              className={`w-full rounded-xl py-3 font-semibold text-white ${
                isEntrada ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-600 hover:bg-slate-700'
              }`}>
              Ver mi semana
            </button>
            <button onClick={cerrar}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              Otro colaborador
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Step: jornada ────────────────────────────────────────────────────────

  if (!data) return null;

  const proximo = data.proximo;
  const isEntrada = proximo === 'entrada';

  // IP primero, luego GPS con geovalla. Se calcula igual para entrada y salida.
  const ipOk = data.ip_verificada;
  // Geovalla usa todas las sedes activas: si el empleado fue enviado a cubrir otra sede
  // sin actualizar su perfil, el GPS lo ubica en esa sede y no lo bloquea
  const sedesParaGeo = (data.todas_sedes_info?.length ? data.todas_sedes_info : data.sedes_info) ?? [];
  const geoResult = ipOk
    ? { estado: 'ip-ok' as GeovallaEstado, distancia: null, sedeActual: null }
    : calcGeovalla(gpsEstado, coords, sedesParaGeo);
  const geovallaEstado = geoResult.estado;
  const sedeActual = geoResult.sedeActual;
  // Sin ninguna señal de ubicación (ni IP autorizada ni GPS): bloquea tanto entrada como
  // salida, porque no quedaría ninguna evidencia de dónde se hizo el registro.
  const sinNingunaSenal = !ipOk && geovallaEstado === 'sin-gps';
  // Fuera de rango pero CON GPS: bloquea solo la entrada. La salida se permite y queda
  // marcada como novedad (sí hay evidencia de ubicación, solo que fuera del radio).
  const fueraDeRangoEntrada = isEntrada && !ipOk && geovallaEstado === 'fuera';
  const bloqueado = sinNingunaSenal || fueraDeRangoEntrada;
  const salidaSinVerificar = !isEntrada && !ipOk && geovallaEstado === 'fuera';

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-700 dark:text-cyan-300">Nuestro Horario</p>
            <h1 className="mt-0.5 text-base font-bold leading-tight">
              {data.nombres} {data.apellidos}
            </h1>
            {(data.cargo || data.sede) && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {[data.cargo, data.sede].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button type="button" onClick={cerrar}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            ← Salir
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-5">

        {/* Reloj + cámara circular */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-5 p-5">
            {/* Cámara redonda */}
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-slate-100 shadow-inner dark:border-slate-700">
              <CamaraJornada ref={camaraRef} circular className="h-full w-full" />
            </div>

            {/* Reloj y fecha */}
            <div className="min-w-0">
              <p className="font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                {hora || '––:––:––'}
              </p>
              <p className="mt-0.5 text-xs capitalize text-slate-500 dark:text-slate-400">{formatFechaLarga()}</p>
            </div>
          </div>

          {/* Controles */}
          <div className="space-y-3 border-t border-slate-100 p-4 dark:border-slate-800">
            {/* Estado geovalla */}
            <div className="flex justify-center">
              <GeovallaBadge estado={geovallaEstado} sedeActual={sedeActual} />
            </div>

            {/* Mensaje bloqueado — sin GPS bloquea entrada y salida; fuera de rango solo entrada */}
            {bloqueado && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {geovallaEstado === 'sin-gps'
                  ? `Activa la ubicación (GPS) en tu navegador para poder registrar tu ${isEntrada ? 'entrada' : 'salida'}.`
                  : (
                    <>
                      Debes estar a menos de {sedeActual?.radio_metros ?? 100} m de{' '}
                      <strong>{sedeActual?.nombre ?? 'la sede asignada'}</strong>.
                    </>
                  )}
              </p>
            )}

            {/* Aviso no bloqueante — la salida siempre se permite, pero queda marcada */}
            {salidaSinVerificar && (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-center text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                ⚠ No pudimos verificar tu ubicación
              </p>
            )}


            {regError && (
              <p className="rounded-md bg-red-100 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">
                {regError}
              </p>
            )}

            {!bloqueado && (
              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                {isEntrada
                  ? 'Mira a la cámara y pulsa el botón para registrar tu entrada'
                  : 'Pulsa el botón para registrar tu salida'}
              </p>
            )}

            <button
              type="button"
              onClick={handleRegistrar}
              disabled={registrando || bloqueado}
              className={`w-full rounded-xl py-4 text-base font-bold text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
                isEntrada
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-slate-600 hover:bg-slate-700'
              }`}
            >
              {registrando ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Registrando…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {isEntrada ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                  )}
                  Registrar {isEntrada ? 'Entrada' : 'Salida'}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Vista semanal */}
        {semana && <SemanaView semana={semana} />}

      </div>
    </main>
  );
}

export default function JornadaPage() {
  return (
    <Suspense>
      <JornadaContent />
    </Suspense>
  );
}
