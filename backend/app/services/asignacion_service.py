from datetime import date

from fastapi import HTTPException, status

from app.models.asignacion import Asignacion, TIPO_DEVOLUCION, TIPO_ENTREGA, TIPO_TRASLADO
from app.models.equipment import Equipment
from app.repositories.asignacion_repository import AsignacionRepository
from app.repositories.bodega_repository import BodegaRepository
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.equipment_repository import EquipmentRepository
from app.schemas.asignacion import AsignacionOut, DevolverRequest, EntregarMultipleRequest, EntregarRequest, TrasladarRequest

ESTADOS_ENTREGABLES = {'Disponible', 'En bodega'}
ESTADOS_DEVOLVIBLES = {'Asignado', 'Prestado'}
ESTADOS_TRASLADABLES = {'Disponible', 'En bodega'}


def _to_out(a: Asignacion) -> AsignacionOut:
    eq = a.equipment
    emp = a.empleado
    return AsignacionOut(
        id=a.id,
        tipo=a.tipo,
        fecha=a.fecha,
        estado_antes=a.estado_antes,
        estado_despues=a.estado_despues,
        observaciones=a.observaciones,
        equipment_id=eq.id,
        equipment_codigo=eq.codigo_interno,
        equipment_serial=eq.serial,
        equipment_tipo=eq.tipo,
        equipment_marca=eq.marca,
        equipment_modelo=eq.modelo,
        equipment_sede=eq.sede,
        empleado_id=emp.id if emp else None,
        empleado_nombre=f'{emp.nombres} {emp.apellidos}' if emp else None,
        empleado_cedula=emp.cedula if emp else None,
        bodega_origen_nombre=a.bodega_origen.nombre if a.bodega_origen else None,
        bodega_destino_nombre=a.bodega_destino.nombre if a.bodega_destino else None,
        created_by_nombre=a.created_by.full_name if a.created_by else '',
        created_at=a.created_at,
    )


