"""
Integración SIESUA — completamente aislada del resto del sistema.

Sincroniza sedes y empleados desde la base de datos MySQL de SIESUA hacia
la base de datos PostgreSQL interna. Para cambiar la fuente de datos o
desactivar la integración basta con editar/eliminar este archivo y su
tabla integracion_siesua_mapping — ningún modelo core se ve afectado.

Dependencia externa requerida: mysql-connector-python
"""
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy.orm import Session

# ── Configuración de conexión MySQL (solo lectura) ─────────────────────────────
# Configura las variables de entorno SIESUA_DB_* en el archivo .env del backend.

MYSQL_CONFIG = {
    'host':     os.getenv('SIESUA_DB_HOST',     'sistemasiesua.com'),
    'user':     os.getenv('SIESUA_DB_USER',     ''),
    'password': os.getenv('SIESUA_DB_PASSWORD', ''),
    'database': os.getenv('SIESUA_DB_NAME',     ''),
    'connect_timeout': 10,
}

# Coordenadas de Bogotá (centro) como placeholder para sedes sin GPS configurado.
# El administrador debe actualizar las coordenadas desde Personal → Ubicaciones.
_BOGOTA_LAT = 4.7110
_BOGOTA_LON = -74.0721

# Sedes que deben ignorarse durante la sincronización (nombres exactos, sin importar mayúsculas).
_SEDES_EXCLUIDAS: set[str] = {'DR. JULIAN SILVA', 'TELEORIENTACION'}


# Consulta de sedes activas
_SQL_SEDES = "SELECT Id, Nombre FROM sedes WHERE Estado = 1"

# Consulta de usuarios activos (todos, sin JOIN problemático por campo CSV)
_SQL_USUARIOS = """
    SELECT Id, IdSede, Tipo, Nombre, Apellido, NoIdentificacion
    FROM usuarios
    WHERE Estado = 1 AND Id > 0
"""

# Catálogo de roles/tipos de usuario — usado para completar el cargo del empleado
_SQL_ROLES = "SELECT Id, Nombre FROM roles"


# ── Resultado de sincronización ────────────────────────────────────────────────

@dataclass
class SyncResult:
    sedes_creadas: int = 0
    sedes_actualizadas: int = 0
    empleados_creados: int = 0
    empleados_actualizados: int = 0
    empleados_sin_cambios: int = 0
    errores: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return len(self.errores) == 0


# ── Helpers internos ───────────────────────────────────────────────────────────

def _parse_ids(ids_str: str) -> list[int]:
    """Convierte '14,27,13' → [14, 27, 13]. Tolera espacios y valores vacíos."""
    if not ids_str:
        return []
    result = []
    for part in ids_str.split(','):
        part = part.strip()
        if part.isdigit():
            result.append(int(part))
    return result


def _get_or_create_mapping(db: Session, tipo: str, ext_id: str, internal_id: int | None = None):
    from app.models.integracion_siesua import SiesuaMapping
    m = db.query(SiesuaMapping).filter_by(tipo=tipo, ext_id=ext_id).first()
    if m is None and internal_id is not None:
        m = SiesuaMapping(tipo=tipo, ext_id=ext_id, internal_id=internal_id,
                          synced_at=datetime.now(timezone.utc).replace(tzinfo=None))
        db.add(m)
    return m


# ── Sincronización de sedes ────────────────────────────────────────────────────

