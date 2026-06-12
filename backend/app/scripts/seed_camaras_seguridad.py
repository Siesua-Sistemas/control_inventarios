"""Seed adicional: agrega cámaras de seguridad (CCTV) a cada sede.

Las sedes de alto volumen (CENTRO MAYOR, UNICENTRO) reciben 3 cámaras;
el resto de sedes recibe 1 cámara. Quedan asignadas a la asesora líder
de cada sede como responsable del equipo instalado.

Ejecutar dentro del contenedor backend:
    docker exec inventario-backend python -m app.scripts.seed_camaras_seguridad
"""
import random

from app.database import SessionLocal
from app.models.bodega import Bodega
from app.models.equipment import Equipment
from app.models.equipment_photo import EquipmentPhoto  # noqa: F401 (registra la relación Equipment.photos)
from app.models.user import User  # noqa: F401 (registra las relaciones *.created_by)
from app.scripts.seed_demo_estetica import (
    SEDES, VALORES, Ctx, crea_asignacion, get_or_create_asesora, make_equipment, random_fecha_pasada,
)

random.seed(20260613)

VALORES.setdefault('Cámara', (180_000, 450_000))

CAMARAS = [
    ('HIKVISION', 'DS-2CE16D0T-EXIPF'), ('DAHUA', 'HAC-T1A21'),
    ('TP-LINK', 'Tapo C310'), ('EZVIZ', 'C3W'),
]

UBICACIONES_3 = ['Entrada Principal', 'Recepción', 'Sala General']
UBICACIONES_1 = ['Entrada Principal']


def specs_camara() -> dict:
    return {
        'tipo_camara': 'IP/CCTV',
        'resolucion_mp': random.choice(['2MP (1080p)', '4MP', '5MP']),
        'tipo_conexion': random.choice(['PoE', 'WiFi']),
        'estado_general': random.choice([4, 5]),
    }


def main() -> None:
    db = SessionLocal()
    try:
        existing = db.query(Equipment).filter(Equipment.tipo == 'Cámara', Equipment.serial.like('CAM%')).first()
        if existing:
            print('El seed de cámaras de seguridad ya parece haberse ejecutado. No se hicieron cambios.')
            return

        ctx = Ctx(db)

        for cfg in SEDES:
            bodega = db.query(Bodega).filter(Bodega.nombre == cfg['nombre']).first()
            asesora = get_or_create_asesora(ctx, cfg)

            ubicaciones = UBICACIONES_3 if cfg['alto_volumen'] else UBICACIONES_1
            for ubicacion in ubicaciones:
                marca, modelo = random.choice(CAMARAS)
                item = {
                    'tipo': 'Cámara', 'marca': marca, 'modelo': modelo,
                    'ubicacion': f'CCTV - {ubicacion}', 'serial_prefix': 'CAM',
                    'specs': specs_camara(), 'estado': 'Asignado',
                }
                eq = make_equipment(ctx, item, cfg['nombre'], None, asesora.id)
                fecha = random_fecha_pasada()
                crea_asignacion(ctx, eq, asesora, bodega, fecha, 'Asignado', 'Cámara de seguridad instalada en sede')

        db.commit()
        print('Seed de cámaras de seguridad completado:')
        for key, value in ctx.stats.items():
            print(f'  {key}: {value}')
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == '__main__':
    main()
