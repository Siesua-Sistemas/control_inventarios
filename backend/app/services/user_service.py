from fastapi import HTTPException, status

from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate
from app.security import get_password_hash


class UserService:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    def list_users(self):
        return self.repository.list_users()

    def get_roles(self):
        return self.repository.get_roles()

    def get_permissions(self):
        return self.repository.get_permissions()

    def create_user(self, payload: UserCreate) -> User:
        existing = self.repository.get_user_by_email(payload.email)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='El correo ya existe')

        role_ids = payload.role_ids or []
        roles = []
        for role_id in role_ids:
            role = self.repository.get_role_by_id(role_id)
            if not role:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Rol inválido: {role_id}')
            roles.append(role)

        user = User(
            email=payload.email,
            full_name=payload.full_name,
            password_hash=get_password_hash(payload.password),
            is_active=True,
            roles=roles,
        )

        return self.repository.create_user(user)
