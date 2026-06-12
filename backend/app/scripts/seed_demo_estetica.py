"""Seed de datos de prueba: 7 sedes tipo "centro de estética" + Home Office.

Cada centro de estética tiene un kit básico de equipos:
  - 2 computadores de recepción
  - 1 PC para el médico estético
  - 1 Tablet de estética
  - 1 celular de llamadas
  - 1 impresora
  - 1 sistema de sonido (bafle)
  - 1 diadema

Las sedes de mayor volumen duplican cantidades (no agregan tipos nuevos).
Los Home Office reciben solo un portátil por empleado.

Ejecutar dentro del contenedor backend:
    docker exec inventario-backend python -m app.scripts.seed_demo_estetica
"""
import random
import unicodedata
from datetime import date, datetime, timedelta

from app.database import SessionLocal
from app.models.acta_entrega import ActaEntrega
from app.models.asignacion import TIPO_ENTREGA, Asignacion
from app.models.bodega import Bodega
from app.models.empleado import Empleado
from app.models.equipment import Equipment
from app.models.equipment_photo import EquipmentPhoto  # noqa: F401 (registra la relación Equipment.photos)
from app.models.mantenimiento import Mantenimiento
from app.models.user import User  # noqa: F401 (registra las relaciones *.created_by)

random.seed(20260611)

ADMIN_ID = 1  # Administrador del Sistema (sistemas@siesua.com)
HOY = date(2026, 6, 11)

# ---------------------------------------------------------------------------
# Catálogos
# ---------------------------------------------------------------------------

NOMBRES_F = [
    'ANDREA', 'CAROLINA', 'NATALIA', 'JULIANA', 'TATIANA', 'LINA', 'SARA', 'MELISSA',
    'KAREN', 'YULIANA', 'ANGIE', 'DAYANA', 'GERALDINE', 'STEFANY', 'PAOLA', 'CATALINA',
    'VANESSA', 'LORENA', 'MONICA', 'DIANA',
]
NOMBRES_M = [
    'JUAN', 'CARLOS', 'ANDRES', 'SEBASTIAN', 'DAVID', 'FELIPE', 'SANTIAGO', 'NICOLAS',
    'CAMILO', 'JORGE', 'DIEGO', 'MIGUEL', 'ALEJANDRO', 'RICARDO', 'OSCAR',
]
APELLIDOS = [
    'GOMEZ', 'RODRIGUEZ', 'MARTINEZ', 'HERNANDEZ', 'LOPEZ', 'GONZALEZ', 'PEREZ', 'SANCHEZ',
    'RAMIREZ', 'TORRES', 'FLOREZ', 'VARGAS', 'CASTRO', 'ORTIZ', 'RUIZ', 'MORENO', 'MUÑOZ',
    'ALVAREZ', 'ROMERO', 'SUAREZ', 'CONTRERAS', 'RIVERA', 'MEDINA', 'AGUILAR', 'CASTAÑEDA',
]

PORTATILES = [
    ('HP', 'ProBook 440 G9'), ('HP', '240 G8'), ('LENOVO', 'ThinkPad E14'),
    ('LENOVO', 'V15 G2'), ('DELL', 'Inspiron 15 3520'), ('ASUS', 'VivoBook 15 X1502'),
    ('ACER', 'Aspire 5 A515-56'), ('HP', '15-dy2021nr'),
]
TABLETS = [
    ('SAMSUNG', 'Galaxy Tab A8'), ('SAMSUNG', 'Galaxy Tab A9+'),
    ('LENOVO', 'Tab M10 HD'), ('HUAWEI', 'MatePad T10'),
]
CELULARES = [
    ('MOTOROLA', 'Moto G23'), ('SAMSUNG', 'Galaxy A14'), ('XIAOMI', 'Redmi 12C'), ('MOTOROLA', 'Moto G54'),
]
IMPRESORAS = [
    ('EPSON', 'L3250'), ('EPSON', 'L4260'), ('HP', 'Smart Tank 581'), ('CANON', 'Pixma G3160'),
]
BAFLES = [
    ('JBL', 'PartyBox 110'), ('JBL', 'Charge 5'), ('SONY', 'SRS-XB23'), ('LG', 'XBOOM XL5'),
]
DIADEMAS = [
    ('LOGITECH', 'H390'), ('JBL', 'Quantum 100'), ('HP', 'Stereo Headset G2'), ('REDRAGON', 'Zeus H510'),
]

