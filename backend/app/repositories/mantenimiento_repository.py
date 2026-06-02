from sqlalchemy import select
from sqlalchemy.orm import Session

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
