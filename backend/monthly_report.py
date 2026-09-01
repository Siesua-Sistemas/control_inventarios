import json
import sys
from calendar import monthrange
from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import select

from app.database import SessionLocal
from app.models.empleado import Empleado
from app.models.jornada import RegistroJornada
from app.routers.jornada import (
    BOGOTA_OFFSET,
    _almuerzo_minutos,
    _almuerzo_overrides,
    _bogota_now,
    _horarios_por_nombre,
)

YEAR = int(sys.argv[1])
MONTH = int(sys.argv[2])

db = SessionLocal()

primero = date(YEAR, MONTH, 1)
ultimo_dia = monthrange(YEAR, MONTH)[1]
ultimo = date(YEAR, MONTH, ultimo_dia)
hoy = _bogota_now().date()
fin_calculo = min(ultimo, hoy)

empleados = list(db.scalars(
    select(Empleado)
    .where(Empleado.en_jornada.is_(True), Empleado.is_active.is_(True))
    .order_by(Empleado.apellidos, Empleado.nombres)
).all())

emp_ids = [e.id for e in empleados]

inicio_utc = datetime(primero.year, primero.month, primero.day) - BOGOTA_OFFSET
fin_utc = datetime(ultimo.year, ultimo.month, ultimo.day) + timedelta(days=1) - BOGOTA_OFFSET

todos = list(db.scalars(
    select(RegistroJornada)
    .where(
        RegistroJornada.empleado_id.in_(emp_ids) if emp_ids else False,
        RegistroJornada.timestamp >= inicio_utc,
        RegistroJornada.timestamp < fin_utc,
    )
    .order_by(RegistroJornada.timestamp.asc())
).all()) if emp_ids else []

by_emp = defaultdict(list)
for r in todos:
    by_emp[r.empleado_id].append(r)

horarios = _horarios_por_nombre(db)
overrides = _almuerzo_overrides(db, emp_ids, primero, ultimo)

dias_habiles = 0
d = primero
while d <= fin_calculo:
    if d.weekday() < 6:  # lunes..sabado cuentan como potencial dia laboral
        dias_habiles += 1
    d += timedelta(days=1)

resultado = []
for emp in empleados:
    emp_regs = by_emp.get(emp.id, [])
    total_min = 0
    dias_asistidos = 0
    dias_incompletos = 0
    dias_tarde = 0
    sedes_usadas = set()
    ubicacion_no_verificada_count = 0
    manual_count = 0
    detalle_dias = []

    d = primero
    while d <= fin_calculo:
        regs_dia = [r for r in emp_regs if (r.timestamp + BOGOTA_OFFSET).date() == d]
        entradas_ord = sorted([r for r in regs_dia if r.tipo == 'entrada'], key=lambda r: r.timestamp)
        salidas_ord = sorted([r for r in regs_dia if r.tipo == 'salida'], key=lambda r: r.timestamp)
        pares = min(len(entradas_ord), len(salidas_ord))
        bruto_min = sum(
            max(0, round((salidas_ord[j].timestamp - entradas_ord[j].timestamp).total_seconds() / 60))
            for j in range(pares)
        )
        dia_min = 0
        if pares > 0:
            override = overrides.get((emp.id, d))
            if override is not None:
                almuerzo_min = override
            else:
                sede_del_dia = regs_dia[0].sede if regs_dia else None
                horario_cfg = horarios.get(sede_del_dia) if sede_del_dia else None
                almuerzo_min = _almuerzo_minutos(d, horario_cfg)
            dia_min = max(0, bruto_min - almuerzo_min)
            total_min += dia_min
            dias_asistidos += 1
            for r in regs_dia:
                if r.sede:
                    sedes_usadas.add(r.sede)
                if r.ubicacion_no_verificada:
                    ubicacion_no_verificada_count += 1
                if r.is_manual:
                    manual_count += 1
            hora_entrada = (entradas_ord[0].timestamp + BOGOTA_OFFSET)
            if hora_entrada.hour > 8 or (hora_entrada.hour == 8 and hora_entrada.minute > 10):
                dias_tarde += 1
            detalle_dias.append({
                'fecha': d.isoformat(),
                'entrada': hora_entrada.strftime('%H:%M'),
                'salida': (salidas_ord[-1].timestamp + BOGOTA_OFFSET).strftime('%H:%M'),
                'minutos': dia_min,
            })
        elif entradas_ord:
            dias_incompletos += 1
            for r in regs_dia:
                if r.sede:
                    sedes_usadas.add(r.sede)
        d += timedelta(days=1)

    resultado.append({
        'empleado_id': emp.id,
        'nombres': emp.nombres,
        'apellidos': emp.apellidos,
        'cargo': emp.cargo,
        'sede': emp.sede,
        'sedes_usadas': sorted(sedes_usadas),
        'dias_asistidos': dias_asistidos,
        'dias_incompletos': dias_incompletos,
        'dias_tarde': dias_tarde,
        'total_minutos': total_min,
        'ubicacion_no_verificada_count': ubicacion_no_verificada_count,
        'manual_count': manual_count,
        'detalle_dias': detalle_dias,
    })

print(json.dumps({
    'anio': YEAR,
    'mes': MONTH,
    'primero': primero.isoformat(),
    'ultimo': ultimo.isoformat(),
    'fin_calculo': fin_calculo.isoformat(),
    'dias_habiles_transcurridos': dias_habiles,
    'generado_en': _bogota_now().isoformat(),
    'empleados': resultado,
}, ensure_ascii=False))

db.close()
