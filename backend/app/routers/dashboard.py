from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permissions
from app.models.bodega import Bodega
from app.models.empleado import Empleado
from app.models.equipment import Equipment
from app.repositories.asignacion_repository import AsignacionRepository
from app.schemas.asignacion import AsignacionOut
from app.schemas.dashboard import DashboardStats
from app.services.asignacion_service import _to_out

router = APIRouter(prefix='/api/v1/dashboard', tags=['dashboard'])


@router.get('', response_model=DashboardStats)
def get_stats(
    db: Session = Depends(get_db),
    _user=Depends(require_permissions()),
):
    total_equipos = db.scalar(select(func.count()).where(Equipment.is_active.is_(True))) or 0
    total_bodegas = db.scalar(select(func.count()).where(Bodega.is_active.is_(True))) or 0
    total_empleados = db.scalar(select(func.count()).where(Empleado.is_active.is_(True))) or 0

    estados_rows = db.execute(
        select(Equipment.estado, func.count())
        .where(Equipment.is_active.is_(True))
        .group_by(Equipment.estado)
    ).all()
    por_estado = {row[0]: row[1] for row in estados_rows}

    repo = AsignacionRepository(db)
    asignaciones_hoy = repo.count_today()
    recientes = [_to_out(a) for a in repo.get_recent(8)]

    return DashboardStats(
        total_equipos=total_equipos,
        total_bodegas=total_bodegas,
        total_empleados=total_empleados,
        asignaciones_hoy=asignaciones_hoy,
        por_estado=por_estado,
        ultimos_movimientos=recientes,
    )
