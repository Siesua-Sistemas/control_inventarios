from datetime import datetime

from fastapi import HTTPException

from app.models.baja_equipo import MOTIVOS_BAJA, BajaEquipo
from app.repositories.baja_equipo_repository import BajaEquipoRepository
from app.repositories.equipment_repository import EquipmentRepository
from app.schemas.baja_equipo import BajaAprobarRequest, BajaEquipoCreate, BajaEquipoOut, BajaFotoOut

ESTADOS_NO_DABLES_DE_BAJA = {'Dado de baja'}


def _to_out(b: BajaEquipo) -> BajaEquipoOut:
    eq = b.equipment
    return BajaEquipoOut(
        id=b.id,
        equipment_id=eq.id,
        equipment_codigo=eq.codigo_interno,
        equipment_serial=eq.serial,
        equipment_tipo=eq.tipo,
        equipment_marca=eq.marca,
        equipment_modelo=eq.modelo,
        equipment_sede=eq.sede,
        motivo=b.motivo,
        motivo_detalle=b.motivo_detalle,
        observaciones=b.observaciones,
        estado=b.estado,
        solicitado_por_nombre=b.solicitado_por.full_name if b.solicitado_por else '',
        solicitado_en=b.solicitado_en,
        firma_autoriza=b.firma_autoriza,
        autorizado_por_nombre=b.autorizado_por.full_name if b.autorizado_por else None,
        autorizado_en=b.autorizado_en,
        comentario_aprobacion=b.comentario_aprobacion,
        fotos=[
            BajaFotoOut(id=f.id, baja_id=f.baja_id, filename=f.filename, url=f'/storage/baja_equipo_fotos/{f.filename}', created_at=f.created_at)
            for f in b.fotos
        ],
    )


class BajaEquipoService:
    def __init__(self, repo: BajaEquipoRepository, eq_repo: EquipmentRepository):
        self.repo = repo
        self.eq_repo = eq_repo

    def crear(self, payload: BajaEquipoCreate, solicitado_por_id: int) -> BajaEquipoOut:
        if payload.motivo not in MOTIVOS_BAJA:
            raise HTTPException(status_code=400, detail='Motivo de baja inválido')
        if payload.motivo == 'otro' and not (payload.motivo_detalle or '').strip():
            raise HTTPException(status_code=400, detail='Debes describir el motivo cuando seleccionas "Otro"')

        equipo = self.eq_repo.get_by_id(payload.equipment_id)
        if not equipo:
            raise HTTPException(status_code=404, detail='Equipo no encontrado')
        if equipo.estado in ESTADOS_NO_DABLES_DE_BAJA:
            raise HTTPException(status_code=409, detail='El equipo ya está dado de baja')
        if self.repo.get_pendiente_por_equipo(payload.equipment_id):
            raise HTTPException(status_code=409, detail='Ya existe una solicitud de baja pendiente de aprobación para este equipo')

        baja = BajaEquipo(
            equipment_id=payload.equipment_id,
            motivo=payload.motivo,
            motivo_detalle=payload.motivo_detalle,
            observaciones=payload.observaciones,
            estado='pendiente_aprobacion',
            solicitado_por_id=solicitado_por_id,
            equipment_estado_antes=equipo.estado,
        )
        return _to_out(self.repo.create(baja))

    def get(self, baja_id: int) -> BajaEquipoOut:
        baja = self.repo.get_by_id(baja_id)
        if not baja:
            raise HTTPException(status_code=404, detail='Solicitud de baja no encontrada')
        return _to_out(baja)

    def listar(
        self,
        estado: str | None,
        equipment_id: int | None,
        skip: int,
        limit: int | None,
        dominios_permitidos: list[str] | None,
    ) -> tuple[list[BajaEquipoOut], int]:
        items, total = self.repo.list(estado, equipment_id, dominios_permitidos, skip, limit)
        return [_to_out(b) for b in items], total

    def aprobar(self, baja_id: int, payload: BajaAprobarRequest, autorizado_por_id: int) -> BajaEquipoOut:
        baja = self.repo.get_by_id(baja_id)
        if not baja:
            raise HTTPException(status_code=404, detail='Solicitud de baja no encontrada')
        if baja.estado != 'pendiente_aprobacion':
            raise HTTPException(status_code=400, detail='Esta solicitud ya fue procesada')
        if not (payload.firma_autoriza or '').strip():
            raise HTTPException(status_code=400, detail='Se requiere la firma de quien autoriza')
        if payload.aprobado and not baja.fotos:
            raise HTTPException(status_code=400, detail='La solicitud necesita al menos una foto de evidencia antes de aprobarla')

        baja.estado = 'aprobada' if payload.aprobado else 'rechazada'
        baja.firma_autoriza = payload.firma_autoriza
        baja.autorizado_por_id = autorizado_por_id
        baja.autorizado_en = datetime.utcnow()
        baja.comentario_aprobacion = payload.comentario

        if payload.aprobado:
            equipo = self.eq_repo.get_by_id(baja.equipment_id)
            if equipo:
                equipo.estado = 'Dado de baja'
                equipo.empleado_id = None
                equipo.bodega_id = None
                self.eq_repo.update(equipo)

        return _to_out(self.repo.update(baja))
