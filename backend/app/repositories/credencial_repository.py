from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.credencial import Credencial


class CredencialRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(
        self,
        tipo: str | None = None,
        equipment_id: int | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Credencial], int]:
        query = select(Credencial).where(Credencial.is_active.is_(True))
        if tipo:
            query = query.where(Credencial.tipo == tipo)
        if equipment_id is not None:
            query = query.where(Credencial.equipment_id == equipment_id)
        if search:
            query = query.where(Credencial.nombre.ilike(f'%{search}%'))

        total = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        items = list(
            self.db.scalars(query.order_by(Credencial.nombre).offset(skip).limit(limit)).all()
        )
        return items, total

    def get_by_id(self, credencial_id: int) -> Credencial | None:
        return self.db.scalar(
            select(Credencial).where(Credencial.id == credencial_id, Credencial.is_active.is_(True))
        )

    def create(self, credencial: Credencial) -> Credencial:
        self.db.add(credencial)
        self.db.commit()
        self.db.refresh(credencial)
        return credencial

    def update(self, credencial: Credencial) -> Credencial:
        self.db.add(credencial)
        self.db.commit()
        self.db.refresh(credencial)
        return credencial

    def soft_delete(self, credencial: Credencial) -> None:
        credencial.is_active = False
        self.db.add(credencial)
        self.db.commit()
