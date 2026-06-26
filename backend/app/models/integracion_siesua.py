from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint

from app.database import Base


class SiesuaMapping(Base):
    """
    Tabla de mapeo entre IDs externos de SIESUA (MySQL) e IDs internos (PostgreSQL).
    Es el único punto de acoplamiento: los modelos core no saben nada de SIESUA.
    Para desconectar la integración: truncar esta tabla y desactivar el router.
    """
    __tablename__ = 'integracion_siesua_mapping'

    id = Column(Integer, primary_key=True)
    tipo = Column(String(20), nullable=False)      # 'sede' | 'empleado'
    ext_id = Column(String(50), nullable=False)    # ID en MySQL de SIESUA (como string)
    internal_id = Column(Integer, nullable=False)  # ID en nuestra PostgreSQL
    synced_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('tipo', 'ext_id', name='uq_siesua_tipo_ext_id'),
    )
