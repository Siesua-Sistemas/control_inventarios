"""Clasificación de horas trabajadas según la legislación laboral colombiana
vigente en 2026 (Ley 2466 y Ley Emiliani): jornada ordinaria/extra,
diurna/nocturna y dominical/festiva, con sus recargos.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta

DIA_INICIO = time(6, 0)
DIA_FIN = time(19, 0)

LIMITE_EXTRA_DIARIO_MIN = 120       # Ley 2466: máx. 2 horas extra por día
LIMITE_EXTRA_SEMANAL_MIN = 720      # Ley 2466: máx. 12 horas extra por semana
JORNADA_ORDINARIA_SEMANAL_MIN = 42 * 60  # Tope de jornada ordinaria semanal (Ley 2101 de 2021, vigente desde jul-2026)

RECARGO_CATEGORIAS: list[tuple[str, str, str]] = [
    ('ordinaria_diurna', 'Ordinaria diurna', 'Lun-Sáb, 6 a. m.-7 p. m.'),
    ('ordinaria_nocturna', 'Ordinaria nocturna', 'Lun-Sáb, 7 p. m.-6 a. m.'),
    ('extra_diurna', 'Extra diurna', 'Más allá de la jornada, 6 a. m.-7 p. m.'),
    ('extra_nocturna', 'Extra nocturna', 'Más allá de la jornada, 7 p. m.-6 a. m.'),
    ('dominical_diurno', 'Dominical/festivo diurno', 'Dom/festivo, 6 a. m.-7 p. m.'),
    ('dominical_nocturno', 'Dominical/festivo nocturno', 'Dom/festivo, 7 p. m.-6 a. m.'),
    ('extra_dominical_diurno', 'Extra dominical/festivo diurno', 'Dom/festivo + extras, 6 a. m.-7 p. m.'),
    ('extra_dominical_nocturno', 'Extra dominical/festivo nocturno', 'Dom/festivo + extras, 7 p. m.-6 a. m.'),
]


def _pascua(year: int) -> date:
    """Domingo de Pascua (algoritmo de Meeus/Jones/Butcher)."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mes = (h + l - 7 * m + 114) // 31
    dia = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, mes, dia)


def festivos_colombia(year: int) -> set[date]:
    """Calendario de festivos nacionales de Colombia (Ley Emiliani incluida)."""
    pascua = _pascua(year)

    fijos = {
        date(year, 1, 1),    # Año Nuevo
        date(year, 5, 1),    # Día del Trabajo
        date(year, 7, 20),   # Independencia
        date(year, 8, 7),    # Batalla de Boyacá
        date(year, 12, 8),   # Inmaculada Concepción
        date(year, 12, 25),  # Navidad
    }

    trasladables = {
        date(year, 1, 6),               # Reyes Magos
        date(year, 3, 19),               # San José
        pascua + timedelta(days=39),     # Ascensión del Señor
        pascua + timedelta(days=60),     # Corpus Christi
        pascua + timedelta(days=68),     # Sagrado Corazón
        date(year, 6, 29),               # San Pedro y San Pablo
        date(year, 8, 15),               # Asunción de la Virgen
        date(year, 10, 12),              # Día de la Raza
        date(year, 11, 1),               # Todos los Santos
        date(year, 11, 11),              # Independencia de Cartagena
    }
    ley_emiliani = {d + timedelta(days=(7 - d.weekday()) % 7) for d in trasladables}

    semana_santa = {
        pascua - timedelta(days=3),  # Jueves Santo
        pascua - timedelta(days=2),  # Viernes Santo
    }

    return fijos | ley_emiliani | semana_santa


def es_dia_dominical_festivo(fecha_dia: date, festivos: set[date]) -> bool:
    return fecha_dia.weekday() == 6 or fecha_dia in festivos


def recargo_pct(categoria: str, mes: int) -> int:
    """Porcentaje de recargo vigente en 2026 (cambia jul-dic para los dominicales/festivos)."""
    primer_semestre = mes <= 6
    tabla = {
        'ordinaria_diurna': 0,
        'ordinaria_nocturna': 35,
        'extra_diurna': 25,
        'extra_nocturna': 75,
        'dominical_diurno': 80 if primer_semestre else 90,
        'dominical_nocturno': 115 if primer_semestre else 125,
        'extra_dominical_diurno': 105 if primer_semestre else 115,
        'extra_dominical_nocturno': 155 if primer_semestre else 165,
    }
    return tabla[categoria]


