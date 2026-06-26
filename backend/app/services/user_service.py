from fastapi import HTTPException, status

from app.models.user import Role, User
from app.repositories.user_repository import UserRepository
from app.schemas.user import RoleCreate, RoleUpdate, UserCreate, UserUpdate
from app.security import get_password_hash


class UserService:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    def list_users(self):
        return self.repository.list_users()

    def get_user(self, user_id: int) -> User:
        user = self.repository.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Usuario no encontrado')
        return user

    def get_roles(self):
        return self.repository.get_roles()

    def get_permissions(self):
        return self.repository.get_permissions()

    def _resolve_roles(self, role_ids: list[int]) -> list[Role]:
        roles = []
        for role_id in role_ids:
            role = self.repository.get_role_by_id(role_id)
            if not role:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Rol inválido: {role_id}')
            roles.append(role)
        return roles

    def create_user(self, payload: UserCreate) -> User:
        existing = self.repository.get_user_by_email(payload.email)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='El correo ya existe')

        user = User(
            email=payload.email,
            full_name=payload.full_name,
            password_hash=get_password_hash(payload.password),
            is_active=True,
            roles=self._resolve_roles(payload.role_ids or []),
        )

        return self.repository.create_user(user)

    def update_user(self, user_id: int, payload: UserUpdate) -> User:
        user = self.get_user(user_id)

        if payload.email is not None and payload.email != user.email:
            existing = self.repository.get_user_by_email(payload.email)
            if existing and existing.id != user.id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='El correo ya existe')
            user.email = payload.email

        if payload.full_name is not None:
            user.full_name = payload.full_name

        if payload.password:
            user.password_hash = get_password_hash(payload.password)

        if payload.is_active is not None:
            user.is_active = payload.is_active

        if payload.role_ids is not None:
            user.roles = self._resolve_roles(payload.role_ids)

        return self.repository.update_user(user)

    def create_role(self, payload: RoleCreate) -> Role:
        existing = self.repository.get_role_by_name(payload.name)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='El rol ya existe')

        role = Role(
            name=payload.name,
            description=payload.description,
            home_dashboard=payload.home_dashboard,
            dominios=payload.dominios,
            permissions=self.repository.get_permissions_by_ids(payload.permission_ids),
        )
        return self.repository.create_role(role)

    def update_role(self, role_id: int, payload: RoleUpdate) -> Role:
        role = self.repository.get_role_by_id(role_id)
        if not role:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Rol no encontrado')

        if payload.name is not None and payload.name != role.name:
            existing = self.repository.get_role_by_name(payload.name)
            if existing and existing.id != role.id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='El rol ya existe')
            role.name = payload.name

        if payload.description is not None:
            role.description = payload.description

        if payload.home_dashboard is not None:
            role.home_dashboard = payload.home_dashboard

        if payload.dominios is not None:
            role.dominios = payload.dominios

        if payload.permission_ids is not None:
            role.permissions = self.repository.get_permissions_by_ids(payload.permission_ids)

        return self.repository.update_role(role)
