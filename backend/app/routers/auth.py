from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, LogoutRequest, RefreshRequest, TokenResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix='/api/v1/auth', tags=['auth'])


@router.post('/login', response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    from app.routers.portal import _get_ip, _log_access

    ip = _get_ip(request)
    ua = request.headers.get('user-agent', '')[:500]

    repository = UserRepository(db)
    service = AuthService(repository)
    try:
        user = service.authenticate(payload.email, payload.password)
    except HTTPException:
        _log_access(db, 'sistema', payload.email, ip, ua, 'fallido', 'Credenciales incorrectas')
        raise

    access_token, refresh_token = service.create_tokens(user)
    service.store_refresh_token(user.id, refresh_token)
    _log_access(db, 'sistema', payload.email, ip, ua, 'exitoso', user_id=user.id)
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
    home_dashboard = 'general'
    for role in user.roles:
        if role.home_dashboard != 'general':
            home_dashboard = role.home_dashboard
            break

    dominios: list[str] = []
    for role in user.roles:
        for d in (role.dominios or ['IT']):
            if d not in dominios:
                dominios.append(d)
    if not dominios:
        dominios = ['IT']

    return {
        'id': user.id,
        'email': user.email,
        'full_name': user.full_name,
        'roles': [role.name for role in user.roles],
        'permissions': [permission.code for role in user.roles for permission in role.permissions],
        'home_dashboard': home_dashboard,
        'dominios': dominios,
    }
