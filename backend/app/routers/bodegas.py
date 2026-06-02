from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permissions
from app.repositories.bodega_repository import BodegaRepository
from app.schemas.bodega import BodegaCreate, BodegaListResponse, BodegaOut, BodegaUpdate
from app.schemas.equipment import EquipmentOut
from app.services.bodega_service import BodegaService

router = APIRouter(prefix='/api/v1/bodegas', tags=['bodegas'])


def _service(db: Session = Depends(get_db)) -> BodegaService:
    return BodegaService(BodegaRepository(db))


@router.get('', response_model=BodegaListResponse)
def list_bodegas(
    sede: str | None = Query(None),
    service: BodegaService = Depends(_service),
    _user=Depends(require_permissions('bodegas:read')),
):
    items = service.list_bodegas(sede)
    return {'total': len(items), 'items': items}


@router.post('', response_model=BodegaOut, status_code=201)
def create_bodega(
    payload: BodegaCreate,
    service: BodegaService = Depends(_service),
    _user=Depends(require_permissions('bodegas:write')),
):
    b = service.create_bodega(payload)
    return BodegaOut(
        **{k: getattr(b, k) for k in ('id', 'nombre', 'sede', 'responsable', 'descripcion', 'is_active', 'created_at')},
        total_equipos=0,
    )


@router.get('/{bodega_id}/inventario')
def get_inventario(
    bodega_id: int,
    service: BodegaService = Depends(_service),
    _user=Depends(require_permissions('bodegas:read')),
):
    inv = service.get_inventario(bodega_id)
    inv['equipos'] = [EquipmentOut.model_validate(e) for e in inv['equipos']]
    return inv


@router.put('/{bodega_id}', response_model=BodegaOut)
def update_bodega(
    bodega_id: int,
    payload: BodegaUpdate,
    service: BodegaService = Depends(_service),
    _user=Depends(require_permissions('bodegas:write')),
):
    b = service.update_bodega(bodega_id, payload)
    from app.repositories.bodega_repository import BodegaRepository as BR
    count = BR(service.repository.db).count_equipos(b.id)
    return BodegaOut(
        **{k: getattr(b, k) for k in ('id', 'nombre', 'sede', 'responsable', 'descripcion', 'is_active', 'created_at')},
        total_equipos=count,
    )


@router.delete('/{bodega_id}', status_code=204)
def delete_bodega(
    bodega_id: int,
    service: BodegaService = Depends(_service),
    _user=Depends(require_permissions('bodegas:write')),
):
    service.delete_bodega(bodega_id)
