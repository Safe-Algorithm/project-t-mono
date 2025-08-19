from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Tourism Marketplace"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "postgresql://user:password@db/db"

    # TODO: Replace with a real secret key
    SECRET_KEY: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # First superuser
    FIRST_SUPERUSER_EMAIL: str = "admin@example.com"
    FIRST_SUPERUSER_PASSWORD: str = "password"
    FIRST_SUPERUSER_NAME: str = "Admin"
    FIRST_SUPERUSER_PHONE: str = "1234567890"

    class Config:
        case_sensitive = True

settings = Settings()
