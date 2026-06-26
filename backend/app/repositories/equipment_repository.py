from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.equipment import Equipment


class EquipmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_equipment(
        self,
        search: str | None = None,
        tipo: str | None = None,
        sede: str | None = None,
        estado: str | None = None,
        criticidad: str | None = None,
        skip: int = 0,
        limit: int | None = None,
    ) -> tuple[list[Equipment], int]:
        query = select(Equipment).where(Equipment.is_active.is_(True))

        if search:
            term = f'%{search}%'
            query = query.where(
                or_(
                    Equipment.codigo_interno.ilike(term),
                    Equipment.serial.ilike(term),
                    Equipment.marca.ilike(term),
                    Equipment.modelo.ilike(term),
                )
            )
        if tipo:
            query = query.where(Equipment.tipo == tipo)
        if sede:
            query = query.where(Equipment.sede.ilike(f'%{sede}%'))
        if estado:
            query = query.where(Equipment.estado == estado)
        if criticidad:
            query = query.where(Equipment.criticidad == criticidad)

        total = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        query = query.order_by(Equipment.created_at.desc())
        if limit is not None:
            query = query.offset(skip).limit(limit)
        items = list(self.db.scalars(query).all())
        return items, total

    def get_by_id(self, equipment_id: int) -> Equipment | None:
        return self.db.scalar(
            select(Equipment).where(Equipment.id == equipment_id, Equipment.is_active.is_(True))
        )

    def get_children(self, parent_id: int) -> list[Equipment]:
        return list(self.db.scalars(
            select(Equipment).where(
                Equipment.parent_equipment_id == parent_id,
                Equipment.is_active.is_(True),
            )
        ).all())

    def get_by_serial(self, serial: str) -> Equipment | None:
        return self.db.scalar(select(Equipment).where(Equipment.serial == serial))

    def get_last_codigo_interno(self) -> str | None:
        result = self.db.scalar(
            select(Equipment.codigo_interno).order_by(Equipment.id.desc()).limit(1)
        )
        return result

    def create(self, equipment: Equipment) -> Equipment:
        self.db.add(equipment)
        self.db.commit()
        self.db.refresh(equipment)
        return equipment

    def update(self, equipment: Equipment) -> Equipment:
        self.db.add(equipment)
        self.db.commit()
        self.db.refresh(equipment)
        return equipment

    def soft_delete(self, equipment: Equipment) -> None:
        equipment.is_active = False
        self.db.add(equipment)
        self.db.commit()
