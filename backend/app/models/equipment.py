from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String  # noqa: F401
from sqlalchemy.orm import relationship

from app.database import Base


class Equipment(Base):
    __tablename__ = 'equipment'

    id = Column(Integer, primary_key=True, index=True)
    codigo_interno = Column(String(20), unique=True, nullable=False, index=True)
    serial = Column(String(100), unique=True, nullable=False, index=True)
    tipo = Column(String(80), nullable=False)
    marca = Column(String(80), nullable=False)
    modelo = Column(String(120), nullable=False)
    placa = Column(String(50), nullable=True)

    # Ubicación
    sede = Column(String(120), nullable=False)
    ubicacion = Column(String(120), nullable=True)

    # Estado
    estado = Column(String(50), nullable=False, default='Disponible')

    # Dominio de inventario (IT | Bioingeniería | General)
    dominio = Column(String(30), nullable=False, default='IT', server_default='IT')

    # Especificaciones técnicas (JSON dinámico por tipo)
    specs = Column(JSON, nullable=True)

    # Información financiera
    fecha_compra = Column(Date, nullable=True)
    valor = Column(Numeric(14, 2), nullable=True)
    proveedor = Column(String(160), nullable=True)
    numero_factura = Column(String(80), nullable=True)
    garantia_vence = Column(Date, nullable=True)
    proximo_preventivo = Column(Date, nullable=True)

    criticidad = Column(String(10), nullable=False, default='Media', server_default='Media')
    observaciones = Column(String(500), nullable=True)

    # Calibración / metrología
    fecha_calibracion = Column(Date, nullable=True)
    vencimiento_calibracion = Column(Date, nullable=True)
    frecuencia_calibracion_meses = Column(Integer, nullable=True)

    # Relaciones de ubicación
    bodega_id = Column(Integer, ForeignKey('bodegas.id'), nullable=True)
    empleado_id = Column(Integer, ForeignKey('empleados.id'), nullable=True)

    # Relación padre-periférico
    parent_equipment_id = Column(Integer, ForeignKey('equipment.id'), nullable=True)

    bodega = relationship('Bodega', lazy='selectin')
    empleado = relationship('Empleado', lazy='selectin')
    photos = relationship('EquipmentPhoto', back_populates='equipment', lazy='select')
    documentos = relationship('EquipmentDocumento', back_populates='equipment', lazy='select', order_by='EquipmentDocumento.created_at.desc()')

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    @property
    def empleado_nombre(self) -> str | None:
        if self.empleado:
            return f'{self.empleado.nombres} {self.empleado.apellidos}'
        return None
