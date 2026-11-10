"""Lógica compartida de los enlaces/QR de acceso (RF-01): emisión por el admin y
ejecución de cada trámite por la persona que abre el enlace."""
import hashlib
import re
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from pydantic import BaseModel, EmailStr, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.empleado import Empleado
from app.models.enlace_acceso import EnlaceAcceso
from app.models.sede_jornada import SedeJornada
from app.models.user import RefreshToken, User
from app.security import get_password_hash

# Orden canónico: así se presentan los pasos del asistente cuando hay varios.
MODULOS: dict[str, str] = {
    'nuevo': 'Registro de usuario nuevo (empleado + cuenta de acceso)',
    'nuevo_empleado': 'Registro de empleado (sin cuenta de acceso)',
    'cuenta': 'Creación de usuario de acceso',
    'password': 'Cambio de contraseña',
    'datos': 'Actualización de datos generales',
    'ubicacion': 'Ubicación de trabajo (Home Office)',
}
ORDEN_MODULOS = list(MODULOS)

MAX_INTENTOS = 5
MIN_PASSWORD = 8


def normalizar_cedula(valor: str) -> str:
    return re.sub(r'[\s.\-]', '', valor or '')


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def nuevo_token() -> str:
    return secrets.token_urlsafe(32)


def buscar_empleado(db: Session, cedula: str) -> Empleado | None:
    return db.scalar(select(Empleado).where(Empleado.cedula == cedula))


def buscar_cuenta(db: Session, empleado: Empleado) -> User | None:
    """Cuenta de login de la persona: por vínculo explícito y, si no existe, por
    correo coincidente con el del empleado (aún no hay vínculos históricos)."""
    user = db.scalar(select(User).where(User.empleado_id == empleado.id))
    if user or not empleado.email:
        return user
    return db.scalar(select(User).where(func.lower(User.email) == empleado.email.strip().lower()))


def validar_emision(db: Session, cedula: str, modulos: list[str]) -> tuple[Empleado | None, list[str]]:
    """Reglas de la matriz de casos de uso. Devuelve (empleado|None, módulos ordenados)."""
    if not cedula:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, 'La cédula es obligatoria')
    invalidos = [m for m in modulos if m not in MODULOS]
    if invalidos:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f'Módulo(s) inválido(s): {invalidos}')
    if not modulos:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Selecciona al menos un trámite')
    ordenados = [m for m in ORDEN_MODULOS if m in set(modulos)]

    empleado = buscar_empleado(db, cedula)
    if empleado is None:
        # Cédula nueva: solo se puede registrar la persona (y, opcionalmente, su ubicación).
        altas = [m for m in ordenados if m in ('nuevo', 'nuevo_empleado')]
        extra = [m for m in ordenados if m not in ('nuevo', 'nuevo_empleado', 'ubicacion')]
        if len(altas) != 1 or extra:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                'La cédula no existe: elige un tipo de alta (empleado + cuenta, o solo empleado); solo puede combinarse con la ubicación Home Office',
            )
        return None, ordenados

    if 'nuevo' in ordenados or 'nuevo_empleado' in ordenados:
        raise HTTPException(status.HTTP_409_CONFLICT, 'La cédula ya está registrada; no se puede crear de nuevo')
    if not empleado.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, 'El empleado está inactivo')
    if 'cuenta' in ordenados:
        if buscar_cuenta(db, empleado) is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, 'Esa persona ya tiene una cuenta de acceso')
        if 'password' in ordenados:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Al crear la cuenta ya se define la contraseña; quita "Cambio de contraseña"')
    if 'password' in ordenados and buscar_cuenta(db, empleado) is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            'Esta persona no tiene una cuenta de acceso vinculada (por empleado o por correo) para cambiar su contraseña',
        )
    return empleado, ordenados


def estado_enlace(e: EnlaceAcceso, ahora: datetime | None = None) -> str:
    ahora = ahora or datetime.utcnow()
    if e.revoked_at:
        return 'revocado'
    if e.used_at:
        return 'usado'
    if e.bloqueado:
        return 'bloqueado'
    if e.expires_at <= ahora:
        return 'expirado'
    return 'activo'


def crear_enlace(
    db: Session, cedula: str, modulos: list[str], horas: int, creador_id: int | None
) -> tuple[EnlaceAcceso, str, Empleado | None]:
    empleado, ordenados = validar_emision(db, cedula, modulos)
    token = nuevo_token()
    enlace = EnlaceAcceso(
        token_hash=hash_token(token),
        cedula=cedula,
        empleado_id=empleado.id if empleado else None,
        modulos=ordenados,
        pasos_completados=[],
        expires_at=datetime.utcnow() + timedelta(hours=horas),
        created_by_id=creador_id,
    )
    db.add(enlace)
    db.commit()
    db.refresh(enlace)
    return enlace, token, empleado


