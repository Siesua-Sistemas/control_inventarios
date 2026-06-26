from fastapi import HTTPException, status

from app.crypto import decrypt_value, encrypt_value
from app.models.credencial import Credencial
from app.repositories.credencial_repository import CredencialRepository
from app.repositories.equipment_repository import EquipmentRepository
from app.schemas.credencial import (
    TIPOS_CREDENCIAL,
    CredencialCreate,
    CredencialOut,
    CredencialRevealOut,
    CredencialUpdate,
)


def _to_out(c: Credencial) -> CredencialOut:
    eq = c.equipment
    return CredencialOut(
        id=c.id,
        tipo=c.tipo,
        nombre=c.nombre,
        equipment_id=c.equipment_id,
        equipment_codigo=eq.codigo_interno if eq else None,
        equipment_marca=eq.marca if eq else None,
        equipment_modelo=eq.modelo if eq else None,
        usuario=c.usuario,
        url=c.url,
        notas=c.notas,
        created_by_nombre=c.created_by.full_name if c.created_by else '',
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


class CredencialService:
    def __init__(self, repo: CredencialRepository, eq_repo: EquipmentRepository):
        self.repo = repo
        self.eq_repo = eq_repo

    def list(
        self,
        tipo: str | None = None,
        equipment_id: int | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[int, list[CredencialOut]]:
        items, total = self.repo.list(tipo, equipment_id, search, skip, limit)
        return total, [_to_out(c) for c in items]

    def get(self, credencial_id: int) -> CredencialOut:
        c = self.repo.get_by_id(credencial_id)
        if not c:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Credencial no encontrada')
        return _to_out(c)

    def create(self, payload: CredencialCreate, created_by_id: int) -> CredencialOut:
        if payload.tipo not in TIPOS_CREDENCIAL:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Tipo de credencial inválido')

        equipment_id = payload.equipment_id
        if payload.tipo == 'equipo':
            if equipment_id is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Debe seleccionar un equipo')
            if not self.eq_repo.get_by_id(equipment_id):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Equipo no encontrado')
        else:
            equipment_id = None

        c = Credencial(
            tipo=payload.tipo,
            nombre=payload.nombre,
            equipment_id=equipment_id,
            usuario=payload.usuario,
            password_encrypted=encrypt_value(payload.password),
            url=payload.url,
            notas=payload.notas,
            created_by_id=created_by_id,
        )
        return _to_out(self.repo.create(c))

    def update(self, credencial_id: int, payload: CredencialUpdate) -> CredencialOut:
        c = self.repo.get_by_id(credencial_id)
        if not c:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Credencial no encontrada')

        data = payload.model_dump(exclude_unset=True, exclude_none=True)
        new_password = data.pop('password', None)
        if new_password:
            c.password_encrypted = encrypt_value(new_password)

        if 'equipment_id' in data and c.tipo == 'equipo' and not self.eq_repo.get_by_id(data['equipment_id']):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Equipo no encontrado')

        for field, value in data.items():
            setattr(c, field, value)

        return _to_out(self.repo.update(c))

    def delete(self, credencial_id: int) -> None:
        c = self.repo.get_by_id(credencial_id)
        if not c:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Credencial no encontrada')
        self.repo.soft_delete(c)

    def reveal(self, credencial_id: int) -> CredencialRevealOut:
        c = self.repo.get_by_id(credencial_id)
        if not c:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Credencial no encontrada')
        return CredencialRevealOut(password=decrypt_value(c.password_encrypted))
