from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_user_dominios, require_any_permission, require_permissions
from app.models.bodega import Bodega
from app.models.equipment import Equipment
from app.repositories.acta_entrega_repository import ActaEntregaRepository
from app.schemas.acta_entrega import ActaEntregaCreate, ActaEntregaRow, ActaListResponse
from app.utils.csv_export import csv_response

router = APIRouter(prefix='/api/v1/actas', tags=['actas'])


def _repo(db: Session = Depends(get_db)) -> ActaEntregaRepository:
    return ActaEntregaRepository(db)


def _infer_dominio(payload: ActaEntregaCreate, db: Session) -> str:
    """Determina el dominio del acta a partir de la bodega o del primer equipo del snapshot."""
    if payload.bodega_id:
        bodega = db.get(Bodega, payload.bodega_id)
        if bodega:
            return bodega.dominio
    if payload.equipos_snapshot:
        first_id = payload.equipos_snapshot[0].get('id') if isinstance(payload.equipos_snapshot[0], dict) else getattr(payload.equipos_snapshot[0], 'id', None)
        if first_id:
            eq = db.get(Equipment, first_id)
            if eq:
                return eq.dominio
    return 'IT'


def _to_row(acta) -> ActaEntregaRow:
    return ActaEntregaRow(
        id=acta.id,
        tipo=acta.tipo,
        sede=acta.sede,
        titulo=acta.titulo,
        entrega_nombre=acta.entrega_nombre,
        recibe_nombre=acta.recibe_nombre,
        firma_entrega=acta.firma_entrega,
        firma_recibe=acta.firma_recibe,
        equipos_snapshot=acta.equipos_snapshot or [],
        bodega_id=acta.bodega_id,
        empleado_id=acta.empleado_id,
        observaciones=acta.observaciones,
        fecha=acta.fecha,
        created_by_nombre=acta.created_by.full_name if acta.created_by else None,
        total_equipos=len(acta.equipos_snapshot or []),
    )


@router.post('', response_model=ActaEntregaRow)
def create_acta(
    payload: ActaEntregaCreate,
    repo: ActaEntregaRepository = Depends(_repo),
    db: Session = Depends(get_db),
    user=Depends(require_any_permission('asignaciones:write', 'asignaciones:entregar', 'bodegas:write')),
):
    data = payload.model_dump()
    data['created_by_id'] = user.id
    data['dominio'] = _infer_dominio(payload, db)
    acta = repo.create(data)
    return _to_row(acta)


@router.get('', response_model=ActaListResponse)
def list_actas(
    tipo: str | None = Query(None),
    sede: str | None = Query(None),
    bodega_id: int | None = Query(None),
    empleado_id: int | None = Query(None),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    repo: ActaEntregaRepository = Depends(_repo),
    user=Depends(require_any_permission('asignaciones:read', 'bodegas:read')),
):
    items, total = repo.list(
        tipo, sede, bodega_id, empleado_id, desde, hasta, skip, limit,
        dominios_permitidos=get_user_dominios(user),
    )
    return {'total': total, 'items': [_to_row(a) for a in items]}


@router.get('/export')
def export_actas(
    tipo: str | None = Query(None),
    sede: str | None = Query(None),
    bodega_id: int | None = Query(None),
    empleado_id: int | None = Query(None),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    repo: ActaEntregaRepository = Depends(_repo),
    user=Depends(require_any_permission('asignaciones:read', 'bodegas:read')),
    _export=Depends(require_permissions('reports:export')),
):
    items, _ = repo.list(
        tipo, sede, bodega_id, empleado_id, desde, hasta, 0, None,
        dominios_permitidos=get_user_dominios(user),
    )
    rows = [
        [
            a.fecha.isoformat(),
            a.tipo,
            a.titulo,
            a.sede,
            a.entrega_nombre,
            a.recibe_nombre,
            len(a.equipos_snapshot or []),
            'Sí' if (a.firma_entrega and a.firma_recibe) else 'No',
            a.observaciones or '',
            a.created_by.full_name if a.created_by else '',
        ]
        for a in items
    ]
    return csv_response(
        'actas_firmadas.csv',
        ['Fecha', 'Tipo', 'Título', 'Sede', 'Entrega', 'Recibe', 'N° equipos', 'Firmas completas',
         'Observaciones', 'Registrado por'],
        rows,
    )


@router.get('/{acta_id}', response_model=ActaEntregaRow)
def get_acta(
    acta_id: int,
    repo: ActaEntregaRepository = Depends(_repo),
    _user=Depends(require_any_permission('asignaciones:read', 'bodegas:read')),
):
    acta = repo.get_by_id(acta_id)
    if not acta:
        raise HTTPException(status_code=404, detail='Acta no encontrada')
    return _to_row(acta)