def _sync_sedes(db: Session, rows: list[dict], result: SyncResult) -> dict[int, int]:
    """
    Sincroniza sedes de MySQL a SedeJornada.
    Devuelve un dict {mysql_id: internal_sede_id} para usar al sync empleados.
    """
    from app.models.integracion_siesua import SiesuaMapping
    from app.models.sede_jornada import SedeJornada

    # Cargar todos los mappings de sedes existentes
    existing_mappings: dict[str, int] = {
        m.ext_id: m.internal_id
        for m in db.query(SiesuaMapping).filter_by(tipo='sede').all()
    }

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    ext_to_internal: dict[int, int] = {}

    for row in rows:
        ext_id = str(row['Id'])
        nombre = (row['Nombre'] or '').strip()
        if not nombre:
            continue
        if nombre.upper() in {n.upper() for n in _SEDES_EXCLUIDAS}:
            continue  # sede excluida manualmente

        try:
            if ext_id in existing_mappings:
                internal_id = existing_mappings[ext_id]
                sede = db.query(SedeJornada).filter_by(id=internal_id).first()
                if sede is None:
                    result.errores.append(f'Sede mapping ext_id={ext_id} apunta a sede inexistente')
                    continue
                if sede.nombre != nombre:
                    sede.nombre = nombre
                    result.sedes_actualizadas += 1
                # Actualizar timestamp del mapping
                m = db.query(SiesuaMapping).filter_by(tipo='sede', ext_id=ext_id).first()
                if m:
                    m.synced_at = now
            else:
                # Buscar por nombre exacto (case-insensitive) antes de crear
                sede = (
                    db.query(SedeJornada)
                    .filter(SedeJornada.nombre.ilike(nombre))
                    .first()
                )
                if sede:
                    # Vincular sede existente al mapping
                    _get_or_create_mapping(db, 'sede', ext_id, sede.id)
                    result.sedes_actualizadas += 1
                else:
                    # Crear sede nueva — el admin debe configurar GPS después
                    sede = SedeJornada(
                        nombre=nombre,
                        latitud=_BOGOTA_LAT,
                        longitud=_BOGOTA_LON,
                        radio_metros=100,
                        tipo='empresa',
                        is_active=True,
                    )
                    db.add(sede)
                    db.flush()  # obtener sede.id
                    _get_or_create_mapping(db, 'sede', ext_id, sede.id)
                    result.sedes_creadas += 1

                existing_mappings[ext_id] = sede.id

            ext_to_internal[int(ext_id)] = sede.id

        except Exception as exc:
            result.errores.append(f'Error sede ext_id={ext_id}: {exc}')

    return ext_to_internal


# ── Sincronización de empleados ────────────────────────────────────────────────