def descontar_almuerzo_sesiones(
    sesiones: list[tuple[datetime, datetime]],
    almuerzo_min: int,
) -> list[tuple[datetime, datetime]]:
    """
    Recorta `almuerzo_min` minutos del final de las sesiones del día (de la
    más tardía hacia atrás) para que el total de minutos que se clasifica en
    `clasificar_recargos_dia` coincida con el tiempo NETO ya descontado de
    almuerzo (el mismo que se muestra como "Total horas"), en vez del tiempo
    bruto entrada→salida.
    """
    if almuerzo_min <= 0 or not sesiones:
        return sesiones

    restante = almuerzo_min
    ajustadas = list(sesiones)
    for i in range(len(ajustadas) - 1, -1, -1):
        if restante <= 0:
            break
        entrada, salida = ajustadas[i]
        dur_min = (salida - entrada).total_seconds() / 60
        recorte = min(restante, dur_min)
        ajustadas[i] = (entrada, salida - timedelta(minutes=recorte))
        restante -= recorte

    return [(entrada, salida) for entrada, salida in ajustadas if salida > entrada]


def clasificar_recargos_dia(
    sesiones: list[tuple[datetime, datetime]],
    fecha_dia: date,
    festivos: set[date],
    umbral_ordinaria_min: int = 480,
) -> dict[str, int]:
    """
    Clasifica en minutos el tiempo BRUTO trabajado (entrada→salida, sin
    descontar almuerzo) de un día en las 8 categorías legales.

    `sesiones`: pares (entrada, salida) en hora LOCAL de Bogotá (naive),
    ordenados cronológicamente. El umbral ordinaria/extra se acumula a lo
    largo de todas las sesiones del día (no se reinicia por sesión).
    """
    categorias = {clave: 0 for clave, _, _ in RECARGO_CATEGORIAS}
    es_dom = es_dia_dominical_festivo(fecha_dia, festivos)
    acumulado_min = 0

    for entrada, salida in sesiones:
        cursor = entrada
        while cursor < salida:
            hora = cursor.time()
            if hora < DIA_INICIO:
                frontera = cursor.replace(hour=6, minute=0, second=0, microsecond=0)
                es_noche = True
            elif hora < DIA_FIN:
                frontera = cursor.replace(hour=19, minute=0, second=0, microsecond=0)
                es_noche = False
            else:
                frontera = (cursor + timedelta(days=1)).replace(hour=6, minute=0, second=0, microsecond=0)
                es_noche = True

            fin_segmento = min(salida, frontera)
            minutos = int((fin_segmento - cursor).total_seconds() // 60)
            if minutos <= 0:
                cursor = fin_segmento
                continue

            restante_ordinaria = max(0, umbral_ordinaria_min - acumulado_min)
            min_ordinaria = min(minutos, restante_ordinaria)
            min_extra = minutos - min_ordinaria

            if es_dom:
                clave_ord, clave_extra = (
                    ('dominical_nocturno', 'extra_dominical_nocturno') if es_noche
                    else ('dominical_diurno', 'extra_dominical_diurno')
                )
            else:
                clave_ord, clave_extra = (
                    ('ordinaria_nocturna', 'extra_nocturna') if es_noche
                    else ('ordinaria_diurna', 'extra_diurna')
                )

            categorias[clave_ord] += min_ordinaria
            categorias[clave_extra] += min_extra
            acumulado_min += minutos
            cursor = fin_segmento

    return categorias


def total_extra_min(categorias: dict[str, int]) -> int:
    return (
        categorias.get('extra_diurna', 0)
        + categorias.get('extra_nocturna', 0)
        + categorias.get('extra_dominical_diurno', 0)
        + categorias.get('extra_dominical_nocturno', 0)
    )


def sumar_categorias(dicts: list[dict[str, int]]) -> dict[str, int]:
    total = {clave: 0 for clave, _, _ in RECARGO_CATEGORIAS}
    for d in dicts:
        for k, v in d.items():
            total[k] = total.get(k, 0) + v
    return total