def obtener_enlace(db: Session, token: str, *, lock: bool = False) -> EnlaceAcceso:
    stmt = select(EnlaceAcceso).where(EnlaceAcceso.token_hash == hash_token(token))
    if lock:
        stmt = stmt.with_for_update()
    enlace = db.scalar(stmt)
    if enlace is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'Enlace no válido')
    return enlace


def exigir_activo(enlace: EnlaceAcceso) -> None:
    estado = estado_enlace(enlace)
    if estado != 'activo':
        mensajes = {
            'expirado': 'El enlace expiró. Solicita uno nuevo al administrador.',
            'usado': 'Este enlace ya fue utilizado.',
            'revocado': 'Este enlace fue revocado por el administrador.',
            'bloqueado': 'Enlace bloqueado por demasiados intentos fallidos. Solicita uno nuevo.',
        }
        raise HTTPException(status.HTTP_410_GONE, mensajes[estado])


def confirmar_cedula(db: Session, enlace: EnlaceAcceso, cedula: str) -> None:
    """Primer factor del usuario final. Cuenta fallos y bloquea el enlace al llegar al máximo."""
    if secrets.compare_digest(normalizar_cedula(cedula), enlace.cedula):
        return
    enlace.intentos_fallidos += 1
    if enlace.intentos_fallidos >= MAX_INTENTOS:
        enlace.bloqueado = True
    restantes = max(MAX_INTENTOS - enlace.intentos_fallidos, 0)
    db.commit()  # persistir el fallo aunque se responda con error
    detalle = 'Cédula incorrecta.'
    detalle += f' Intentos restantes: {restantes}.' if restantes else ' El enlace fue bloqueado.'
    raise HTTPException(status.HTTP_403_FORBIDDEN, detalle)


# ── Esquemas de cada trámite ─────────────────────────────────────────────────

class _Base(BaseModel):
    model_config = {'extra': 'forbid'}


class NuevoIn(_Base):
    nombres: str = Field(min_length=2, max_length=120)
    apellidos: str = Field(min_length=2, max_length=120)
    email: EmailStr
    telefono: str | None = Field(default=None, max_length=20)
    cargo: str | None = Field(default=None, max_length=100)
    password: str = Field(min_length=MIN_PASSWORD, max_length=128)


class NuevoEmpleadoIn(_Base):
    nombres: str = Field(min_length=2, max_length=120)
    apellidos: str = Field(min_length=2, max_length=120)
    email: EmailStr | None = None
    telefono: str | None = Field(default=None, max_length=20)
    cargo: str | None = Field(default=None, max_length=100)


class CuentaIn(_Base):
    email: EmailStr
    password: str = Field(min_length=MIN_PASSWORD, max_length=128)


class PasswordIn(_Base):
    password: str = Field(min_length=MIN_PASSWORD, max_length=128)


class DatosIn(_Base):
    email: EmailStr
    telefono: str | None = Field(default=None, max_length=20)


class UbicacionIn(_Base):
    direccion: str = Field(min_length=5, max_length=250)
    ciudad: str = Field(min_length=2, max_length=100)
    latitud: float = Field(ge=-90, le=90)
    longitud: float = Field(ge=-180, le=180)


def _parse(modelo: type[BaseModel], datos: dict):
    try:
        return modelo.model_validate(datos)
    except ValidationError as exc:
        primero = exc.errors()[0]
        campo = '.'.join(str(p) for p in primero['loc']) or 'datos'
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f'{campo}: {primero["msg"]}') from exc


def _empleado_del_enlace(db: Session, enlace: EnlaceAcceso) -> Empleado:
    empleado = buscar_empleado(db, enlace.cedula)
    if empleado is None or not empleado.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, 'No se encontró un empleado activo para esta cédula')
    return empleado


def _paso_nuevo(db: Session, enlace: EnlaceAcceso, datos: dict, ip: str | None) -> None:
    d = _parse(NuevoIn, datos)
    if buscar_empleado(db, enlace.cedula) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, 'La cédula ya está registrada')
    email = d.email.strip().lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, 'Ese correo ya está en uso')
    empleado = Empleado(
        nombres=d.nombres.strip(), apellidos=d.apellidos.strip(), cedula=enlace.cedula,
        cargo=d.cargo, email=email, telefono=d.telefono,
    )
    db.add(empleado)
    db.flush()
    # La cuenta nace sin roles e inactiva: un administrador debe activarla y asignarle permisos.
    db.add(User(
        email=email, full_name=f'{empleado.nombres} {empleado.apellidos}',
        password_hash=get_password_hash(d.password), is_active=False, empleado_id=empleado.id,
    ))
    enlace.empleado_id = empleado.id


