from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class ActaEntrega(Base):
    __tablename__ = 'actas_entrega'

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String(20), nullable=False)          # 'bodega' | 'asignacion'
    dominio = Column(String(30), nullable=False, default='IT', server_default='IT')
    sede = Column(String(120), nullable=False)
    titulo = Column(String(200), nullable=False)       # nombre bodega o empleado

    entrega_nombre = Column(String(160), nullable=False)
    recibe_nombre = Column(String(160), nullable=False)

    firma_entrega = Column(Text, nullable=True)        # base64 PNG
    firma_recibe = Column(Text, nullable=True)         # base64 PNG

    equipos_snapshot = Column(JSON, nullable=False)    # lista completa al momento del acta

    bodega_id = Column(Integer, ForeignKey('bodegas.id', ondelete='SET NULL'), nullable=True)
    empleado_id = Column(Integer, ForeignKey('empleados.id', ondelete='SET NULL'), nullable=True)
    observaciones = Column(String(500), nullable=True)

    fecha = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    bodega = relationship('Bodega', lazy='selectin')
    empleado = relationship('Empleado', lazy='selectin')
    created_by = relationship('User', lazy='selectin')
