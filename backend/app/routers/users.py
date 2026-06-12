from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permissions
from app.repositories.user_repository import UserRepository
from app.schemas.user import PermissionOut, RoleCreate, RoleOut, RoleUpdate, UserCreate, UserListResponse, UserOut, UserUpdate
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


@router.post('/roles', response_model=RoleOut)
def create_role(payload: RoleCreate, db: Session = Depends(get_db), user=Depends(require_permissions('roles:write'))):
    repository = UserRepository(db)
    service = UserService(repository)
    role = service.create_role(payload)
    return RoleOut(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=[PermissionOut(id=p.id, code=p.code, name=p.name, description=p.description) for p in role.permissions],
    )


@router.patch('/roles/{role_id}', response_model=RoleOut)
def update_role(role_id: int, payload: RoleUpdate, db: Session = Depends(get_db), user=Depends(require_permissions('roles:write'))):
    repository = UserRepository(db)
    service = UserService(repository)
    role = service.update_role(role_id, payload)
    return RoleOut(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=[PermissionOut(id=p.id, code=p.code, name=p.name, description=p.description) for p in role.permissions],
    )


@router.get('/{user_id}', response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), user=Depends(require_permissions('users:read'))):
    repository = UserRepository(db)
    service = UserService(repository)
    target = service.get_user(user_id)
    return UserOut(
        id=target.id,
        email=target.email,
        full_name=target.full_name,
        is_active=target.is_active,
        created_at=target.created_at,
        roles=[RoleOut(id=role.id, name=role.name, description=role.description, permissions=[]) for role in target.roles],
    )


@router.patch('/{user_id}', response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), user=Depends(require_permissions('users:write'))):
    repository = UserRepository(db)
    service = UserService(repository)
    target = service.update_user(user_id, payload)
    return UserOut(
        id=target.id,
        email=target.email,
        full_name=target.full_name,
        is_active=target.is_active,
        created_at=target.created_at,
        roles=[RoleOut(id=role.id, name=role.name, description=role.description, permissions=[]) for role in target.roles],
    )
