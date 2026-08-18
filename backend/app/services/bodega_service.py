from datetime import datetime

from fastapi import HTTPException, status

from app.models.bodega import Bodega
from app.repositories.bodega_repository import BodegaRepository
from app.schemas.bodega import BodegaCreate, BodegaOut, BodegaUpdate


class BodegaService:
    def __init__(self, repository: BodegaRepository):
        self.repository = repository

    def list_bodegas(
        self,
        sede: str | None,
        dominios_permitidos: list[str] | None = None,
    ) -> list[BodegaOut]:
        bodegas = self.repository.list_bodegas(sede, dominios_permitidos)
        return [
            BodegaOut(
                **{k: getattr(b, k) for k in ('id', 'nombre', 'sede', 'responsable', 'descripcion', 'dominio', 'is_active', 'created_at')},
                total_equipos=self.repository.count_equipos(b.id, dominios_permitidos),
            )
            for b in bodegas
        ]

    def get_bodega(self, bodega_id: int) -> Bodega:
        bodega = self.repository.get_by_id(bodega_id)
        if not bodega:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Bodega no encontrada')
        return bodega

    def get_inventario(self, bodega_id: int, dominios_permitidos: list[str] | None = None) -> dict:
        bodega = self.get_bodega(bodega_id)
        equipos = self.repository.get_equipos(bodega_id, dominios_permitidos)
        por_tipo: dict[str, int] = {}
        por_estado: dict[str, int] = {}
        for e in equipos:
            por_tipo[e.tipo] = por_tipo.get(e.tipo, 0) + 1
            por_estado[e.estado] = por_estado.get(e.estado, 0) + 1
        return {
            'bodega': BodegaOut(
                **{k: getattr(bodega, k) for k in ('id', 'nombre', 'sede', 'responsable', 'descripcion', 'dominio', 'is_active', 'created_at')},
                total_equipos=len(equipos),
            ),
            'total': len(equipos),
            'por_tipo': por_tipo,
            'por_estado': por_estado,
            'equipos': equipos,
        }

    def create_bodega(self, payload: BodegaCreate) -> Bodega:
        bodega = Bodega(
            nombre=payload.nombre.strip(),
            sede=payload.sede.strip(),
            responsable=payload.responsable.strip() if payload.responsable else None,
            descripcion=payload.descripcion.strip() if payload.descripcion else None,
            dominio=payload.dominio,
        )
        return self.repository.create(bodega)

    def update_bodega(self, bodega_id: int, payload: BodegaUpdate) -> Bodega:
        bodega = self.get_bodega(bodega_id)
        nueva_sede = payload.sede.strip() if payload.sede is not None else None
        sede_cambio = nueva_sede is not None and nueva_sede != bodega.sede
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(bodega, field, value.strip() if isinstance(value, str) else value)
        bodega.updated_at = datetime.utcnow()
        actualizada = self.repository.update(bodega)
        if sede_cambio:
            # Propaga el nuevo nombre de sede a los equipos ya enlazados a esta
            # bodega, para que el texto libre `equipment.sede` no quede desfasado.
            from app.models.equipment import Equipment
            self.repository.db.query(Equipment).filter(
                Equipment.bodega_id == bodega_id
            ).update({Equipment.sede: actualizada.sede})
            self.repository.db.commit()
        return actualizada

    def delete_bodega(self, bodega_id: int) -> None:
        bodega = self.get_bodega(bodega_id)
        self.repository.soft_delete(bodega)
