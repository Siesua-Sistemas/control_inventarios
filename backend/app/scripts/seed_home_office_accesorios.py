"""Seed adicional: agrega accesorios a los portátiles de Home Office.

Cada portátil de Home Office (creado por seed_demo_estetica) recibe:
  - 1 cargador
  - 1 mouse inalámbrico
  - 1 monitor adicional (solo para algunos cargos: Contabilidad, Sistemas, Gerencia)

Todos quedan vinculados como periférico (parent_equipment_id) del portátil,
asignados al mismo empleado.

Ejecutar dentro del contenedor backend:
    docker exec inventario-backend python -m app.scripts.seed_home_office_accesorios
"""
import random

from app.database import SessionLocal
from app.models.empleado import Empleado
from app.models.equipment import Equipment
from app.models.equipment_photo import EquipmentPhoto  # noqa: F401 (registra la relación Equipment.photos)
from app.models.user import User  # noqa: F401 (registra las relaciones *.created_by)
from app.scripts.seed_demo_estetica import Ctx, crea_asignacion, random_fecha_pasada

random.seed(20260612)

CARGADORES = [('HP', 65), ('DELL', 65), ('LENOVO', 65), ('ASUS', 65)]
MOUSES = [('LOGITECH', 'M170'), ('LOGITECH', 'M185'), ('GENIUS', 'DX-110'), ('HP', '150')]
MONITORES = [
    ('SAMSUNG', '22" F22T350', '21.5'),
    ('LG', '22MK400H', '21.5'),
    ('AOC', '22B2H', '21.5'),
    ('HP', 'V22ve G5', '21.5'),
]

# Cargos de Home Office que además reciben un monitor adicional.
CARGOS_CON_MONITOR = {'Contador/a', 'Desarrollador/a de Software', 'Gerente Administrativo'}


def make_accesorio(ctx: Ctx, prefijo: str, tipo: str, marca: str, modelo: str, specs: dict,
                    valor: int, parent: Equipment, empleado: Empleado) -> Equipment:
    eq = Equipment(
        codigo_interno=ctx.codigo(),
        serial=ctx.serial(prefijo),
        tipo=tipo, marca=marca, modelo=modelo,
        sede='HOME OFFICE', ubicacion=parent.ubicacion,
        estado='Asignado',
        specs=specs,
        fecha_compra=parent.fecha_compra,
        valor=valor,
        proveedor=parent.proveedor,
        numero_factura=parent.numero_factura,
        garantia_vence=parent.garantia_vence,
        bodega_id=None,
        empleado_id=empleado.id,
        parent_equipment_id=parent.id,
    )
    ctx.db.add(eq)
    ctx.db.flush()
    ctx.stats['equipos'] += 1
    return eq


def main() -> None:
    db = SessionLocal()
    try:
        laptops = (
            db.query(Equipment)
            .filter(Equipment.sede == 'HOME OFFICE', Equipment.tipo == 'Portátil', Equipment.is_active.is_(True))
            .all()
        )

        laptop_ids = [lt.id for lt in laptops]
        existing = (
            db.query(Equipment).filter(Equipment.parent_equipment_id.in_(laptop_ids)).first()
            if laptop_ids else None
        )
        if existing:
            print('El seed de accesorios de Home Office ya parece haberse ejecutado. No se hicieron cambios.')
            return

        ctx = Ctx(db)

        for laptop in laptops:
            empleado = db.get(Empleado, laptop.empleado_id)
            if not empleado:
                continue

            fecha = random_fecha_pasada()
            obs = f'Periférico de {laptop.codigo_interno}'

            marca_carg, watts = random.choice(CARGADORES)
            cargador = make_accesorio(
                ctx, 'CARG', 'Accesorio', marca_carg, f'Cargador {watts}W',
                {'descripcion_tecnica': f'Cargador original {watts}W', 'tipo_conexion': 'USB-C',
                 'potencia_w': watts, 'estado_general': random.choice([4, 5])},
                random.randint(60_000, 110_000), laptop, empleado,
            )
            crea_asignacion(ctx, cargador, empleado, None, fecha, 'Asignado', obs)

            marca_mouse, modelo_mouse = random.choice(MOUSES)
            mouse = make_accesorio(
                ctx, 'ACC', 'Accesorio', marca_mouse, modelo_mouse,
                {'descripcion_tecnica': 'Mouse inalámbrico', 'tipo_conexion': 'USB inalámbrico (dongle)',
                 'estado_general': random.choice([4, 5])},
                random.randint(35_000, 80_000), laptop, empleado,
            )
            crea_asignacion(ctx, mouse, empleado, None, fecha, 'Asignado', obs)

            if empleado.cargo in CARGOS_CON_MONITOR:
                marca_mon, modelo_mon, pulgadas = random.choice(MONITORES)
                monitor = make_accesorio(
                    ctx, 'MON', 'Monitor', marca_mon, modelo_mon,
                    {'pantalla_pulgadas': pulgadas, 'resolucion': 'Full HD 1920×1080',
                     'tipo_panel': random.choice(['IPS', 'VA']), 'tasa_refresco_hz': 75,
                     'conexiones': 'HDMI, VGA', 'estado_general': random.choice([4, 5])},
                    random.randint(450_000, 750_000), laptop, empleado,
                )
                crea_asignacion(ctx, monitor, empleado, None, fecha, 'Asignado', obs)

        db.commit()
        print('Seed de accesorios Home Office completado:')
        for key, value in ctx.stats.items():
            print(f'  {key}: {value}')
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == '__main__':
    main()
