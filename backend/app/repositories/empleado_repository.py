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
    ) -> tuple[list[Empleado], int]:
        query = (
            select(Empleado)
            .options(selectinload(Empleado.sedes_jornada))
            .where(Empleado.is_active.is_(True))
        )
        if search:
            term = f'%{search}%'
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

    def get_by_id(self, empleado_id: int) -> Empleado | None:
        return self.db.scalar(
            select(Empleado)
            .options(selectinload(Empleado.sedes_jornada))
            .where(Empleado.id == empleado_id, Empleado.is_active.is_(True))
        )

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
