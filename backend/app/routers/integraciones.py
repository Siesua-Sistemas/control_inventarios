from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permissions

router = APIRouter(prefix='/api/v1/integraciones', tags=['integraciones'])


class SyncResultOut(BaseModel):
    sedes_creadas: int
    sedes_actualizadas: int
    empleados_creados: int
    empleados_actualizados: int
    empleados_sin_cambios: int
    errores: list[str]
    ok: bool


@router.post('/siesua/sync', response_model=SyncResultOut)
def sync_siesua(
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('roles:write')),
):
    """
    Sincroniza sedes y empleados activos desde SIESUA (MySQL) hacia la BD interna.
    Requiere permiso roles:write (administrador). Idempotente: seguro de ejecutar varias veces.
    """
    from app.integrations.siesua import sincronizar
    result = sincronizar(db)
    return SyncResultOut(
        sedes_creadas=result.sedes_creadas,
        sedes_actualizadas=result.sedes_actualizadas,
        empleados_creados=result.empleados_creados,
        empleados_actualizados=result.empleados_actualizados,
        empleados_sin_cambios=result.empleados_sin_cambios,
        errores=result.errores,
        ok=result.ok,
    )
