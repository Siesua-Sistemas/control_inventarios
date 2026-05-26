from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permissions
from app.repositories.user_repository import UserRepository
from app.schemas.user import RoleOut, UserCreate, UserListResponse, UserOut
from app.services.user_service import UserService

router = APIRouter(prefix='/api/v1/users', tags=['users'])


@router.get('', response_model=UserListResponse)
def list_users(db: Session = Depends(get_db), user=Depends(require_permissions('users:read'))):
    repository = UserRepository(db)
    service = UserService(repository)
    users = service.list_users()
    return {
        'total': len(users),
        'items': [
            UserOut(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                is_active=user.is_active,
                created_at=user.created_at,
                roles=[RoleOut(id=role.id, name=role.name, description=role.description, permissions=[]) for role in user.roles],
            )
            for user in users
        ],
    }


@router.post('', response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db), user=Depends(require_permissions('users:write'))):
    repository = UserRepository(db)
    service = UserService(repository)
    created = service.create_user(payload)
    return UserOut(
        id=created.id,
        email=created.email,
        full_name=created.full_name,
        is_active=created.is_active,
        created_at=created.created_at,
        roles=[RoleOut(id=role.id, name=role.name, description=role.description, permissions=[]) for role in created.roles],
    )


@router.get('/roles')
def list_roles(db: Session = Depends(get_db), user=Depends(require_permissions('roles:read'))):
    repository = UserRepository(db)
    service = UserService(repository)
    roles = service.get_roles()
    return [
        {
            'id': role.id,
            'name': role.name,
            'description': role.description,
            'permissions': [
                {'id': permission.id, 'code': permission.code, 'name': permission.name, 'description': permission.description}
                for permission in role.permissions
            ],
        }
        for role in roles
    ]


@router.get('/permissions')
def list_permissions(db: Session = Depends(get_db), user=Depends(require_permissions('permissions:read'))):
    repository = UserRepository(db)
    service = UserService(repository)
    permissions = service.get_permissions()
    return [
        {
            'id': permission.id,
            'code': permission.code,
            'name': permission.name,
            'description': permission.description,
        }
        for permission in permissions
    ]
