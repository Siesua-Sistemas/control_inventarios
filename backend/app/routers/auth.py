from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, LogoutRequest, RefreshRequest, TokenResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix='/api/v1/auth', tags=['auth'])


@router.post('/login', response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    repository = UserRepository(db)
    service = AuthService(repository)
    user = service.authenticate(payload.email, payload.password)
    access_token, refresh_token = service.create_tokens(user)
    service.store_refresh_token(user.id, refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post('/refresh', response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    repository = UserRepository(db)
    service = AuthService(repository)
    access_token, refresh_token = service.refresh_tokens(payload.refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post('/logout')
def logout(payload: LogoutRequest, db: Session = Depends(get_db)):
    repository = UserRepository(db)
    service = AuthService(repository)
    service.logout(payload.refresh_token)
    return {'message': 'Sesión cerrada correctamente'}


@router.get('/me')
def me(user=Depends(get_current_user)):
    return {
        'id': user.id,
        'email': user.email,
        'full_name': user.full_name,
        'roles': [role.name for role in user.roles],
        'permissions': [permission.code for role in user.roles for permission in role.permissions],
    }
