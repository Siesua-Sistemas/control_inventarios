from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.equipment import Equipment
from app.repositories.equipment_repository import EquipmentRepository
from app.schemas.equipment import EquipmentCreate, EquipmentUpdate


class EquipmentService:
    def __init__(self, repository: EquipmentRepository):
        self.repository = repository

    def list_equipment(
        self,
        search: str | None,
        tipo: str | None,
        sede: str | None,
        estado: str | None,
    ) -> list[Equipment]:
        return self.repository.list_equipment(search, tipo, sede, estado)

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
        existing = self.repository.get_by_serial(payload.serial)
        if existing and existing.is_active:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='El serial ya está registrado')

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
            fecha_compra=payload.fecha_compra,
            valor=payload.valor,
            proveedor=payload.proveedor.strip() if payload.proveedor else None,
            numero_factura=payload.numero_factura.strip() if payload.numero_factura else None,
            garantia_vence=payload.garantia_vence,
            observaciones=payload.observaciones.strip() if payload.observaciones else None,
        )
        return self.repository.create(equipment)

    def update_equipment(self, equipment_id: int, payload: EquipmentUpdate) -> Equipment:
        equipment = self.get_equipment(equipment_id)

        if payload.serial and payload.serial.strip() != equipment.serial:
            existing = self.repository.get_by_serial(payload.serial.strip())
            if existing and existing.is_active:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='El serial ya está registrado')

        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(equipment, field, value.strip() if isinstance(value, str) else value)

        equipment.updated_at = datetime.utcnow()
        return self.repository.update(equipment)

    def delete_equipment(self, equipment_id: int) -> None:
        equipment = self.get_equipment(equipment_id)
        self.repository.soft_delete(equipment)