class AsignacionService:
    def __init__(
        self,
        repo: AsignacionRepository,
        eq_repo: EquipmentRepository,
        emp_repo: EmpleadoRepository,
        bod_repo: BodegaRepository,
    ):
        self.repo = repo
        self.eq_repo = eq_repo
        self.emp_repo = emp_repo
        self.bod_repo = bod_repo

    def entregar(self, payload: EntregarRequest, created_by_id: int) -> AsignacionOut:
        equipo = self.eq_repo.get_by_id(payload.equipment_id)
        if not equipo:
            raise HTTPException(status_code=404, detail='Equipo no encontrado')
        if equipo.estado not in ESTADOS_ENTREGABLES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'El equipo tiene estado "{equipo.estado}" y no puede entregarse',
            )
        empleado = self.emp_repo.get_by_id(payload.empleado_id)
        if not empleado:
            raise HTTPException(status_code=404, detail='Empleado no encontrado')

        estado_antes = equipo.estado
        asignacion = Asignacion(
            equipment_id=equipo.id,
            tipo=TIPO_ENTREGA,
            empleado_id=empleado.id,
            bodega_origen_id=payload.bodega_origen_id or equipo.bodega_id,
            estado_antes=estado_antes,
            estado_despues='Asignado',
            observaciones=payload.observaciones,
            created_by_id=created_by_id,
        )
        equipo.estado = 'Asignado'
        equipo.empleado_id = empleado.id
        equipo.bodega_id = None
        self.eq_repo.update(equipo)

        # Cascade to children (peripherals)
        for child in self.eq_repo.get_children(equipo.id):
            if child.estado in ESTADOS_ENTREGABLES:
                child_asig = Asignacion(
                    equipment_id=child.id,
                    tipo=TIPO_ENTREGA,
                    empleado_id=empleado.id,
                    bodega_origen_id=child.bodega_id,
                    estado_antes=child.estado,
                    estado_despues='Asignado',
                    observaciones=f'Periférico de {equipo.codigo_interno}',
                    created_by_id=created_by_id,
                )
                child.estado = 'Asignado'
                child.empleado_id = empleado.id
                child.bodega_id = None
                self.eq_repo.update(child)
                self.repo.create(child_asig)

        return _to_out(self.repo.create(asignacion))

    def devolver(self, payload: DevolverRequest, created_by_id: int) -> AsignacionOut:
        equipo = self.eq_repo.get_by_id(payload.equipment_id)
        if not equipo:
            raise HTTPException(status_code=404, detail='Equipo no encontrado')
        if equipo.estado not in ESTADOS_DEVOLVIBLES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'El equipo tiene estado "{equipo.estado}" y no puede devolverse',
            )

        estado_nuevo = 'En bodega' if payload.bodega_destino_id else 'Disponible'
        emp_id_antes = equipo.empleado_id
        asignacion = Asignacion(
            equipment_id=equipo.id,
            tipo=TIPO_DEVOLUCION,
            empleado_id=emp_id_antes,
            bodega_destino_id=payload.bodega_destino_id,
            estado_antes=equipo.estado,
            estado_despues=estado_nuevo,
            observaciones=payload.observaciones,
            created_by_id=created_by_id,
        )
        equipo.estado = estado_nuevo
        equipo.empleado_id = None
        equipo.bodega_id = payload.bodega_destino_id
        self.eq_repo.update(equipo)

        # Cascade return to children (peripherals)
        for child in self.eq_repo.get_children(equipo.id):
            if child.estado in ESTADOS_DEVOLVIBLES:
                child_asig = Asignacion(
                    equipment_id=child.id,
                    tipo=TIPO_DEVOLUCION,
                    empleado_id=emp_id_antes,
                    bodega_destino_id=payload.bodega_destino_id,
                    estado_antes=child.estado,
                    estado_despues=estado_nuevo,
                    observaciones=f'Periférico de {equipo.codigo_interno}',
                    created_by_id=created_by_id,
                )
                child.estado = estado_nuevo
                child.empleado_id = None
                child.bodega_id = payload.bodega_destino_id
                self.eq_repo.update(child)
                self.repo.create(child_asig)

        return _to_out(self.repo.create(asignacion))

    def trasladar(self, payload: TrasladarRequest, created_by_id: int) -> AsignacionOut:
        equipo = self.eq_repo.get_by_id(payload.equipment_id)
        if not equipo:
            raise HTTPException(status_code=404, detail='Equipo no encontrado')
        if equipo.estado not in ESTADOS_TRASLADABLES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'El equipo tiene estado "{equipo.estado}" y no puede trasladarse. Debe estar Disponible o En bodega.',
            )
        bodega = self.bod_repo.get_by_id(payload.bodega_destino_id)
        if not bodega:
            raise HTTPException(status_code=404, detail='Bodega destino no encontrada')

        asignacion = Asignacion(
            equipment_id=equipo.id,
            tipo=TIPO_TRASLADO,
            bodega_origen_id=equipo.bodega_id,
            bodega_destino_id=payload.bodega_destino_id,
            estado_antes=equipo.estado,
            estado_despues='En bodega',
            observaciones=payload.observaciones,
            created_by_id=created_by_id,
        )
        equipo.estado = 'En bodega'
        equipo.bodega_id = payload.bodega_destino_id
        self.eq_repo.update(equipo)
        return _to_out(self.repo.create(asignacion))

    def get_historial(
        self,
        equipment_id: int | None,
        empleado_id: int | None,
        tipo: str | None,
        desde: date | None,
        hasta: date | None,
        skip: int = 0,
        limit: int | None = 50,
    ) -> tuple[list[AsignacionOut], int]:
        items, count = self.repo.list_historial(equipment_id, empleado_id, tipo, desde, hasta, skip, limit)
        return [_to_out(a) for a in items], count

    def entregar_multiple(self, payload: EntregarMultipleRequest, created_by_id: int) -> list[AsignacionOut]:
        if not payload.equipment_ids:
            raise HTTPException(status_code=400, detail='Debe seleccionar al menos un equipo')
        results = []
        for eq_id in payload.equipment_ids:
            single = EntregarRequest(
                equipment_id=eq_id,
                empleado_id=payload.empleado_id,
                bodega_origen_id=payload.bodega_origen_id,
                observaciones=payload.observaciones,
            )
            results.append(self.entregar(single, created_by_id))
        return results

    def get_activas(self) -> list[AsignacionOut]:
        return [_to_out(a) for a in self.repo.get_activas()]
