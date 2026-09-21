from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.baja_equipo import BajaEquipo
from app.models.equipment import Equipment


class BajaEquipoRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, baja: BajaEquipo) -> BajaEquipo:
        self.db.add(baja)
        self.db.commit()
        self.db.refresh(baja)
        return baja

    def get_by_id(self, baja_id: int) -> BajaEquipo | None:
        return self.db.scalar(select(BajaEquipo).where(BajaEquipo.id == baja_id))

    def get_pendiente_por_equipo(self, equipment_id: int) -> BajaEquipo | None:
        return self.db.scalar(
            select(BajaEquipo).where(
                BajaEquipo.equipment_id == equipment_id,
                BajaEquipo.estado == 'pendiente_aprobacion',
            )
        )

    def list(
        self,
        estado: str | None = None,
        equipment_id: int | None = None,
        dominios_permitidos: list[str] | None = None,
        skip: int = 0,
        limit: int | None = 50,
    ) -> tuple[list[BajaEquipo], int]:
        query = select(BajaEquipo).join(Equipment, BajaEquipo.equipment_id == Equipment.id)
        if dominios_permitidos is not None:
            query = query.where(Equipment.dominio.in_(dominios_permitidos))
        if estado:
            query = query.where(BajaEquipo.estado == estado)
        if equipment_id:
            query = query.where(BajaEquipo.equipment_id == equipment_id)

        total = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        query = query.order_by(BajaEquipo.solicitado_en.desc())
        if limit is not None:
            query = query.offset(skip).limit(limit)
        items = list(self.db.scalars(query).all())
        return items, total

    def update(self, baja: BajaEquipo) -> BajaEquipo:
        self.db.add(baja)
        self.db.commit()
        self.db.refresh(baja)
        return baja