PROVEEDORES = [
    'CT Internacional', 'PCCOM S.A.S', 'Alkosto Mayorista', 'Distrielectronicos del Caribe', 'MacroTech Distribuciones',
]

VALORES = {
    'Portátil': (1_800_000, 3_200_000),
    'Tablet': (550_000, 950_000),
    'Celular': (500_000, 850_000),
    'Impresora': (450_000, 950_000),
    'Accesorio': (250_000, 650_000),
    'Audífonos': (60_000, 180_000),
}

SEDES = [
    {'nombre': 'CENTRO MAYOR', 'responsable': 'PAULA DUARTE', 'alto_volumen': True,
     'descripcion': 'Centro de estética - Centro Comercial Centro Mayor, Bogotá'},
    {'nombre': 'UNICENTRO', 'responsable': 'DIANA RAMIREZ', 'alto_volumen': True,
     'descripcion': 'Centro de estética - Centro Comercial Unicentro, Bogotá'},
    {'nombre': 'GRAN ESTACION', 'responsable': 'CAMILA ROJAS', 'alto_volumen': False,
     'descripcion': 'Centro de estética - Centro Comercial Gran Estación, Bogotá'},
    {'nombre': 'TITAN PLAZA', 'responsable': 'LAURA GOMEZ', 'alto_volumen': False,
     'descripcion': 'Centro de estética - Centro Comercial Titán Plaza, Bogotá'},
    {'nombre': 'HAYUELOS', 'responsable': 'VALENTINA CASTRO', 'alto_volumen': False,
     'descripcion': 'Centro de estética - Centro Comercial Hayuelos, Bogotá'},
    {'nombre': 'SALITRE PLAZA', 'responsable': 'MARIANA LOPEZ', 'alto_volumen': False,
     'descripcion': 'Centro de estética - Centro Comercial Salitre Plaza, Bogotá'},
    {'nombre': 'SANTAFE MEDELLIN', 'responsable': 'DANIELA HENAO', 'alto_volumen': False,
     'descripcion': 'Centro de estética - Centro Comercial Santafé, Medellín'},
]

HOME_OFFICE_ROLES = [
    ('Contador/a', 'CONTABILIDAD', 'F'),
    ('Auxiliar Contable', 'CONTABILIDAD', 'F'),
    ('Community Manager', 'MERCADEO', 'F'),
    ('Asesora Comercial Externa', 'COMERCIAL', 'F'),
    ('Desarrollador/a de Software', 'SISTEMAS', 'M'),
    ('Gerente Administrativo', 'GERENCIA', 'M'),
]

