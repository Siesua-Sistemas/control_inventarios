from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permissions
from app.models.red_wifi import RedWifi
from app.schemas.red_wifi import RedWifiAdminOut, RedWifiCreate, RedWifiUpdate

router = APIRouter(prefix='/api/v1/redes-wifi', tags=['redes-wifi'])


@router.get('', response_model=list[RedWifiAdminOut])
def list_redes(
    sede: str | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('wifi:write')),
):
    q = select(RedWifi)
    if sede:
        q = q.where(RedWifi.sede == sede)
    return db.execute(q.order_by(RedWifi.sede, RedWifi.nombre_red)).scalars().all()


@router.post('', response_model=RedWifiAdminOut, status_code=201)
def create_red(
    body: RedWifiCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('wifi:write')),
):
    red = RedWifi(**body.model_dump())
    db.add(red)
    db.commit()
    db.refresh(red)
    return red


@router.patch('/{red_id}', response_model=RedWifiAdminOut)
def update_red(
    red_id: int,
    body: RedWifiUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('wifi:write')),
):
    red = db.get(RedWifi, red_id)
    if not red:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Red no encontrada')
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(red, field, value)
    db.commit()
    db.refresh(red)
    return red


@router.delete('/{red_id}', status_code=204)
def delete_red(
    red_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('wifi:write')),
):
    red = db.get(RedWifi, red_id)
    if not red:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Red no encontrada')
    db.delete(red)
    db.commit()
