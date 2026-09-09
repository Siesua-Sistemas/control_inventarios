from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from app.database import Base


class EmpleadoAgenda(Base):
    """Vincula un empleado con la Agenda (línea de servicio: ESTETICA, LASER,
    MEDICA, etc.) que cubre en una sede puntual — no existe esta relación en
    SIESUA, así que se administra aquí manualmente (Jornada → Admin → Agendas).

    `sede` y `agenda` son texto libre (igual que `RegistroJornada.sede`):
    deben escribirse tal como aparecen en el nombre de la sede y en la
    columna "Agenda" del reporte de ocupación de Looker Studio, para que el
    ETL pueda cruzarlos.
    """
    __tablename__ = 'empleado_agendas'
    __table_args__ = (UniqueConstraint('empleado_id', 'sede', name='uq_empleado_agenda_sede'),)

    id = Column(Integer, primary_key=True, index=True)
    empleado_id = Column(Integer, ForeignKey('empleados.id', ondelete='CASCADE'), nullable=False, index=True)
    sede = Column(String(120), nullable=False)
    agenda = Column(String(120), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