def _paso_nuevo_empleado(db: Session, enlace: EnlaceAcceso, datos: dict, ip: str | None) -> None:
    d = _parse(NuevoEmpleadoIn, datos)
    if buscar_empleado(db, enlace.cedula) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, 'La cédula ya está registrada')
    empleado = Empleado(
        nombres=d.nombres.strip(), apellidos=d.apellidos.strip(), cedula=enlace.cedula,
        cargo=d.cargo, email=d.email.strip().lower() if d.email else None, telefono=d.telefono,
    )
    db.add(empleado)
    db.flush()
    enlace.empleado_id = empleado.id


def _paso_cuenta(db: Session, enlace: EnlaceAcceso, datos: dict, ip: str | None) -> None:
    d = _parse(CuentaIn, datos)
    empleado = _empleado_del_enlace(db, enlace)
    if buscar_cuenta(db, empleado) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, 'Esa persona ya tiene una cuenta de acceso')
    email = d.email.strip().lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, 'Ese correo ya está en uso')
    # Sin roles e inactiva: un administrador debe activarla y asignarle permisos.
    db.add(User(
        email=email, full_name=f'{empleado.nombres} {empleado.apellidos}',
        password_hash=get_password_hash(d.password), is_active=False, empleado_id=empleado.id,
    ))
    if not empleado.email:
        empleado.email = email


def _paso_password(db: Session, enlace: EnlaceAcceso, datos: dict, ip: str | None) -> None:
    d = _parse(PasswordIn, datos)
    empleado = _empleado_del_enlace(db, enlace)
    user = buscar_cuenta(db, empleado)
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, 'No hay una cuenta de acceso vinculada')
    user.password_hash = get_password_hash(d.password)
    user.empleado_id = empleado.id
    # Cierra sesiones abiertas con la clave anterior.
    ahora = datetime.utcnow()
    for rt in db.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))):
        rt.revoked_at = ahora


def _paso_datos(db: Session, enlace: EnlaceAcceso, datos: dict, ip: str | None) -> None:
    d = _parse(DatosIn, datos)
    empleado = _empleado_del_enlace(db, enlace)
    empleado.email = d.email.strip().lower()
    empleado.telefono = d.telefono


def _paso_ubicacion(db: Session, enlace: EnlaceAcceso, datos: dict, ip: str | None) -> None:
    d = _parse(UbicacionIn, datos)
    empleado = _empleado_del_enlace(db, enlace)
    sede = next((s for s in empleado.sedes_jornada if s.tipo == 'home_office'), None)
    if sede is None:
        sede = SedeJornada(
            nombre=f'Home Office - {empleado.nombres} {empleado.apellidos} ({empleado.cedula})',
            tipo='home_office', radio_metros=100, latitud=d.latitud, longitud=d.longitud,
        )
        db.add(sede)
        empleado.sedes_jornada.append(sede)
    sede.direccion = d.direccion.strip()
    sede.ciudad = d.ciudad.strip()
    sede.latitud = d.latitud
    sede.longitud = d.longitud
    # IP desde la que se registró la ubicación: queda como IP autorizada de la sede
    # (la jornada la usa para marcar ip_verificada).
    if ip:
        sede.ip_autorizada = ip[:45]
    sede.is_active = True


_PASOS = {
    'nuevo': _paso_nuevo,
    'nuevo_empleado': _paso_nuevo_empleado,
    'cuenta': _paso_cuenta,
    'password': _paso_password,
    'datos': _paso_datos,
    'ubicacion': _paso_ubicacion,
}


def ejecutar_paso(db: Session, enlace: EnlaceAcceso, modulo: str, datos: dict, ip: str | None = None) -> None:
    """Aplica un trámite y avanza el asistente. El enlace debe venir bloqueado con FOR UPDATE
    para que dos peticiones simultáneas no completen el mismo paso (un solo uso)."""
    if modulo not in enlace.modulos:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Ese trámite no está habilitado en este enlace')
    hechos = list(enlace.pasos_completados or [])
    pendientes = [m for m in enlace.modulos if m not in hechos]
    if modulo in hechos:
        raise HTTPException(status.HTTP_409_CONFLICT, 'Este paso ya fue completado')
    if modulo != pendientes[0]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f'Primero completa: {MODULOS[pendientes[0]]}')

    _PASOS[modulo](db, enlace, datos, ip)

    hechos.append(modulo)
    enlace.pasos_completados = hechos
    if len(hechos) == len(enlace.modulos):
        enlace.used_at = datetime.utcnow()
