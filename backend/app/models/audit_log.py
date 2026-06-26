from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.database import Base


class AuditLog(Base):
    __tablename__ = 'audit_logs'

    id            = Column(Integer, primary_key=True, index=True)
    timestamp     = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    tipo_acceso   = Column(String(20), nullable=False)   # sistema | colaborador | wifi_password
    identificador = Column(String(200), nullable=True)   # email o cédula
    ip_address    = Column(String(50), nullable=True)
    user_agent    = Column(String(500), nullable=True)
    resultado     = Column(String(20), nullable=False)   # exitoso | fallido
    detalle       = Column(String(300), nullable=True)
    user_id       = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
