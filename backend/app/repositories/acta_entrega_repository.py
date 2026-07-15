from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.acta_entrega import ActaEntrega


class ActaEntregaRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: dict) -> ActaEntrega:
        acta = ActaEntrega(**data)
        self.db.add(acta)
        self.db.commit()
        self.db.refresh(acta)
        return acta

    def get_by_id(self, acta_id: int) -> ActaEntrega | None:
        return self.db.query(ActaEntrega).filter(ActaEntrega.id == acta_id).first()

    def list(
        self,
        tipo: str | None = None,
        sede: str | None = None,
        bodega_id: int | None = None,
        empleado_id: int | None = None,
        desde: date | None = None,
        hasta: date | None = None,
        skip: int = 0,
        limit: int | None = 50,
        dominios_permitidos: list[str] | None = None,
    ) -> tuple[list[ActaEntrega], int]:
        q = self.db.query(ActaEntrega)
        if dominios_permitidos is not None:
            q = q.filter(ActaEntrega.dominio.in_(dominios_permitidos))
        if tipo:
            q = q.filter(ActaEntrega.tipo == tipo)
        if sede:
            q = q.filter(ActaEntrega.sede.ilike(f'%{sede}%'))
        if bodega_id:
            q = q.filter(ActaEntrega.bodega_id == bodega_id)
        if empleado_id:
            q = q.filter(ActaEntrega.empleado_id == empleado_id)
        if desde:
            q = q.filter(func.date(ActaEntrega.fecha) >= desde)
        if hasta:
            q = q.filter(func.date(ActaEntrega.fecha) <= hasta)
        total = q.count()
        q = q.order_by(ActaEntrega.fecha.desc())
        if limit is not None:
            q = q.offset(skip).limit(limit)
        items = q.all()
        return items, total
