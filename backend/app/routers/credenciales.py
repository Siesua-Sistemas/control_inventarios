from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permissions
from app.repositories.credencial_repository import CredencialRepository
from app.repositories.equipment_repository import EquipmentRepository
from app.schemas.credencial import (
    CredencialCreate,
    CredencialListResponse,
    CredencialOut,
    CredencialRevealOut,
    CredencialUpdate,
)
from app.services.credencial_service import CredencialService

router = APIRouter(prefix='/api/v1/credenciales', tags=['credenciales'])


def _service(db: Session = Depends(get_db)) -> CredencialService:
    return CredencialService(CredencialRepository(db), EquipmentRepository(db))


@router.get('', response_model=CredencialListResponse)
def list_credenciales(
    tipo: str | None = Query(None),
    equipment_id: int | None = Query(None),
    search: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    service: CredencialService = Depends(_service),
    _user=Depends(require_permissions('credenciales:read')),
):
    total, items = service.list(tipo, equipment_id, search, skip, limit)
    return {'total': total, 'items': items}


@router.get('/{credencial_id}', response_model=CredencialOut)
def get_credencial(
    credencial_id: int,
    service: CredencialService = Depends(_service),
    _user=Depends(require_permissions('credenciales:read')),
):
    return service.get(credencial_id)


@router.post('', response_model=CredencialOut, status_code=201)
def create_credencial(
    payload: CredencialCreate,
    service: CredencialService = Depends(_service),
    user=Depends(require_permissions('credenciales:write')),
):
    return service.create(payload, user.id)


@router.put('/{credencial_id}', response_model=CredencialOut)
def update_credencial(
    credencial_id: int,
    payload: CredencialUpdate,
    service: CredencialService = Depends(_service),
    _user=Depends(require_permissions('credenciales:write')),
):
    return service.update(credencial_id, payload)


@router.delete('/{credencial_id}', status_code=204)
def delete_credencial(
    credencial_id: int,
    service: CredencialService = Depends(_service),
    _user=Depends(require_permissions('credenciales:delete')),
):
    service.delete(credencial_id)


@router.get('/{credencial_id}/password', response_model=CredencialRevealOut)
def reveal_credencial_password(
    credencial_id: int,
    service: CredencialService = Depends(_service),
    _user=Depends(require_permissions('credenciales:read')),
):
    return service.reveal(credencial_id)
