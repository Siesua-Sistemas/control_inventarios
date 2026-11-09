from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String

from app.database import Base


class EnlaceAcceso(Base):
    """Enlace/QR de un solo uso para que una persona complete trámites (alta,
    cambio de contraseña, actualización de datos, ubicación Home Office).

    El token en claro solo se muestra una vez al crearlo; aquí se guarda su hash
    SHA-256, así un volcado de la BD no permite reconstruir enlaces vigentes.
    """
    __tablename__ = 'enlaces_acceso'

    id = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    cedula = Column(String(20), nullable=False, index=True)
    empleado_id = Column(Integer, ForeignKey('empleados.id', ondelete='SET NULL'), nullable=True)
    modulos = Column(JSON, nullable=False)                # subconjunto de MODULOS, en orden canónico
    pasos_completados = Column(JSON, nullable=False, default=list)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)             # se fija al completar todos los módulos
    revoked_at = Column(DateTime, nullable=True)
    intentos_fallidos = Column(Integer, nullable=False, default=0)
    bloqueado = Column(Boolean, nullable=False, default=False)
    created_by_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
