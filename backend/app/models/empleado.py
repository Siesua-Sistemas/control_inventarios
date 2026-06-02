from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.database import Base


class Empleado(Base):
    __tablename__ = 'empleados'

    id = Column(Integer, primary_key=True, index=True)
    nombres = Column(String(120), nullable=False)
    apellidos = Column(String(120), nullable=False)
    cedula = Column(String(20), unique=True, nullable=False, index=True)
    cargo = Column(String(100), nullable=True)
    departamento = Column(String(100), nullable=True)
    sede = Column(String(120), nullable=True)
    email = Column(String(160), nullable=True)
    telefono = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
