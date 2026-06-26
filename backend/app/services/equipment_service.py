from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.equipment import Equipment
from app.repositories.equipment_repository import EquipmentRepository
from app.repositories.equipment_tipo_repository import EquipmentTipoRepository
from app.repositories.mantenimiento_config_repository import MantenimientoConfigRepository
from app.schemas.equipment import EquipmentCreate, EquipmentUpdate
from app.utils.dates import add_months

DEFAULT_FRECUENCIA_MESES = 12


def _calc_proximo_preventivo(
    tipo: str,
    garantia_vence: date | None,
    fecha_compra: date | None,
    created_at: date,
    config_repo: MantenimientoConfigRepository,
    tipo_repo: EquipmentTipoRepository,
) -> date | None:
    tipo_obj = tipo_repo.get_by_nombre(tipo)
    if tipo_obj and tipo_obj.es_periferico:
        return None
    config = config_repo.get_by_tipo(tipo)
    if config and not config.tiene_mantenimiento:
        return None
    if garantia_vence:
        return garantia_vence
    meses = config.frecuencia_meses if config else DEFAULT_FRECUENCIA_MESES
    base = fecha_compra or created_at
    return add_months(base, meses)


class EquipmentService:
    def __init__(
        self,
        repository: EquipmentRepository,
        tipo_repository: EquipmentTipoRepository,
        config_repository: MantenimientoConfigRepository | None = None,
    ):
        self.repository = repository
        self.tipo_repository = tipo_repository
        self.config_repository = config_repository

    def _validate_tipo(self, tipo: str) -> None:
        if not self.tipo_repository.get_by_nombre(tipo):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Tipo de equipo inválido')

    def list_equipment(
        self,
        search: str | None,
        tipo: str | None,
        sede: str | None,
        estado: str | None,
        criticidad: str | None = None,
        skip: int = 0,
        limit: int | None = None,
    ) -> tuple[list[Equipment], int]:
        return self.repository.list_equipment(search, tipo, sede, estado, criticidad, skip, limit)

    def get_equipment(self, equipment_id: int) -> Equipment:
        equipment = self.repository.get_by_id(equipment_id)
        if not equipment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Equipo no encontrado')
        return equipment

    def _generate_codigo_interno(self) -> str:
        last = self.repository.get_last_codigo_interno()
        if last:
            try:
                number = int(last.split('-')[1]) + 1
            except (IndexError, ValueError):
                number = 1
        else:
            number = 1
        return f'EQ-{number:05d}'

    def create_equipment(self, payload: EquipmentCreate) -> Equipment:
        self._validate_tipo(payload.tipo)

        existing = self.repository.get_by_serial(payload.serial)
        if existing and existing.is_active:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='El serial ya está registrado')

        proximo_preventivo = None
        if self.config_repository:
            today = date.today()
            proximo_preventivo = _calc_proximo_preventivo(
                payload.tipo,
                payload.garantia_vence,
                payload.fecha_compra,
                today,
                self.config_repository,
                self.tipo_repository,
            )

        equipment = Equipment(
            codigo_interno=self._generate_codigo_interno(),
            serial=payload.serial.strip(),
            tipo=payload.tipo,
            marca=payload.marca.strip(),
            modelo=payload.modelo.strip(),
            placa=payload.placa.strip() if payload.placa else None,
            sede=payload.sede.strip(),
            ubicacion=payload.ubicacion.strip() if payload.ubicacion else None,
            bodega_id=payload.bodega_id,
            estado=payload.estado,
            criticidad=payload.criticidad,
            fecha_compra=payload.fecha_compra,
            valor=payload.valor,
            proveedor=payload.proveedor.strip() if payload.proveedor else None,
            numero_factura=payload.numero_factura.strip() if payload.numero_factura else None,
            garantia_vence=payload.garantia_vence,
            observaciones=payload.observaciones.strip() if payload.observaciones else None,
            proximo_preventivo=proximo_preventivo,
        )
        return self.repository.create(equipment)

    def update_equipment(self, equipment_id: int, payload: EquipmentUpdate) -> Equipment:
        equipment = self.get_equipment(equipment_id)

        if payload.tipo is not None:
            self._validate_tipo(payload.tipo)

        if payload.serial and payload.serial.strip() != equipment.serial:
            existing = self.repository.get_by_serial(payload.serial.strip())
            if existing and existing.is_active:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='El serial ya está registrado')

        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(equipment, field, value.strip() if isinstance(value, str) else value)

        # Recalculate proximo_preventivo only when no real maintenance has taken over
        # (proximo_preventivo IS NOT NULL means it's still auto-managed)
        if self.config_repository and equipment.proximo_preventivo is not None:
            if payload.garantia_vence is not None or payload.fecha_compra is not None:
                equipment.proximo_preventivo = _calc_proximo_preventivo(
                    equipment.tipo,
                    equipment.garantia_vence,
                    equipment.fecha_compra,
                    equipment.created_at.date(),
                    self.config_repository,
                    self.tipo_repository,
                )

        equipment.updated_at = datetime.utcnow()
        return self.repository.update(equipment)

    def delete_equipment(self, equipment_id: int) -> None:
        equipment = self.get_equipment(equipment_id)
        self.repository.soft_delete(equipment)
