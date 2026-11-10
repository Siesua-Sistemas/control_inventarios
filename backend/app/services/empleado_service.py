from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select

from app.models.empleado import Empleado
from app.models.sede_jornada import SedeJornada
from app.repositories.empleado_repository import EmpleadoRepository
from app.schemas.empleado import EmpleadoCreate, EmpleadoOut, EmpleadoUpdate, EquipoAsignadoOut

_JORNADA_FIELDS = {'en_jornada', 'sedes_jornada_ids'}


def _to_out(emp: Empleado) -> EmpleadoOut:
    return EmpleadoOut(
        id=emp.id,
        nombres=emp.nombres,
        apellidos=emp.apellidos,
        cedula=emp.cedula,
        cargo=emp.cargo,
        departamento=emp.departamento,
        sede=emp.sede,
        email=emp.email,
        telefono=emp.telefono,
        en_jornada=emp.en_jornada,
        sedes_jornada_ids=[s.id for s in (emp.sedes_jornada or [])],
        nombre_completo=f'{emp.nombres} {emp.apellidos}',
        is_active=emp.is_active,
        created_at=emp.created_at,
    )


class EmpleadoService:
    def __init__(self, repository: EmpleadoRepository):
        self.repository = repository

    def _set_sedes(self, emp: Empleado, sede_ids: list[int]) -> None:
        sedes = list(self.repository.db.scalars(
            select(SedeJornada).where(
                SedeJornada.id.in_(sede_ids),
                SedeJornada.is_active.is_(True),
            )
        ).all())
        emp.sedes_jornada = sedes

    def list_empleados(
        self,
        search: str | None,
        sede: str | None,
        skip: int = 0,
        limit: int | None = None,
        include_inactive: bool = False,
    ) -> tuple[list[EmpleadoOut], int]:
        items, total = self.repository.list_empleados(search, sede, skip, limit, include_inactive)
        return [_to_out(e) for e in items], total

    def get_empleado(self, empleado_id: int, include_inactive: bool = False) -> Empleado:
        emp = self.repository.get_by_id(empleado_id, include_inactive)
        if not emp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Empleado no encontrado')
        return emp

    def create_empleado(self, payload: EmpleadoCreate) -> EmpleadoOut:
        existing = self.repository.get_by_cedula(payload.cedula.strip())
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='La cédula ya está registrada')
        emp = Empleado(
            nombres=payload.nombres.strip(),
            apellidos=payload.apellidos.strip(),
            cedula=payload.cedula.strip(),
            cargo=payload.cargo.strip() if payload.cargo else None,
            departamento=payload.departamento.strip() if payload.departamento else None,
            sede=payload.sede.strip() if payload.sede else None,
            email=payload.email.strip() if payload.email else None,
            telefono=payload.telefono.strip() if payload.telefono else None,
            en_jornada=payload.en_jornada,
        )
        created = self.repository.create(emp)
        if payload.sedes_jornada_ids:
            self._set_sedes(created, payload.sedes_jornada_ids)
            self.repository.db.commit()
            self.repository.db.refresh(created)
        return _to_out(created)

    def update_empleado(self, empleado_id: int, payload: EmpleadoUpdate) -> EmpleadoOut:
        emp = self.get_empleado(empleado_id)
        if payload.cedula and payload.cedula.strip() != emp.cedula:
            existing = self.repository.get_by_cedula(payload.cedula.strip())
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='La cédula ya está registrada')

        # Scalar fields
        for field, value in payload.model_dump(exclude_none=True, exclude=_JORNADA_FIELDS).items():
            setattr(emp, field, value.strip() if isinstance(value, str) else value)

        # Jornada toggle
        if payload.en_jornada is not None:
            emp.en_jornada = payload.en_jornada

        # Multi-sede assignment
        if payload.sedes_jornada_ids is not None:
            self._set_sedes(emp, payload.sedes_jornada_ids)

        emp.updated_at = datetime.utcnow()
        return _to_out(self.repository.update(emp))

    def toggle_estado(self, empleado_id: int, is_active: bool) -> EmpleadoOut:
        emp = self.get_empleado(empleado_id, include_inactive=True)
        updated = self.repository.set_estado(emp, is_active)
        return _to_out(updated)

    def get_equipos_actuales(self, empleado_id: int) -> list[EquipoAsignadoOut]:
        self.get_empleado(empleado_id, include_inactive=True)
        equipos = self.repository.get_equipos_actuales(empleado_id)
        return [
            EquipoAsignadoOut(
                id=e.id,
                nombre=f"{e.tipo} {e.marca} {e.modelo}".strip(),
                serial=e.serial,
                tipo=e.tipo,
                estado=e.estado,
            )
            for e in equipos
        ]

    def delete_empleado(self, empleado_id: int) -> None:
        emp = self.get_empleado(empleado_id)
        self.repository.soft_delete(emp)