def _sync_empleados(
    db: Session,
    rows: list[dict],
    ext_sede_to_internal: dict[int, int],
    roles_map: dict[int, str],
    result: SyncResult,
) -> None:
    from app.models.integracion_siesua import SiesuaMapping
    from app.models.empleado import Empleado
    from app.models.sede_jornada import SedeJornada

    # Pre-cargar todos los mappings de empleados existentes
    all_mappings = db.query(SiesuaMapping).filter_by(tipo='empleado').all()
    existing_emp_mappings: dict[str, int] = {m.ext_id: m.internal_id for m in all_mappings}

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    active_ext_ids = {str(row['Id']) for row in rows}

    # Desactivar empleados que ya no están activos en SIESUA (fin de temporada)
    for ext_id, internal_id in existing_emp_mappings.items():
        if ext_id not in active_ext_ids:
            emp_inact = db.query(Empleado).filter_by(id=internal_id).first()
            if emp_inact and emp_inact.is_active:
                emp_inact.is_active = False
                emp_inact.en_jornada = False
                result.empleados_actualizados += 1

    for row in rows:
        ext_id = str(row['Id'])
        cedula = (row['NoIdentificacion'] or '').strip()
        nombres = (row['Nombre'] or '').strip()
        apellidos = (row['Apellido'] or '').strip()

        if not cedula or not nombres:
            continue  # saltar registros sin datos mínimos

        # Calcular sedes internas para este empleado
        mysql_sede_ids = _parse_ids(row.get('IdSede') or '')
        sedes_internas_ids = list({
            ext_sede_to_internal[sid]
            for sid in mysql_sede_ids
            if sid in ext_sede_to_internal
        })

        # Cargo = nombre del rol (Tipo) según el catálogo de roles de SIESUA.
        # Solo se usa para completar el cargo si está vacío, nunca sobrescribe
        # un valor ya puesto manualmente en el sistema.
        cargo = roles_map.get(row.get('Tipo'))

        try:
            emp: Empleado | None = None

            if ext_id in existing_emp_mappings:
                internal_id = existing_emp_mappings[ext_id]
                emp = db.query(Empleado).filter_by(id=internal_id).first()
                if emp is None:
                    result.errores.append(f'Empleado mapping ext_id={ext_id} apunta a empleado inexistente')
                    continue
                # Actualizar timestamp del mapping
                m = db.query(SiesuaMapping).filter_by(tipo='empleado', ext_id=ext_id).first()
                if m:
                    m.synced_at = now
            else:
                # Buscar por cédula antes de crear
                emp = db.query(Empleado).filter_by(cedula=cedula).first()
                if emp:
                    _get_or_create_mapping(db, 'empleado', ext_id, emp.id)
                else:
                    # Determinar sede principal (primera de la lista)
                    sede_principal_nombre: str | None = None
                    if sedes_internas_ids:
                        primera_sede = db.query(SedeJornada).filter_by(id=sedes_internas_ids[0]).first()
                        if primera_sede:
                            sede_principal_nombre = primera_sede.nombre

                    emp = Empleado(
                        nombres=nombres,
                        apellidos=apellidos,
                        cedula=cedula,
                        sede=sede_principal_nombre,
                        cargo=cargo,
                        en_jornada=True,
                        is_active=True,
                    )
                    db.add(emp)
                    db.flush()
                    _get_or_create_mapping(db, 'empleado', ext_id, emp.id)
                    existing_emp_mappings[ext_id] = emp.id
                    result.empleados_creados += 1

            # Actualizar datos del empleado.
            # OJO: nunca reactivar aquí (is_active) ni forzar en_jornada — si el
            # empleado ya fue retirado localmente, debe seguir retirado aunque
            # SIESUA aún lo marque como Estado=1, y el switch "Mi Jornada" es
            # 100% manual desde el panel de Personal una vez creado el empleado.
            changed = False
            if emp.nombres != nombres:
                emp.nombres = nombres; changed = True
            if emp.apellidos != apellidos:
                emp.apellidos = apellidos; changed = True
            if emp.cedula != cedula:
                emp.cedula = cedula; changed = True
            if cargo and not emp.cargo:
                emp.cargo = cargo; changed = True

            if changed:
                result.empleados_actualizados += 1
            elif ext_id in existing_emp_mappings:
                result.empleados_sin_cambios += 1

            # Sincronizar sedes autorizadas — reemplaza completamente con las de MySQL
            if sedes_internas_ids:
                sedes_obj = (
                    db.query(SedeJornada)
                    .filter(SedeJornada.id.in_(sedes_internas_ids))
                    .all()
                )
                emp.sedes_jornada = sedes_obj

                # Actualizar sede principal si no está asignada
                if not emp.sede and sedes_obj:
                    emp.sede = sedes_obj[0].nombre

        except Exception as exc:
            result.errores.append(f'Error empleado ext_id={ext_id} cedula={cedula}: {exc}')


# ── Función principal ──────────────────────────────────────────────────────────

def sincronizar(db: Session) -> SyncResult:
    """
    Conecta a MySQL de SIESUA, lee sedes y usuarios activos, y sincroniza
    hacia las tablas PostgreSQL internas. Idempotente: puede ejecutarse
    múltiples veces sin duplicar registros.
    """
    result = SyncResult()

    try:
        import mysql.connector  # type: ignore[import-untyped]
    except ImportError:
        result.errores.append(
            'mysql-connector-python no está instalado. '
            'Ejecuta: pip install mysql-connector-python'
        )
        return result

    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor(dictionary=True)
    except Exception as exc:
        result.errores.append(f'No se pudo conectar a SIESUA MySQL: {exc}')
        return result

    try:
        # 1 — Sincronizar sedes
        cursor.execute(_SQL_SEDES)
        sedes_rows = cursor.fetchall()
        ext_sede_map = _sync_sedes(db, sedes_rows, result)
        db.flush()

        # 2 — Catálogo de roles (Tipo -> cargo)
        cursor.execute(_SQL_ROLES)
        roles_map = {r['Id']: (r['Nombre'] or '').strip() for r in cursor.fetchall()}

        # 3 — Sincronizar empleados
        cursor.execute(_SQL_USUARIOS)
        usuarios_rows = cursor.fetchall()
        _sync_empleados(db, usuarios_rows, ext_sede_map, roles_map, result)

        db.commit()

    except Exception as exc:
        db.rollback()
        result.errores.append(f'Error durante la sincronización: {exc}')
    finally:
        try:
            cursor.close()
            conn.close()
        except Exception:
            pass

    return result
