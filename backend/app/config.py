from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

    DATABASE_URL: str = 'postgresql+psycopg2://postgres:postgres@localhost:5432/inventory'
    SECRET_KEY: str = 'change-me'
    REFRESH_SECRET_KEY: str = 'change-me-refresh'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = 'HS256'
    CORS_ORIGINS: str = 'http://localhost:3000'
    SEED_ADMIN_EMAIL: str = 'admin@inventario.local'
    SEED_ADMIN_PASSWORD: str = ''


settings = Settings()
