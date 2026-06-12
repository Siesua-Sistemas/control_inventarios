from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.security import decode_access_token

security = HTTPBearer()


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


def require_any_permission(*required_permissions: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        permissions = {permission.code for role in user.roles for permission in role.permissions}
        if not required_permissions:
            return user
        if not set(required_permissions) & permissions:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Permisos insuficientes')
        return user

    return dependency
