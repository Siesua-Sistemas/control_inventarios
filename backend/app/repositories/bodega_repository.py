from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.bodega import Bodega
from app.models.equipment import Equipment


class BodegaRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_bodegas(
        self,
        sede: str | None = None,
        dominios_permitidos: list[str] | None = None,
    ) -> list[Bodega]:
        query = select(Bodega).where(Bodega.is_active.is_(True))
        if dominios_permitidos is not None:
            query = query.where(Bodega.dominio.in_(dominios_permitidos))
        if sede:
            query = query.where(Bodega.sede.ilike(f'%{sede}%'))
        return list(self.db.scalars(query.order_by(Bodega.nombre.asc())).all())

    def get_by_id(self, bodega_id: int) -> Bodega | None:
        return self.db.scalar(
            select(Bodega).where(Bodega.id == bodega_id, Bodega.is_active.is_(True))
        )

    def count_equipos(self, bodega_id: int, dominios_permitidos: list[str] | None = None) -> int:
        bodega = self.get_by_id(bodega_id)
        if not bodega:
            return 0
        query = select(func.count()).where(
            Equipment.sede == bodega.sede,
            Equipment.is_active.is_(True),
        )
        if dominios_permitidos is not None:
            query = query.where(Equipment.dominio.in_(dominios_permitidos))
        return self.db.scalar(query) or 0

    def get_equipos(
        self, bodega_id: int, dominios_permitidos: list[str] | None = None
    ) -> list[Equipment]:
        bodega = self.get_by_id(bodega_id)
        if not bodega:
            return []
        query = (
            select(Equipment)
            .where(Equipment.sede == bodega.sede, Equipment.is_active.is_(True))
        )
        if dominios_permitidos is not None:
            query = query.where(Equipment.dominio.in_(dominios_permitidos))
        return list(self.db.scalars(query.order_by(Equipment.tipo, Equipment.marca)).all())

    def create(self, bodega: Bodega) -> Bodega:
        self.db.add(bodega)
        self.db.commit()
        self.db.refresh(bodega)
        return bodega

    def update(self, bodega: Bodega) -> Bodega:
        self.db.add(bodega)
        self.db.commit()
        self.db.refresh(bodega)
        return bodega

    def soft_delete(self, bodega: Bodega) -> None:
        bodega.is_active = False
        self.db.add(bodega)
        self.db.commit()
