from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.equipment_tipo import EquipmentTipo, EquipmentTipoSpec


class EquipmentTipoRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_all(self) -> list[EquipmentTipo]:
        return list(
            self.db.scalars(select(EquipmentTipo).order_by(EquipmentTipo.orden, EquipmentTipo.nombre)).all()
        )

    def get_by_id(self, tipo_id: int) -> EquipmentTipo | None:
        return self.db.scalar(select(EquipmentTipo).where(EquipmentTipo.id == tipo_id))

    def get_by_nombre(self, nombre: str) -> EquipmentTipo | None:
        return self.db.scalar(select(EquipmentTipo).where(EquipmentTipo.nombre == nombre))

    def create(self, tipo: EquipmentTipo) -> EquipmentTipo:
        self.db.add(tipo)
        self.db.commit()
        self.db.refresh(tipo)
        return tipo

    def update(self, tipo: EquipmentTipo) -> EquipmentTipo:
        self.db.add(tipo)
        self.db.commit()
        self.db.refresh(tipo)
        return tipo

    def replace_specs(self, tipo: EquipmentTipo, specs: list[dict]) -> EquipmentTipo:
        tipo.specs = [
            EquipmentTipoSpec(
                key=s['key'],
                label=s['label'],
                field_type=s['type'],
                options=s.get('options'),
                min_value=s.get('min'),
                max_value=s.get('max'),
                placeholder=s.get('placeholder'),
                orden=idx,
            )
            for idx, s in enumerate(specs)
        ]
        self.db.add(tipo)
        self.db.commit()
        self.db.refresh(tipo)
        return tipo
