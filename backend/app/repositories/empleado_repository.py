from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.empleado import Empleado


class EmpleadoRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_empleados(
        self,
        search: str | None = None,
        sede: str | None = None,
        skip: int = 0,
        limit: int | None = None,
        include_inactive: bool = False,
    ) -> tuple[list[Empleado], int]:
        query = (
            select(Empleado)
            .options(selectinload(Empleado.sedes_jornada))
        )
        if not include_inactive:
            query = query.where(Empleado.is_active.is_(True))
        if search:
            term = f'%{search.strip()}%'
            query = query.where(
                or_(
                    Empleado.nombres.ilike(term),
                    Empleado.apellidos.ilike(term),
                    Empleado.cedula.ilike(term),
                )
            )
        if sede:
            query = query.where(Empleado.sede.ilike(f'%{sede}%'))

        total = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        query = query.order_by(Empleado.apellidos, Empleado.nombres)
        if limit is not None:
            query = query.offset(skip).limit(limit)
        items = list(self.db.scalars(query).all())
        return items, total

    def get_by_id(self, empleado_id: int, include_inactive: bool = False) -> Empleado | None:
        q = (
            select(Empleado)
            .options(selectinload(Empleado.sedes_jornada))
            .where(Empleado.id == empleado_id)
        )
        if not include_inactive:
            q = q.where(Empleado.is_active.is_(True))
        return self.db.scalar(q)

    def get_by_cedula(self, cedula: str) -> Empleado | None:
        return self.db.scalar(select(Empleado).where(Empleado.cedula == cedula))

    def create(self, empleado: Empleado) -> Empleado:
        self.db.add(empleado)
        self.db.commit()
        self.db.refresh(empleado)
        return empleado

    def update(self, empleado: Empleado) -> Empleado:
        self.db.add(empleado)
        self.db.commit()
        self.db.refresh(empleado)
        return empleado

    def soft_delete(self, empleado: Empleado) -> None:
        empleado.is_active = False
        self.db.add(empleado)
        self.db.commit()

    def set_estado(self, empleado: Empleado, is_active: bool) -> Empleado:
        from datetime import datetime
        empleado.is_active = is_active
        if not is_active:
            empleado.en_jornada = False
        empleado.updated_at = datetime.utcnow()
        self.db.add(empleado)
        self.db.commit()
        self.db.refresh(empleado)
        return empleado

    def get_equipos_actuales(self, empleado_id: int) -> list:
        from app.models.equipment import Equipment
        return list(self.db.scalars(
            select(Equipment).where(Equipment.empleado_id == empleado_id)
        ).all())
