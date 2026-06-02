from fastapi import HTTPException, status

from app.models.mantenimiento import Mantenimiento
from app.repositories.equipment_repository import EquipmentRepository
from app.repositories.mantenimiento_repository import MantenimientoRepository
from app.schemas.mantenimiento import MantenimientoCreate, MantenimientoOut, MantenimientoUpdate


def _to_out(m: Mantenimiento) -> MantenimientoOut:
    eq = m.equipment
    return MantenimientoOut(
        id=m.id,
        equipment_id=m.equipment_id,
        equipment_codigo=eq.codigo_interno,
        equipment_marca=eq.marca,
        equipment_modelo=eq.modelo,
        tipo=m.tipo,
        fecha=m.fecha,
        tecnico=m.tecnico,
        descripcion=m.descripcion,
        costo=m.costo,
        observaciones=m.observaciones,
        proximo_mantenimiento=m.proximo_mantenimiento,
        created_by_nombre=m.created_by.full_name if m.created_by else '',
        created_at=m.created_at,
    )


class MantenimientoService:
    def __init__(self, repo: MantenimientoRepository, eq_repo: EquipmentRepository):
        self.repo = repo
        self.eq_repo = eq_repo

    def list_by_equipment(self, equipment_id: int) -> list[MantenimientoOut]:
        return [_to_out(m) for m in self.repo.list_by_equipment(equipment_id)]

    def create(self, payload: MantenimientoCreate, created_by_id: int) -> MantenimientoOut:
        equipo = self.eq_repo.get_by_id(payload.equipment_id)
        if not equipo:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Equipo no encontrado')

        m = Mantenimiento(
            equipment_id=payload.equipment_id,
            tipo=payload.tipo,
            fecha=payload.fecha,
            tecnico=payload.tecnico,
            descripcion=payload.descripcion,
            costo=payload.costo,
            observaciones=payload.observaciones,
            proximo_mantenimiento=payload.proximo_mantenimiento,
            created_by_id=created_by_id,
        )
        return _to_out(self.repo.create(m))

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
