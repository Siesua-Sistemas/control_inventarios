from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_user_dominios, require_permissions
from app.models.bodega import Bodega
from app.models.empleado import Empleado
from app.models.equipment import Equipment
from app.repositories.asignacion_repository import AsignacionRepository
from app.schemas.asignacion import AsignacionOut
from app.schemas.dashboard import (
    DashboardStats, EquipoRecienteItem, GarantiaAlertaItem, InventarioDashboard,
)
from app.services.asignacion_service import _to_out

GARANTIA_DIAS_ALERTA = 60
ALTAS_RECIENTES_LIMITE = 8

router = APIRouter(prefix='/api/v1/dashboard', tags=['dashboard'])


@router.get('', response_model=DashboardStats)
def get_stats(
    db: Session = Depends(get_db),
    user=Depends(require_permissions()),
):
    dominios_permitidos = get_user_dominios(user)
    eq_filter = [Equipment.is_active.is_(True)]
    if dominios_permitidos is not None:
        eq_filter.append(Equipment.dominio.in_(dominios_permitidos))

    total_equipos = db.scalar(select(func.count()).where(*eq_filter)) or 0
    total_bodegas = db.scalar(select(func.count()).where(Bodega.is_active.is_(True))) or 0
    total_empleados = db.scalar(select(func.count()).where(Empleado.is_active.is_(True))) or 0

    estados_rows = db.execute(
        select(Equipment.estado, func.count())
        .where(*eq_filter)
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


@router.get('/inventario', response_model=InventarioDashboard)
def get_inventario_dashboard(
    db: Session = Depends(get_db),
    user=Depends(require_permissions()),
):
    today = date.today()
    dominios_permitidos = get_user_dominios(user)
    eq_filter = [Equipment.is_active.is_(True)]
    if dominios_permitidos is not None:
        eq_filter.append(Equipment.dominio.in_(dominios_permitidos))

    total_equipos = db.scalar(select(func.count()).where(*eq_filter)) or 0

    tipo_rows = db.execute(
        select(Equipment.tipo, func.count()).where(*eq_filter).group_by(Equipment.tipo)
    ).all()
    por_tipo = {row[0]: row[1] for row in tipo_rows}

    estado_rows = db.execute(
        select(Equipment.estado, func.count()).where(*eq_filter).group_by(Equipment.estado)
    ).all()
    por_estado = {row[0]: row[1] for row in estado_rows}

    garantia_rows = db.execute(
        select(Equipment)
        .where(
            *eq_filter,
            Equipment.garantia_vence.is_not(None),
            Equipment.garantia_vence >= today,
            Equipment.garantia_vence <= today + timedelta(days=GARANTIA_DIAS_ALERTA),
        )
        .order_by(Equipment.garantia_vence.asc())
        .limit(20)
    ).scalars().all()
    garantias_por_vencer = [
        GarantiaAlertaItem(
            equipment_id=eq.id,
            equipment_codigo=eq.codigo_interno,
            equipment_marca=eq.marca,
            equipment_modelo=eq.modelo,
            sede=eq.sede,
            garantia_vence=eq.garantia_vence,
            dias=(eq.garantia_vence - today).days,
        )
        for eq in garantia_rows
    ]

    altas_rows = db.execute(
        select(Equipment).where(*eq_filter).order_by(Equipment.created_at.desc()).limit(ALTAS_RECIENTES_LIMITE)
    ).scalars().all()
    altas_recientes = [
        EquipoRecienteItem(
            id=eq.id,
            codigo_interno=eq.codigo_interno,
            tipo=eq.tipo,
            marca=eq.marca,
            modelo=eq.modelo,
            sede=eq.sede,
            estado=eq.estado,
            created_at=eq.created_at,
        )
        for eq in altas_rows
    ]

    return InventarioDashboard(
        total_equipos=total_equipos,
        por_tipo=por_tipo,
        por_estado=por_estado,
        garantias_por_vencer=garantias_por_vencer,
        altas_recientes=altas_recientes,
    )
