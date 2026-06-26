from datetime import datetime

from fastapi import HTTPException, status

from app.models.mantenimiento import Mantenimiento
from app.models.mantenimiento_paso import MantenimientoPaso
from app.models.mantenimiento_plantilla import MantenimientoPlantillaPaso
from app.repositories.equipment_repository import EquipmentRepository
from app.repositories.mantenimiento_config_repository import MantenimientoConfigRepository
from app.repositories.mantenimiento_repository import MantenimientoRepository
from app.schemas.mantenimiento import (
    MantenimientoCreate,
    MantenimientoOut,
    MantenimientoPhotoOut,
    MantenimientoUpdate,
    PasoOut,
)
from app.utils.dates import add_months


def _to_out(m: Mantenimiento) -> MantenimientoOut:
    eq = m.equipment
    tecnico_nombre = None
    if m.tecnico_user:
        tecnico_nombre = m.tecnico_user.full_name
    elif m.tecnico:
        tecnico_nombre = m.tecnico
    return MantenimientoOut(
        id=m.id,
        numero_ot=m.numero_ot,
        equipment_id=m.equipment_id,
        equipment_codigo=eq.codigo_interno,
        equipment_marca=eq.marca,
        equipment_modelo=eq.modelo,
        equipment_tipo=eq.tipo,
        equipment_sede=eq.sede,
        tipo=m.tipo,
        fecha=m.fecha,
        tecnico=m.tecnico,
        tecnico_id=m.tecnico_id,
        tecnico_nombre=tecnico_nombre,
        descripcion=m.descripcion,
        costo=m.costo,
        observaciones=m.observaciones,
        proximo_mantenimiento=m.proximo_mantenimiento,
        estado=m.estado,
        prioridad=m.prioridad,
        firma_tecnico=m.firma_tecnico,
        firma_supervisor=m.firma_supervisor,
        aprobado_por_nombre=m.aprobado_por.full_name if m.aprobado_por else None,
        aprobado_en=m.aprobado_en,
        comentario_aprobacion=m.comentario_aprobacion,
        created_by_nombre=m.created_by.full_name if m.created_by else '',
        created_at=m.created_at,
        fotos=[
            MantenimientoPhotoOut(
                id=p.id,
                mantenimiento_id=p.mantenimiento_id,
                filename=p.filename,
                url=f'/storage/mantenimiento_photos/{p.filename}',
                created_at=p.created_at,
            )
            for p in (m.photos or [])
        ],
        pasos=[
            PasoOut(
                id=paso.id,
                mantenimiento_id=paso.mantenimiento_id,
                orden=paso.orden,
                descripcion=paso.descripcion,
                completado=paso.completado,
                completado_en=paso.completado_en,
            )
            for paso in (m.pasos or [])
        ],
    )


class MantenimientoService:
    DEFAULT_FRECUENCIA_MESES = 6

    def __init__(
        self,
        repo: MantenimientoRepository,
        eq_repo: EquipmentRepository,
        config_repo: MantenimientoConfigRepository,
    ):
        self.repo = repo
        self.eq_repo = eq_repo
        self.config_repo = config_repo

    def list_by_equipment(self, equipment_id: int) -> list[MantenimientoOut]:
        return [_to_out(m) for m in self.repo.list_by_equipment(equipment_id)]

    def list_global(
        self,
        sede: str | None = None,
        tipo: str | None = None,
        tipo_equipo: str | None = None,
        estado_vencimiento: str | None = None,
        proximo_desde=None,
        proximo_hasta=None,
        estado: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[int, list[MantenimientoOut]]:
        items, total = self.repo.list_global(sede, tipo, tipo_equipo, estado_vencimiento, proximo_desde, proximo_hasta, estado, skip, limit)
        return total, [_to_out(m) for m in items]

    def create(self, payload: MantenimientoCreate, created_by_id: int) -> MantenimientoOut:
        equipo = self.eq_repo.get_by_id(payload.equipment_id)
        if not equipo:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Equipo no encontrado')

        proximo = payload.proximo_mantenimiento
        if payload.tipo == 'Preventivo' and proximo is None:
            config = self.config_repo.get_by_tipo(equipo.tipo)
            meses = config.frecuencia_meses if config else self.DEFAULT_FRECUENCIA_MESES
            proximo = add_months(payload.fecha.date(), meses)

        m = Mantenimiento(
            equipment_id=payload.equipment_id,
            tipo=payload.tipo,
            fecha=payload.fecha,
            tecnico=payload.tecnico,
            tecnico_id=payload.tecnico_id,
            descripcion=payload.descripcion,
            costo=payload.costo,
            observaciones=payload.observaciones,
            proximo_mantenimiento=proximo,
            prioridad=payload.prioridad,
            created_by_id=created_by_id,
        )
        result = self.repo.create(m)

        # Generate numero_ot after we have the ID
        from sqlalchemy import func, select as sa_select
        count = self.repo.db.scalar(
            sa_select(func.count()).where(Mantenimiento.is_active.is_(True))
        ) or 1
        result.numero_ot = f"OT-{datetime.now().strftime('%Y%m%d')}-{count:04d}"
        self.repo.db.add(result)
        self.repo.db.commit()
        self.repo.db.refresh(result)

        # Auto-copy template steps for this equipment type / maintenance type
        db = self.repo.db
        from sqlalchemy import select, or_
        plantillas = list(db.scalars(
            select(MantenimientoPlantillaPaso)
            .where(
                MantenimientoPlantillaPaso.tipo_equipo == equipo.tipo,
                or_(
                    MantenimientoPlantillaPaso.tipo_mantenimiento == payload.tipo,
                    MantenimientoPlantillaPaso.tipo_mantenimiento == 'Ambos',
                ),
            )
            .order_by(MantenimientoPlantillaPaso.orden)
        ).all())
        if plantillas:
            for p in plantillas:
                db.add(MantenimientoPaso(
                    mantenimiento_id=result.id,
                    orden=p.orden,
                    descripcion=p.descripcion,
                    completado=False,
                ))
            db.commit()
            db.refresh(result)

        # Clear auto-scheduled date now that a real maintenance exists
        if payload.tipo == 'Preventivo' and equipo.proximo_preventivo is not None:
            equipo.proximo_preventivo = None
            self.eq_repo.update(equipo)
        return _to_out(result)

    def update(self, mantenimiento_id: int, payload: MantenimientoUpdate) -> MantenimientoOut:
        m = self.repo.get_by_id(mantenimiento_id)
        if not m:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Mantenimiento no encontrado')
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(m, field, value)
        return _to_out(self.repo.update(m))

    def delete(self, mantenimiento_id: int) -> None:
        m = self.repo.get_by_id(mantenimiento_id)
        if not m:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Mantenimiento no encontrado')
        self.repo.soft_delete(m)
