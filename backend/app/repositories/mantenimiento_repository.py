from datetime import date, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.equipment import Equipment
from app.models.mantenimiento import Mantenimiento


class MantenimientoRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_by_equipment(self, equipment_id: int, limit: int = 100) -> list[Mantenimiento]:
        return list(
            self.db.scalars(
                select(Mantenimiento)
                .where(Mantenimiento.equipment_id == equipment_id, Mantenimiento.is_active.is_(True))
                .order_by(Mantenimiento.fecha.desc())
                .limit(limit)
            ).all()
        )

    def get_recent_by_equipment(self, equipment_id: int, limit: int = 5) -> list[Mantenimiento]:
        return self.list_by_equipment(equipment_id, limit)

    def get_by_id(self, mantenimiento_id: int) -> Mantenimiento | None:
        return self.db.scalar(
            select(Mantenimiento).where(
                Mantenimiento.id == mantenimiento_id,
                Mantenimiento.is_active.is_(True),
            )
        )

    def create(self, m: Mantenimiento) -> Mantenimiento:
        self.db.add(m)
        self.db.commit()
        self.db.refresh(m)
        return m

    def update(self, m: Mantenimiento) -> Mantenimiento:
        self.db.add(m)
        self.db.commit()
        self.db.refresh(m)
        return m

    def soft_delete(self, m: Mantenimiento) -> None:
        m.is_active = False
        self.db.add(m)
        self.db.commit()

    def list_global(
        self,
        sede: str | None = None,
        tipo: str | None = None,
        tipo_equipo: str | None = None,
        estado_vencimiento: str | None = None,
        proximo_desde: date | None = None,
        proximo_hasta: date | None = None,
        estado: str | None = None,
        skip: int = 0,
        limit: int = 50,
        dominios_permitidos: list[str] | None = None,
    ) -> tuple[list[Mantenimiento], int]:
        query = (
            select(Mantenimiento)
            .join(Equipment, Mantenimiento.equipment_id == Equipment.id)
            .where(Mantenimiento.is_active.is_(True))
        )
        if dominios_permitidos is not None:
            query = query.where(Equipment.dominio.in_(dominios_permitidos))
        if sede:
            query = query.where(Equipment.sede.ilike(f'%{sede}%'))
        if tipo:
            query = query.where(Mantenimiento.tipo == tipo)
        if tipo_equipo:
            query = query.where(Equipment.tipo == tipo_equipo)
        if estado:
            query = query.where(Mantenimiento.estado == estado)
        if proximo_desde:
            query = query.where(Mantenimiento.proximo_mantenimiento >= proximo_desde)
        if proximo_hasta:
            query = query.where(Mantenimiento.proximo_mantenimiento <= proximo_hasta)
        if estado_vencimiento:
            today = date.today()
            if estado_vencimiento == 'vencido':
                query = query.where(Mantenimiento.proximo_mantenimiento < today)
            elif estado_vencimiento == 'proximo':
                query = query.where(
                    Mantenimiento.proximo_mantenimiento >= today,
                    Mantenimiento.proximo_mantenimiento <= today + timedelta(days=30),
                )
            elif estado_vencimiento == 'al_dia':
                query = query.where(
                    or_(
                        Mantenimiento.proximo_mantenimiento.is_(None),
                        Mantenimiento.proximo_mantenimiento > today + timedelta(days=30),
                    )
                )

        total = self.db.scalar(select(func.count()).select_from(query.subquery()))
        items = list(
            self.db.scalars(query.order_by(Mantenimiento.fecha.desc()).offset(skip).limit(limit)).all()
        )
        return items, total or 0
