from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import Permission, RefreshToken, Role, User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_user_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def get_user_by_id(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def list_users(self):
        return self.db.scalars(select(User).order_by(User.created_at.desc())).all()

    def get_roles(self):
        return self.db.scalars(select(Role).order_by(Role.name.asc())).all()

    def get_permissions(self):
        return self.db.scalars(select(Permission).order_by(Permission.code.asc())).all()

    def get_role_by_id(self, role_id: int) -> Role | None:
        return self.db.get(Role, role_id)

    def get_role_by_name(self, name: str) -> Role | None:
        return self.db.scalar(select(Role).where(Role.name == name))

    def get_permissions_by_ids(self, permission_ids: list[int]) -> list[Permission]:
        if not permission_ids:
            return []
        return self.db.scalars(select(Permission).where(Permission.id.in_(permission_ids))).all()

    def create_user(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_user(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def create_role(self, role: Role) -> Role:
        self.db.add(role)
        self.db.commit()
        self.db.refresh(role)
        return role

    def update_role(self, role: Role) -> Role:
        self.db.add(role)
        self.db.commit()
        self.db.refresh(role)
        return role

    def create_refresh_token(self, token_record: RefreshToken) -> RefreshToken:
        self.db.add(token_record)
        self.db.commit()
        self.db.refresh(token_record)
        return token_record

    def get_active_refresh_token(self, token_jti: str) -> RefreshToken | None:
        return self.db.scalar(
            select(RefreshToken).where(RefreshToken.token_jti == token_jti, RefreshToken.revoked_at.is_(None))
        )

    def revoke_refresh_token(self, refresh_token: RefreshToken) -> None:
        refresh_token.revoked_at = datetime.utcnow()
        self.db.add(refresh_token)
        self.db.commit()
