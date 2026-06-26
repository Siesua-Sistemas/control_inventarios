from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.equipment import Equipment
from app.models.mantenimiento import Mantenimiento
from app.schemas.mantenimiento import AlertaItem, MantenimientosDashboard, PorSedeEstado

GARANTIA_DIAS_ALERTA = 60
PROXIMO_DIAS_ALERTA = 30


class MantenimientoDashboardService:
    def __init__(self, db: Session):
        self.db = db

    def get_dashboard(self) -> MantenimientosDashboard:
        today = date.today()

        eq_base = [Equipment.is_active.is_(True)]

        # Subquery: último proximo_mantenimiento por equipo
        mant_subq_base = [
            Mantenimiento.is_active.is_(True),
            Mantenimiento.proximo_mantenimiento.isnot(None),
        ]
        mant_subq_base_q = (
            select(
                Mantenimiento.equipment_id.label('eq_id'),
                func.max(Mantenimiento.proximo_mantenimiento).label('latest_proximo'),
            )
            .where(*mant_subq_base)
            .group_by(Mantenimiento.equipment_id)
        )
        latest_by_eq = mant_subq_base_q.subquery()

        vencidos = self.db.scalar(
            select(func.count()).select_from(latest_by_eq)
            .where(latest_by_eq.c.latest_proximo < today)
        ) or 0

        proximos_30 = self.db.scalar(
            select(func.count()).select_from(latest_by_eq)
            .where(
                latest_by_eq.c.latest_proximo >= today,
                latest_by_eq.c.latest_proximo <= today + timedelta(days=PROXIMO_DIAS_ALERTA),
            )
        ) or 0

        garantias_por_vencer = self.db.scalar(
            select(func.count()).where(
                *eq_base,
                Equipment.garantia_vence.is_not(None),
                Equipment.garantia_vence >= today,
                Equipment.garantia_vence <= today + timedelta(days=GARANTIA_DIAS_ALERTA),
            )
        ) or 0

        calibraciones_vencidas = self.db.scalar(
            select(func.count()).where(
                *eq_base,
                Equipment.vencimiento_calibracion.isnot(None),
                Equipment.vencimiento_calibracion < today,
            )
        ) or 0

        calibraciones_proximas = self.db.scalar(
            select(func.count()).where(
                *eq_base,
                Equipment.vencimiento_calibracion.isnot(None),
                Equipment.vencimiento_calibracion >= today,
                Equipment.vencimiento_calibracion <= today + timedelta(days=PROXIMO_DIAS_ALERTA),
            )
        ) or 0

        first_of_month = today.replace(day=1)
        first_of_year = today.replace(month=1, day=1)

        mant_cost_q = select(func.coalesce(func.sum(Mantenimiento.costo), 0)).select_from(Mantenimiento)

        costo_mes = self.db.scalar(
            mant_cost_q.where(
                Mantenimiento.is_active.is_(True),
                Mantenimiento.fecha >= first_of_month,
            )
        ) or Decimal('0')

        costo_anio = self.db.scalar(
            mant_cost_q.where(
                Mantenimiento.is_active.is_(True),
                Mantenimiento.fecha >= first_of_year,
            )
        ) or Decimal('0')

        rows = self.db.execute(
            select(Equipment.sede, Equipment.estado, func.count())
            .where(
                *eq_base,
                Equipment.estado.notin_(['Dado de baja', 'Perdido']),
            )
            .group_by(Equipment.sede, Equipment.estado)
        ).all()

        por_sede_map: dict[str, dict[str, int]] = {}
        for sede, estado, count in rows:
            por_sede_map.setdefault(sede, {})[estado] = count

        por_sede = [
            PorSedeEstado(sede=sede, total=sum(estados.values()), por_estado=estados)
            for sede, estados in sorted(por_sede_map.items())
        ]

        alertas: list[AlertaItem] = []

        vencidos_rows = self.db.execute(
            select(
                latest_by_eq.c.latest_proximo,
                Equipment.id,
                Equipment.codigo_interno,
                Equipment.sede,
            )
            .join(Equipment, Equipment.id == latest_by_eq.c.eq_id)
            .where(
                *eq_base,
                latest_by_eq.c.latest_proximo < today,
            )
            .order_by(latest_by_eq.c.latest_proximo.asc())
            .limit(50)
        ).all()
        for proximo, eq_id, codigo, sede in vencidos_rows:
            dias = (today - proximo).days
            alertas.append(AlertaItem(
                tipo='mantenimiento_vencido', severidad='alta',
                mensaje=f'Mantenimiento preventivo vencido hace {dias} día(s)',
                equipment_id=eq_id, equipment_codigo=codigo, sede=sede,
                fecha_referencia=proximo, dias=-dias,
            ))

        garantia_rows = self.db.execute(
            select(Equipment.garantia_vence, Equipment.id, Equipment.codigo_interno, Equipment.sede)
            .where(
                *eq_base,
                Equipment.garantia_vence.is_not(None),
                Equipment.garantia_vence >= today,
                Equipment.garantia_vence <= today + timedelta(days=GARANTIA_DIAS_ALERTA),
            )
            .order_by(Equipment.garantia_vence.asc())
            .limit(50)
        ).all()
        for garantia, eq_id, codigo, sede in garantia_rows:
            dias = (garantia - today).days
            alertas.append(AlertaItem(
                tipo='garantia_por_vencer', severidad='media' if dias > 15 else 'alta',
                mensaje=f'Garantía vence en {dias} día(s)',
                equipment_id=eq_id, equipment_codigo=codigo, sede=sede,
                fecha_referencia=garantia, dias=dias,
            ))

        estado_rows = self.db.execute(
            select(Equipment.estado, Equipment.id, Equipment.codigo_interno, Equipment.sede)
            .where(*eq_base, Equipment.estado.in_(['Dañado', 'En mantenimiento']))
            .limit(100)
        ).all()
        for estado, eq_id, codigo, sede in estado_rows:
            tipo_alerta = 'equipo_dano' if estado == 'Dañado' else 'equipo_en_mantenimiento'
            severidad = 'alta' if estado == 'Dañado' else 'media'
            alertas.append(AlertaItem(
                tipo=tipo_alerta, severidad=severidad,
                mensaje=f'Equipo en estado "{estado}"',
                equipment_id=eq_id, equipment_codigo=codigo, sede=sede,
                fecha_referencia=None, dias=None,
            ))

        calib_rows = self.db.execute(
            select(Equipment.vencimiento_calibracion, Equipment.id, Equipment.codigo_interno, Equipment.sede)
            .where(
                *eq_base,
                Equipment.vencimiento_calibracion.isnot(None),
                Equipment.vencimiento_calibracion <= today + timedelta(days=PROXIMO_DIAS_ALERTA),
            )
            .order_by(Equipment.vencimiento_calibracion.asc())
            .limit(50)
        ).all()
        for venc, eq_id, codigo, sede in calib_rows:
            dias = (venc - today).days
            if dias < 0:
                alertas.append(AlertaItem(
                    tipo='calibracion_vencida', severidad='alta',
                    mensaje=f'Calibración vencida hace {abs(dias)} día(s)',
                    equipment_id=eq_id, equipment_codigo=codigo, sede=sede,
                    fecha_referencia=venc, dias=dias,
                ))
            else:
                alertas.append(AlertaItem(
                    tipo='calibracion_proxima', severidad='media',
                    mensaje=f'Calibración vence en {dias} día(s)',
                    equipment_id=eq_id, equipment_codigo=codigo, sede=sede,
                    fecha_referencia=venc, dias=dias,
                ))

        severidad_order = {'alta': 0, 'media': 1, 'baja': 2}
        alertas.sort(key=lambda a: severidad_order.get(a.severidad, 9))

        return MantenimientosDashboard(
            vencidos=vencidos,
            proximos_30_dias=proximos_30,
            garantias_por_vencer_60_dias=garantias_por_vencer,
            calibraciones_vencidas=calibraciones_vencidas,
            calibraciones_proximas_30_dias=calibraciones_proximas,
            costo_mes_actual=Decimal(str(costo_mes)),
            costo_anio_actual=Decimal(str(costo_anio)),
            por_sede=por_sede,
            alertas=alertas,
        )
