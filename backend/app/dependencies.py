import secrets

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.security import decode_access_token

security = HTTPBearer()

DOMINIOS_DISPONIBLES = ['IT', 'Bioingeniería', 'General']


def get_user_dominios(user: User) -> list[str] | None:
    """Retorna los dominios visibles para el usuario.
    None significa sin restricción (superusuario).
    """
    if user.is_superuser:
        return None  # ve todo
    dominios: set[str] = set()
    for role in user.roles:
        for d in (role.dominios or ['IT']):
            dominios.add(d)
    return list(dominios) if dominios else ['IT']


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload.get('sub'))
    except (JWTError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token inválido') from exc

    repository = UserRepository(db)
    user = repository.get_user_by_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Usuario no activo')
    return user


def require_permissions(*required_permissions: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        permissions = {permission.code for role in user.roles for permission in role.permissions}
        if not required_permissions:
            return user
        if not set(required_permissions).issubset(permissions):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Permisos insuficientes')
        return user

    return dependency


def require_api_key(x_api_key: str | None = Header(None, alias='X-API-Key')) -> bool:
    """Autenticación por API key para integraciones externas (ej. conector de Looker
    Studio), separada del login por JWT de los usuarios de la aplicación."""
    if not settings.LOOKER_API_KEY:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail='Integración no configurada')
    if not x_api_key or not secrets.compare_digest(x_api_key, settings.LOOKER_API_KEY):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='API key inválida')
    return True


def require_any_permission(*required_permissions: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        permissions = {permission.code for role in user.roles for permission in role.permissions}
        if not required_permissions:
            return user
        if not set(required_permissions) & permissions:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Permisos insuficientes')
        return user

    return dependency
