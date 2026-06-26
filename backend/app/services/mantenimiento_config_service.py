from fastapi import HTTPException, status

from app.repositories.mantenimiento_config_repository import MantenimientoConfigRepository
from app.schemas.mantenimiento import MantenimientoConfigOut, MantenimientoConfigUpdate


class MantenimientoConfigService:
    def __init__(self, repo: MantenimientoConfigRepository):
        self.repo = repo

    def list_all(self) -> list[MantenimientoConfigOut]:
        return [MantenimientoConfigOut.model_validate(c) for c in self.repo.list_all()]

    def update(self, tipo_equipo: str, payload: MantenimientoConfigUpdate) -> MantenimientoConfigOut:
        config = self.repo.get_by_tipo(tipo_equipo)
        if not config:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Configuración no encontrada para este tipo')
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(config, field, value)
        return MantenimientoConfigOut.model_validate(self.repo.update(config))
