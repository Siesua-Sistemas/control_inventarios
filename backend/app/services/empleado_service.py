from datetime import datetime

from fastapi import HTTPException, status

from app.models.empleado import Empleado
from app.repositories.empleado_repository import EmpleadoRepository
from app.schemas.empleado import EmpleadoCreate, EmpleadoOut, EmpleadoUpdate


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
        nombre_completo=f'{emp.nombres} {emp.apellidos}',
        is_active=emp.is_active,
        created_at=emp.created_at,
    )


class EmpleadoService:
    def __init__(self, repository: EmpleadoRepository):
        self.repository = repository

    def list_empleados(self, search: str | None, sede: str | None) -> list[EmpleadoOut]:
        return [_to_out(e) for e in self.repository.list_empleados(search, sede)]

    def get_empleado(self, empleado_id: int) -> Empleado:
        emp = self.repository.get_by_id(empleado_id)
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
        )
        return _to_out(self.repository.create(emp))

    def update_empleado(self, empleado_id: int, payload: EmpleadoUpdate) -> EmpleadoOut:
        emp = self.get_empleado(empleado_id)
        if payload.cedula and payload.cedula.strip() != emp.cedula:
            existing = self.repository.get_by_cedula(payload.cedula.strip())
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='La cédula ya está registrada')
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(emp, field, value.strip() if isinstance(value, str) else value)
        emp.updated_at = datetime.utcnow()
        return _to_out(self.repository.update(emp))

    def delete_empleado(self, empleado_id: int) -> None:
        emp = self.get_empleado(empleado_id)
        self.repository.soft_delete(emp)
