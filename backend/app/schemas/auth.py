from pydantic import BaseModel, field_validator
import email_validator as _ev


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        info = _ev.validate_email(v, check_deliverability=False)
        return info.normalized


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = 'bearer'


class AuthUserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    roles: list[str]
    permissions: list[str]
