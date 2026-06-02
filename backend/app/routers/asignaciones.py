from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permissions
from app.repositories.asignacion_repository import AsignacionRepository
from app.repositories.bodega_repository import BodegaRepository
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.equipment_repository import EquipmentRepository
from app.schemas.asignacion import AsignacionListResponse, DevolverRequest, EntregarMultipleRequest, EntregarRequest, TrasladarRequest
from app.services.asignacion_service import AsignacionService

router = APIRouter(prefix='/api/v1/asignaciones', tags=['asignaciones'])


def _service(db: Session = Depends(get_db)) -> AsignacionService:
    return AsignacionService(
        AsignacionRepository(db),
        EquipmentRepository(db),
        EmpleadoRepository(db),
        BodegaRepository(db),
    )


@router.post('/entregar')
def entregar(
    payload: EntregarRequest,
    service: AsignacionService = Depends(_service),
    user=Depends(require_permissions('asignaciones:write')),
):
    return service.entregar(payload, user.id)


@router.post('/entregar-multiple')
def entregar_multiple(
    payload: EntregarMultipleRequest,
    service: AsignacionService = Depends(_service),
    user=Depends(require_permissions('asignaciones:write')),
):
    return service.entregar_multiple(payload, user.id)


@router.post('/devolver')
def devolver(
    payload: DevolverRequest,
    service: AsignacionService = Depends(_service),
    user=Depends(require_permissions('asignaciones:write')),
):
    return service.devolver(payload, user.id)


@router.post('/trasladar')
def trasladar(
    payload: TrasladarRequest,
    service: AsignacionService = Depends(_service),
    user=Depends(require_permissions('asignaciones:write')),
):
    return service.trasladar(payload, user.id)


@router.get('/activas', response_model=AsignacionListResponse)
def get_activas(
    service: AsignacionService = Depends(_service),
    _user=Depends(require_permissions('asignaciones:read')),
):
    items = service.get_activas()
    return {'total': len(items), 'items': items}


@router.get('/historial', response_model=AsignacionListResponse)
def get_historial(
    equipment_id: int | None = Query(None),
    empleado_id: int | None = Query(None),
    tipo: str | None = Query(None),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    service: AsignacionService = Depends(_service),
    _user=Depends(require_permissions('asignaciones:read')),
):
    items, total = service.get_historial(equipment_id, empleado_id, tipo, desde, hasta, skip, limit)
    return {'total': total, 'items': items}
