from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Tourism Marketplace"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "postgresql://user:password@db/db"
    REDIS_URL: str = "redis://redis:6379"

    # TODO: Replace with a real secret key
    SECRET_KEY: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # 15 minutes
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7  # 7 days

    # First superuser
    FIRST_SUPERUSER_EMAIL: str = "admin@example.com"
    FIRST_SUPERUSER_PASSWORD: str = "password"
    FIRST_SUPERUSER_NAME: str = "Admin"
    FIRST_SUPERUSER_PHONE: str = "1234567890"

    # Backblaze B2 (Object Storage)
    BACKBLAZE_KEY_ID: str = "003d9e183559ac50000000001"
    BACKBLAZE_APPLICATION_KEY: str = "K003yrhJasu2YEinOGra7l7vwLRa17o"
    BACKBLAZE_BUCKET_NAME: str = "Safe-Algo-Test-Bucket"
    BACKBLAZE_BUCKET_ID: str = ""  # Will be fetched on first use

    # Twilio (SMS)
    TWILIO_ACCOUNT_SID: str = "ACc2e937eac42b93871d7688d99987949a"
    TWILIO_AUTH_TOKEN: str = "144141840e925febcc8d58215faf2803"
    TWILIO_PHONE_NUMBER: str = "+18128182666"
    TWILIO_MESSAGING_SERVICE_SID: str = "MGaa171a12a0b31318ed0a20306a4b7dce"

    # SendGrid (Email)
    SENDGRID_API_KEY: str = ""  # Must be set via environment variable
    SENDGRID_FROM_EMAIL: str = "noreply@safealgo.com"
    SENDGRID_FROM_NAME: str = "Safe Algo Tourism"

    # Checkout.com (Payment Gateway)
    CHECKOUT_SECRET_KEY: str = "sk_sbox_p7gis5zzoeecmthcm7e4v4xfsu="
    CHECKOUT_PUBLIC_KEY: str = ""  # Set via environment variable
    CHECKOUT_API_URL: str = "https://g6ftayvr.api.sandbox.checkout.com"
    
    # Frontend URLs (for email links)
    FRONTEND_URL: str = "http://localhost:3000"  # Mobile app (default)
    ADMIN_PANEL_URL: str = "http://localhost:3001"  # Admin panel
    PROVIDERS_PANEL_URL: str = "http://localhost:3002"  # Providers panel

    class Config:
        case_sensitive = True

settings = Settings()
