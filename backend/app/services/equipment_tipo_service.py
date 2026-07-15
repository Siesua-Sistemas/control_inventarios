from datetime import datetime

from fastapi import HTTPException, status

from app.models.equipment_tipo import EquipmentTipo
from app.repositories.equipment_tipo_repository import EquipmentTipoRepository
from app.schemas.equipment_tipo import EquipmentTipoCreate, EquipmentTipoOut, EquipmentTipoUpdate, SpecFieldSchema


def _spec_to_schema(spec) -> SpecFieldSchema:
    return SpecFieldSchema(
        key=spec.key, label=spec.label, type=spec.field_type,
        options=spec.options, min=spec.min_value, max=spec.max_value,
        placeholder=spec.placeholder,
    )


def _tipo_to_out(tipo: EquipmentTipo) -> EquipmentTipoOut:
    return EquipmentTipoOut(
        id=tipo.id, nombre=tipo.nombre, dominio=tipo.dominio,
        es_periferico=tipo.es_periferico, activo=tipo.activo, orden=tipo.orden,
        specs=[_spec_to_schema(s) for s in tipo.specs],
        created_at=tipo.created_at, updated_at=tipo.updated_at,
    )


class EquipmentTipoService:
    def __init__(self, repository: EquipmentTipoRepository):
        self.repository = repository

    def list_all(self, dominios_permitidos: list[str] | None = None) -> list[EquipmentTipoOut]:
        return [_tipo_to_out(t) for t in self.repository.list_all(dominios_permitidos)]

    def get_tipo(self, tipo_id: int) -> EquipmentTipo:
        tipo = self.repository.get_by_id(tipo_id)
        if not tipo:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tipo de equipo no encontrado')
        return tipo

    def create_tipo(self, payload: EquipmentTipoCreate) -> EquipmentTipoOut:
        if self.repository.get_by_nombre(payload.nombre.strip()):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Ya existe un tipo con ese nombre')
        tipo = EquipmentTipo(
            nombre=payload.nombre.strip(), dominio=payload.dominio,
            es_periferico=payload.es_periferico, activo=payload.activo, orden=payload.orden,
        )
        return _tipo_to_out(self.repository.create(tipo))

    def update_tipo(self, tipo_id: int, payload: EquipmentTipoUpdate) -> EquipmentTipoOut:
        tipo = self.get_tipo(tipo_id)
        if payload.nombre and payload.nombre.strip() != tipo.nombre:
            existing = self.repository.get_by_nombre(payload.nombre.strip())
            if existing and existing.id != tipo_id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Ya existe un tipo con ese nombre')
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(tipo, field, value.strip() if isinstance(value, str) else value)
        tipo.updated_at = datetime.utcnow()
        return _tipo_to_out(self.repository.update(tipo))

    def update_specs(self, tipo_id: int, specs: list[SpecFieldSchema]) -> EquipmentTipoOut:
        tipo = self.get_tipo(tipo_id)
        specs_dicts = [s.model_dump(exclude_none=False) for s in specs]
        return _tipo_to_out(self.repository.replace_specs(tipo, specs_dicts))

    def tipo_exists(self, nombre: str) -> bool:
        return self.repository.get_by_nombre(nombre) is not None

    def get_specs_template(self, nombre: str) -> list[dict]:
        tipo = self.repository.get_by_nombre(nombre)
        if not tipo:
            return []
        return [s.model_dump(exclude_none=True) for s in (_spec_to_schema(s) for s in tipo.specs)]
