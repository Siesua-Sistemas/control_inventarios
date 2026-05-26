from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from jose import JWTError

from app.config import settings
from app.models.user import RefreshToken
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthUserResponse
from app.security import create_access_token, create_refresh_token, decode_refresh_token, verify_password


class AuthService:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    def authenticate(self, email: str, password: str) -> AuthUserResponse:
        user = self.repository.get_user_by_email(email)
        if not user or not user.is_active or not verify_password(password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Credenciales inválidas')

        user.last_login_at = datetime.utcnow()
        self.repository.db.add(user)
        self.repository.db.commit()

        return AuthUserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            roles=[role.name for role in user.roles],
            permissions=[permission.code for role in user.roles for permission in role.permissions],
        )

    def create_tokens(self, user) -> tuple[str, str]:
        access_token = create_access_token(subject=str(user.id))
        refresh_token = create_refresh_token(subject=str(user.id))
        return access_token, refresh_token

    def store_refresh_token(self, user_id: int, refresh_token: str) -> None:
        payload = decode_refresh_token(refresh_token)
        token_jti = payload.get('jti')
        expires_at = datetime.fromtimestamp(float(payload['exp']), UTC)
        record = RefreshToken(user_id=user_id, token_jti=token_jti, expires_at=expires_at)
        self.repository.create_refresh_token(record)

    def refresh_tokens(self, refresh_token_value: str) -> tuple[str, str]:
        try:
            payload = decode_refresh_token(refresh_token_value)
        except JWTError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token de refresco inválido') from exc

        if payload.get('type') != 'refresh':
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token de refresco inválido')

        user_id = int(payload.get('sub'))
        user = self.repository.get_user_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Usuario no activo')

        token_jti = payload.get('jti')
        if token_jti is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token de refresco inválido')

        stored = self.repository.get_active_refresh_token(token_jti)
        if not stored:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Refresh token revocado o inexistente')

        stored.revoked_at = datetime.utcnow()
        self.repository.db.add(stored)
        self.repository.db.commit()

        access_token = create_access_token(subject=str(user.id))
        new_refresh_token = create_refresh_token(subject=str(user.id))
        self.store_refresh_token(user.id, new_refresh_token)
        return access_token, new_refresh_token

    def logout(self, refresh_token_value: str) -> None:
        try:
            payload = decode_refresh_token(refresh_token_value)
        except JWTError:
            return

        token_jti = payload.get('jti')
        if token_jti is None:
            return

        stored = self.repository.get_active_refresh_token(token_jti)
        if stored:
            stored.revoked_at = datetime.utcnow()
            self.repository.db.add(stored)
            self.repository.db.commit()
