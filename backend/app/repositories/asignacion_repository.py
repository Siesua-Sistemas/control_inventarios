from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.asignacion import Asignacion
from app.models.bodega import Bodega
from app.models.empleado import Empleado
from app.models.equipment import Equipment
from app.models.user import User


class AsignacionRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_historial(
        self,
        equipment_id: int | None = None,
        empleado_id: int | None = None,
        tipo: str | None = None,
        desde: date | None = None,
        hasta: date | None = None,
        skip: int = 0,
        limit: int | None = 50,
        dominios_permitidos: list[str] | None = None,
    ) -> tuple[list[Asignacion], int]:
        query = select(Asignacion).join(Equipment, Asignacion.equipment_id == Equipment.id)
        if dominios_permitidos is not None:
            query = query.where(Equipment.dominio.in_(dominios_permitidos))
        if equipment_id:
            query = query.where(Asignacion.equipment_id == equipment_id)
        if empleado_id:
            query = query.where(Asignacion.empleado_id == empleado_id)
        if tipo:
            query = query.where(Asignacion.tipo == tipo)
        if desde:
            query = query.where(Asignacion.fecha >= datetime.combine(desde, datetime.min.time()))
        if hasta:
            query = query.where(Asignacion.fecha <= datetime.combine(hasta, datetime.max.time()))
        count = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        query = query.order_by(Asignacion.fecha.desc())
        if limit is not None:
            query = query.offset(skip).limit(limit)
        items = list(self.db.scalars(query).all())
        return items, count

    def get_activas(self, dominios_permitidos: list[str] | None = None) -> list[Asignacion]:
        # Latest Entrega per equipment where the equipment is still Asignado/Prestado
        subq = (
            select(func.max(Asignacion.id))
            .where(Asignacion.tipo == 'Entrega')
            .group_by(Asignacion.equipment_id)
            .scalar_subquery()
        )
        filters = [
            Asignacion.id.in_(subq),
            Equipment.estado.in_(['Asignado', 'Prestado']),
            Equipment.is_active.is_(True),
        ]
        if dominios_permitidos is not None:
            filters.append(Equipment.dominio.in_(dominios_permitidos))
        return list(
            self.db.scalars(
                select(Asignacion)
                .join(Equipment, Asignacion.equipment_id == Equipment.id)
                .where(*filters)
                .order_by(Asignacion.fecha.desc())
            ).all()
        )

    def count_today(self) -> int:
        today = date.today()
        query = (
            select(func.count())
            .select_from(Asignacion)
            .join(Equipment, Asignacion.equipment_id == Equipment.id)
            .where(
                Asignacion.fecha >= datetime.combine(today, datetime.min.time()),
                Asignacion.fecha <= datetime.combine(today, datetime.max.time()),
            )
        )
        return self.db.scalar(query) or 0

    def get_recent(self, limit: int = 8) -> list[Asignacion]:
        query = (
            select(Asignacion)
            .join(Equipment, Asignacion.equipment_id == Equipment.id)
            .order_by(Asignacion.fecha.desc())
            .limit(limit)
        )
        return list(self.db.scalars(query).all())

    def create(self, asignacion: Asignacion) -> Asignacion:
        self.db.add(asignacion)
        self.db.commit()
        self.db.refresh(asignacion)
        return asignacion
