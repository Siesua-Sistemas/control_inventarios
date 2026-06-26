from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.mantenimiento_config import MantenimientoConfig


class MantenimientoConfigRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_all(self) -> list[MantenimientoConfig]:
        return list(
            self.db.scalars(select(MantenimientoConfig).order_by(MantenimientoConfig.tipo_equipo)).all()
        )

    def get_by_tipo(self, tipo_equipo: str) -> MantenimientoConfig | None:
        return self.db.scalar(
            select(MantenimientoConfig).where(MantenimientoConfig.tipo_equipo == tipo_equipo)
        )

    def update(self, config: MantenimientoConfig) -> MantenimientoConfig:
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config
