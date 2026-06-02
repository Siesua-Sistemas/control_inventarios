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
        limit: int = 50,
    ) -> tuple[list[Asignacion], int]:
        query = select(Asignacion)
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
        from sqlalchemy import func as _func
        count = self.db.scalar(select(_func.count()).select_from(query.subquery())) or 0
        items = list(self.db.scalars(query.order_by(Asignacion.fecha.desc()).offset(skip).limit(limit)).all())
        return items, count

    def get_activas(self) -> list[Asignacion]:
        # Latest Entrega per equipment where the equipment is still Asignado/Prestado
        subq = (
            select(func.max(Asignacion.id))
            .where(Asignacion.tipo == 'Entrega')
            .group_by(Asignacion.equipment_id)
            .scalar_subquery()
        )
        return list(
            self.db.scalars(
                select(Asignacion)
                .join(Equipment, Asignacion.equipment_id == Equipment.id)
                .where(
                    Asignacion.id.in_(subq),
                    Equipment.estado.in_(['Asignado', 'Prestado']),
                    Equipment.is_active.is_(True),
                )
                .order_by(Asignacion.fecha.desc())
            ).all()
        )

    def count_today(self) -> int:
        today = date.today()
        return self.db.scalar(
            select(func.count()).where(
                Asignacion.fecha >= datetime.combine(today, datetime.min.time()),
                Asignacion.fecha <= datetime.combine(today, datetime.max.time()),
            )
        ) or 0

    def get_recent(self, limit: int = 8) -> list[Asignacion]:
        return list(
            self.db.scalars(select(Asignacion).order_by(Asignacion.fecha.desc()).limit(limit)).all()
        )

    def create(self, asignacion: Asignacion) -> Asignacion:
        self.db.add(asignacion)
        self.db.commit()
        self.db.refresh(asignacion)
        return asignacion