# Ajustes puntuales por sede (índice dentro de la lista de items del kit).
OVERRIDES: dict[str, dict[int, dict]] = {
    'CENTRO MAYOR': {
        13: {
            'estado': 'Perdido', 'empleado': None,
            'observaciones': 'Reportada como extraviada por la asesora líder. Pendiente de investigación e informe a seguros.',
        },
        0: {
            'mantenimiento': {
                'tipo': 'Preventivo',
                'fecha': datetime.combine(HOY - timedelta(days=200), datetime.min.time()),
                'tecnico': 'Michael Torres',
                'descripcion': 'Mantenimiento preventivo: limpieza interna, actualización de software y revisión de batería',
                'costo': 70000,
                'proximo_mantenimiento': HOY - timedelta(days=15),
            },
        },
    },
    'UNICENTRO': {
        0: {'garantia_corta': True},
    },
    'GRAN ESTACION': {
        3: {
            'estado': 'Dañado', 'empleado': None,
            'observaciones': 'Pantalla agrietada, pendiente de cotización de repuesto',
            'mantenimiento': {
                'tipo': 'Correctivo',
                'fecha': datetime.combine(HOY - timedelta(days=5), datetime.min.time()),
                'tecnico': 'Soporte Externo - PCCOM',
                'descripcion': 'Diagnóstico de pantalla agrietada en tablet de estética, se cotiza cambio de panel',
                'costo': 180000,
            },
        },
    },
    'TITAN PLAZA': {
        1: {
            'estado': 'En mantenimiento', 'empleado': None,
            'mantenimiento': {
                'tipo': 'Preventivo',
                'fecha': datetime.combine(HOY - timedelta(days=2), datetime.min.time()),
                'tecnico': 'Michael Torres',
                'descripcion': 'Limpieza interna, cambio de pasta térmica y actualización de Windows 11',
                'costo': 85000,
                'proximo_mantenimiento': HOY + timedelta(days=180),
            },
        },
    },
    'HAYUELOS': {
        4: {
            'estado': 'Prestado',
            'asignacion_obs': 'Préstamo temporal mientras se repara el equipo principal de Recepción',
        },
    },
    'SALITRE PLAZA': {
        2: {
            'estado': 'Disponible', 'empleado': None,
            'observaciones': 'Equipo nuevo en bodega, pendiente de asignación al profesional de turno',
        },
    },
    'SANTAFE MEDELLIN': {
        7: {
            'estado': 'Dado de baja', 'empleado': None,
            'observaciones': 'Diadema dada de baja por daño irreparable en almohadillas y cable de audio',
        },
    },
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def strip_accents(value: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', value) if unicodedata.category(c) != 'Mn')


class Ctx:
    def __init__(self, db):
        self.db = db
        last = db.query(Equipment).order_by(Equipment.id.desc()).first()
        self.next_codigo_num = int(last.codigo_interno.split('-')[1]) + 1 if last else 1
        self.used_serials = {row[0] for row in db.query(Equipment.serial).all()}
        self.used_emails = {row[0] for row in db.query(Empleado.email).all() if row[0]}
        self.used_names: set[tuple[str, str]] = set()
        self.next_cedula_num = 1_020_000_001
        self.stats = {'bodegas': 0, 'empleados': 0, 'equipos': 0, 'asignaciones': 0, 'actas': 0, 'mantenimientos': 0}

    def codigo(self) -> str:
        codigo = f'EQ-{self.next_codigo_num:05d}'
        self.next_codigo_num += 1
        return codigo

    def serial(self, prefix: str) -> str:
        while True:
            candidate = f"{prefix}{random.randint(10000, 99999)}{random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')}"
            if candidate not in self.used_serials:
                self.used_serials.add(candidate)
                return candidate

    def cedula(self) -> str:
        cedula = str(self.next_cedula_num)
        self.next_cedula_num += 1
        return cedula

    def email(self, nombres: str, apellidos: str) -> str:
        base = f"{strip_accents(nombres.split()[0]).lower()}.{strip_accents(apellidos.split()[0]).lower()}"
        candidate = f"{base}@siesua.com"
        n = 1
        while candidate in self.used_emails:
            n += 1
            candidate = f"{base}{n}@siesua.com"
        self.used_emails.add(candidate)
        return candidate

    def random_name(self, genero: str | None = 'F') -> tuple[str, str]:
        pool = NOMBRES_F if genero == 'F' else NOMBRES_M if genero == 'M' else NOMBRES_F + NOMBRES_M
        while True:
            nombres = random.choice(pool)
            apellidos = f'{random.choice(APELLIDOS)} {random.choice(APELLIDOS)}'
            key = (nombres, apellidos)
            if key not in self.used_names:
                self.used_names.add(key)
                return nombres, apellidos


def random_fecha_pasada() -> datetime:
    dias = random.randint(1, 90)
    fecha = HOY - timedelta(days=dias)
    return datetime(fecha.year, fecha.month, fecha.day, random.randint(8, 17), random.randint(0, 59))


# ---------------------------------------------------------------------------
# Specs por tipo (subset de SPECS_BY_TIPO con valores realistas)
# ---------------------------------------------------------------------------

def specs_portatil() -> dict:
    return {
        'pantalla_pulgadas': random.choice(['14', '15.6']),
        'cpu': random.choice(['Intel Core i3-1115G4', 'Intel Core i5-1135G7', 'AMD Ryzen 5 5500U', 'Intel Core i5-1235U']),
        'ram_gb': random.choice([8, 16]),
        'almacenamiento_gb': random.choice([256, 512]),
        'tipo_almacenamiento': 'SSD',
        'sistema_operativo': 'Windows 11 Pro',
        'bateria_estado': random.choice(['Bueno', 'Bueno', 'Regular']),
        'estado_general': random.choice([3, 4, 4, 5]),
    }


def specs_tablet() -> dict:
    return {
        'pantalla_pulgadas': random.choice(['10.1', '10.4', '11']),
        'imei1': gen_imei(),
        'tiene_esim': False,
        'cpu': random.choice(['MediaTek Helio P22T', 'Snapdragon 680', 'Unisoc T618']),
        'ram_gb': random.choice([4, 6]),
        'almacenamiento_gb': random.choice([64, 128]),
        'sistema_operativo': 'Android',
        'estado_general': random.choice([3, 4, 4, 5]),
    }


def specs_celular() -> dict:
    return {
        'imei1': gen_imei(),
        'imei2': gen_imei(),
        'tiene_esim': False,
        'cpu': random.choice(['Snapdragon 680', 'Helio G85', 'Exynos 850', 'Snapdragon 4 Gen 2']),
        'ram_gb': random.choice([4, 6, 8]),
        'almacenamiento_gb': random.choice([64, 128]),
        'sistema_operativo': 'Android',
        'estado_general': random.choice([3, 4, 5]),
    }


def specs_impresora() -> dict:
    return {
        'tipo_conexion': random.choice(['USB + WiFi', 'WiFi', 'USB']),
        'tipo_impresion': random.choice(['Sistema continuo (CISS)', 'Inyección de tinta']),
        'imprime_color': True,
        'duplex': random.choice([True, False]),
        'formato_maximo': 'Carta',
        'estado_general': random.choice([3, 4, 5]),
    }


def specs_bafle() -> dict:
    return {
        'descripcion_tecnica': 'Sistema de sonido para ambientación de sala y recepción',
        'tipo_conexion': 'Bluetooth',
        'estado_general': random.choice([4, 5]),
    }


def specs_diadema() -> dict:
    return {
        'tipo_conexion': random.choice(['3.5mm', 'USB', 'Bluetooth']),
        'con_microfono': True,
        'cancelacion_ruido': random.choice([True, False]),
        'estado_general': random.choice([3, 4, 5]),
    }


def gen_imei() -> str:
    return ''.join(str(random.randint(0, 9)) for _ in range(15))


# ---------------------------------------------------------------------------
# Creación de entidades
# ---------------------------------------------------------------------------

def get_or_create_bodega(ctx: Ctx, cfg: dict) -> Bodega:
    bodega = ctx.db.query(Bodega).filter(Bodega.nombre == cfg['nombre']).first()
    if bodega:
        if not bodega.responsable:
            bodega.responsable = cfg['responsable']
        bodega.sede = cfg['nombre']
        ctx.db.add(bodega)
        return bodega

    bodega = Bodega(
        nombre=cfg['nombre'], sede=cfg['nombre'],
        responsable=cfg['responsable'], descripcion=cfg['descripcion'],
    )
    ctx.db.add(bodega)
    ctx.db.flush()
    ctx.stats['bodegas'] += 1
    return bodega


def crea_empleado(ctx: Ctx, nombres: str, apellidos: str, cargo: str, departamento: str, sede: str) -> Empleado:
    emp = Empleado(
        nombres=nombres, apellidos=apellidos,
        cedula=ctx.cedula(), cargo=cargo, departamento=departamento, sede=sede,
        email=ctx.email(nombres, apellidos),
        telefono=f'3{random.randint(0, 2)}{random.randint(10000000, 99999999)}',
    )
    ctx.db.add(emp)
    ctx.db.flush()
    ctx.stats['empleados'] += 1
    return emp


def get_or_create_asesora(ctx: Ctx, cfg: dict) -> Empleado:
    nombres, apellidos = cfg['responsable'].split(' ', 1)
    asesora = ctx.db.query(Empleado).filter(Empleado.nombres == nombres, Empleado.apellidos == apellidos).first()
    if asesora:
        asesora.sede = cfg['nombre']
        ctx.db.add(asesora)
        return asesora
    return crea_empleado(ctx, nombres, apellidos, 'Asesora Líder', 'DIRECCION SEDE', cfg['nombre'])


def make_equipment(ctx: Ctx, item: dict, sede_nombre: str, bodega_id: int | None, empleado_id: int | None) -> Equipment:
    fecha_compra = HOY - timedelta(days=random.randint(60, 720))
    if item.get('garantia_corta'):
        garantia_vence = HOY + timedelta(days=random.randint(10, 25))
    else:
        meses_garantia = 24 if item['tipo'] == 'Portátil' else 12
        garantia_vence = fecha_compra + timedelta(days=meses_garantia * 30)

    valor_min, valor_max = VALORES[item['tipo']]
    eq = Equipment(
        codigo_interno=ctx.codigo(),
        serial=ctx.serial(item['serial_prefix']),
        tipo=item['tipo'], marca=item['marca'], modelo=item['modelo'],
        sede=sede_nombre, ubicacion=item['ubicacion'],
        estado=item['estado'],
        specs=item['specs'],
        fecha_compra=fecha_compra,
        valor=random.randint(valor_min, valor_max),
        proveedor=random.choice(PROVEEDORES),
        numero_factura=f'FE-{fecha_compra.year}-{random.randint(10000, 99999)}',
        garantia_vence=garantia_vence,
        observaciones=item.get('observaciones'),
        bodega_id=bodega_id,
        empleado_id=empleado_id,
    )
    ctx.db.add(eq)
    ctx.db.flush()
    ctx.stats['equipos'] += 1
    return eq


def crea_asignacion(ctx: Ctx, eq: Equipment, empleado: Empleado, bodega: Bodega | None,
                     fecha: datetime, estado_despues: str, obs: str | None) -> None:
    asignacion = Asignacion(
        equipment_id=eq.id,
        tipo=TIPO_ENTREGA,
        empleado_id=empleado.id,
        bodega_origen_id=bodega.id if bodega else None,
        estado_antes='En bodega' if bodega else 'Disponible',
        estado_despues=estado_despues,
        observaciones=obs,
        fecha=fecha,
        created_by_id=ADMIN_ID,
        created_at=fecha,
    )
    ctx.db.add(asignacion)
    ctx.stats['asignaciones'] += 1


def crea_acta(ctx: Ctx, eq: Equipment, empleado: Empleado, sede_nombre: str, fecha: datetime) -> None:
    acta = ActaEntrega(
        tipo='asignacion',
        sede=sede_nombre,
        titulo=f'{empleado.nombres} {empleado.apellidos}',
        entrega_nombre='Administrador del Sistema',
        recibe_nombre=f'{empleado.nombres} {empleado.apellidos}',
        equipos_snapshot=[{
            'id': eq.id, 'codigo_interno': eq.codigo_interno, 'serial': eq.serial,
            'tipo': eq.tipo, 'marca': eq.marca, 'modelo': eq.modelo, 'estado': eq.estado,
        }],
        empleado_id=empleado.id,
        fecha=fecha,
        created_by_id=ADMIN_ID,
        created_at=fecha,
    )
    ctx.db.add(acta)
    ctx.stats['actas'] += 1


def crea_mantenimiento(ctx: Ctx, eq: Equipment, m: dict) -> None:
    mantenimiento = Mantenimiento(
        equipment_id=eq.id,
        tipo=m['tipo'],
        fecha=m['fecha'],
        tecnico=m['tecnico'],
        descripcion=m['descripcion'],
        costo=m.get('costo'),
        observaciones=m.get('observaciones'),
        proximo_mantenimiento=m.get('proximo_mantenimiento'),
        created_by_id=ADMIN_ID,
    )
    ctx.db.add(mantenimiento)
    ctx.stats['mantenimientos'] += 1


def procesa_items(ctx: Ctx, items: list[dict], sede_nombre: str, bodega: Bodega) -> None:
    for item in items:
        estado = item['estado']
        empleado: Empleado | None = item.get('empleado')

        if estado in ('Asignado', 'Prestado') and empleado:
            bodega_id, empleado_id = None, empleado.id
        elif estado in ('Perdido', 'Dado de baja'):
            bodega_id, empleado_id = None, None
        else:
            bodega_id, empleado_id = bodega.id, None

        eq = make_equipment(ctx, item, sede_nombre, bodega_id, empleado_id)

        if empleado_id:
            fecha = random_fecha_pasada()
            crea_asignacion(ctx, eq, empleado, bodega, fecha, estado, item.get('asignacion_obs'))
            if random.random() < 0.6:
                crea_acta(ctx, eq, empleado, sede_nombre, fecha)

        if item.get('mantenimiento'):
            crea_mantenimiento(ctx, eq, item['mantenimiento'])


# ---------------------------------------------------------------------------
# Kits de equipos por sede
# ---------------------------------------------------------------------------

def kit_normal(recep1: Empleado, recep2: Empleado, medico: Empleado, esteticista: Empleado) -> list[dict]:
    items = []

    marca, modelo = random.choice(PORTATILES)
    items.append({'tipo': 'Portátil', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Recepción',
                   'serial_prefix': 'LT', 'specs': specs_portatil(), 'estado': 'Asignado', 'empleado': recep1})

    marca, modelo = random.choice(PORTATILES)
    items.append({'tipo': 'Portátil', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Recepción',
                   'serial_prefix': 'LT', 'specs': specs_portatil(), 'estado': 'Asignado', 'empleado': recep2})

    marca, modelo = random.choice(PORTATILES)
    items.append({'tipo': 'Portátil', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Consultorio Médico',
                   'serial_prefix': 'LT', 'specs': specs_portatil(), 'estado': 'Asignado', 'empleado': medico})

    marca, modelo = random.choice(TABLETS)
    items.append({'tipo': 'Tablet', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Sala de Estética',
                   'serial_prefix': 'TB', 'specs': specs_tablet(), 'estado': 'Asignado', 'empleado': esteticista})

    marca, modelo = random.choice(CELULARES)
    items.append({'tipo': 'Celular', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Recepción',
                   'serial_prefix': 'CL', 'specs': specs_celular(), 'estado': 'Asignado', 'empleado': recep1})

    marca, modelo = random.choice(IMPRESORAS)
    items.append({'tipo': 'Impresora', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Recepción',
                   'serial_prefix': 'IMP', 'specs': specs_impresora(), 'estado': 'En bodega', 'empleado': None})

    marca, modelo = random.choice(BAFLES)
    items.append({'tipo': 'Accesorio', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Sala General',
                   'serial_prefix': 'SND', 'specs': specs_bafle(), 'estado': 'En bodega', 'empleado': None})

    marca, modelo = random.choice(DIADEMAS)
    items.append({'tipo': 'Audífonos', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Recepción',
                   'serial_prefix': 'HS', 'specs': specs_diadema(), 'estado': 'Asignado', 'empleado': recep2})

    return items


def kit_alto_volumen(asesora: Empleado, recep: list[Empleado], medicos: list[Empleado], esteticistas: list[Empleado]) -> list[dict]:
    items = []

    for r in recep:
        marca, modelo = random.choice(PORTATILES)
        items.append({'tipo': 'Portátil', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Recepción',
                       'serial_prefix': 'LT', 'specs': specs_portatil(), 'estado': 'Asignado', 'empleado': r})

    for medico in medicos:
        marca, modelo = random.choice(PORTATILES)
        items.append({'tipo': 'Portátil', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Consultorio Médico',
                       'serial_prefix': 'LT', 'specs': specs_portatil(), 'estado': 'Asignado', 'empleado': medico})

    for esteticista in esteticistas:
        marca, modelo = random.choice(TABLETS)
        items.append({'tipo': 'Tablet', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Sala de Estética',
                       'serial_prefix': 'TB', 'specs': specs_tablet(), 'estado': 'Asignado', 'empleado': esteticista})

    for r in recep[:2]:
        marca, modelo = random.choice(CELULARES)
        items.append({'tipo': 'Celular', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Recepción',
                       'serial_prefix': 'CL', 'specs': specs_celular(), 'estado': 'Asignado', 'empleado': r})

    marca, modelo = random.choice(IMPRESORAS)
    items.append({'tipo': 'Impresora', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Recepción',
                   'serial_prefix': 'IMP', 'specs': specs_impresora(), 'estado': 'En bodega', 'empleado': None})

    marca, modelo = random.choice(IMPRESORAS)
    items.append({'tipo': 'Impresora', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Administración',
                   'serial_prefix': 'IMP', 'specs': specs_impresora(), 'estado': 'Asignado', 'empleado': asesora})

    marca, modelo = random.choice(BAFLES)
    items.append({'tipo': 'Accesorio', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Sala General',
                   'serial_prefix': 'SND', 'specs': specs_bafle(), 'estado': 'En bodega', 'empleado': None})

    for r in recep[2:4]:
        marca, modelo = random.choice(DIADEMAS)
        items.append({'tipo': 'Audífonos', 'marca': marca, 'modelo': modelo, 'ubicacion': 'Recepción',
                       'serial_prefix': 'HS', 'specs': specs_diadema(), 'estado': 'Asignado', 'empleado': r})

    return items


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    db = SessionLocal()
    try:
        if db.query(Bodega).filter(Bodega.nombre == 'TITAN PLAZA').first():
            print('El seed ya parece haberse ejecutado (existe la bodega TITAN PLAZA). No se hicieron cambios.')
            return

        ctx = Ctx(db)

        for cfg in SEDES:
            bodega = get_or_create_bodega(ctx, cfg)
            asesora = get_or_create_asesora(ctx, cfg)

            if cfg['alto_volumen']:
                recep = [crea_empleado(ctx, *ctx.random_name('F'), 'Recepcionista', 'OPERACIONES', cfg['nombre']) for _ in range(4)]
                medicos = [crea_empleado(ctx, *ctx.random_name(None), 'Médico Estético', 'SALUD', cfg['nombre']) for _ in range(2)]
                esteticistas = [crea_empleado(ctx, *ctx.random_name('F'), 'Esteticista', 'OPERACIONES', cfg['nombre']) for _ in range(2)]
                items = kit_alto_volumen(asesora, recep, medicos, esteticistas)
            else:
                recep1 = crea_empleado(ctx, *ctx.random_name('F'), 'Recepcionista', 'OPERACIONES', cfg['nombre'])
                recep2 = crea_empleado(ctx, *ctx.random_name('F'), 'Recepcionista', 'OPERACIONES', cfg['nombre'])
                medico = crea_empleado(ctx, *ctx.random_name(None), 'Médico Estético', 'SALUD', cfg['nombre'])
                esteticista = crea_empleado(ctx, *ctx.random_name('F'), 'Esteticista', 'OPERACIONES', cfg['nombre'])
                items = kit_normal(recep1, recep2, medico, esteticista)

            for idx, override in OVERRIDES.get(cfg['nombre'], {}).items():
                items[idx].update(override)

            procesa_items(ctx, items, cfg['nombre'], bodega)

        for cargo, departamento, genero in HOME_OFFICE_ROLES:
            empleado = crea_empleado(ctx, *ctx.random_name(genero), cargo, departamento, 'HOME OFFICE')
            marca, modelo = random.choice(PORTATILES)
            item = {'tipo': 'Portátil', 'marca': marca, 'modelo': modelo, 'ubicacion': departamento,
                    'serial_prefix': 'LT', 'specs': specs_portatil(), 'estado': 'Asignado'}
            eq = make_equipment(ctx, item, 'HOME OFFICE', None, empleado.id)
            fecha = random_fecha_pasada()
            crea_asignacion(ctx, eq, empleado, None, fecha, 'Asignado', None)
            if random.random() < 0.6:
                crea_acta(ctx, eq, empleado, 'HOME OFFICE', fecha)

        db.commit()
        print('Seed completado:')
        for key, value in ctx.stats.items():
            print(f'  {key}: {value}')
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == '__main__':
    main()
