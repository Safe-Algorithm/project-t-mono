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

    # Moyasar (Payment Gateway)
    MOYASAR_API_KEY: str = ""  # Secret key - must be set via environment variable
    MOYASAR_API_URL: str = "https://api.moyasar.com/v1"
    MOYASAR_WEBHOOK_SECRET: str = ""  # Webhook secret for signature verification
    
    # Frontend URLs (for email links)
    FRONTEND_URL: str = "http://localhost:3000"  # Mobile app (default)
    ADMIN_PANEL_URL: str = "http://localhost:3001"  # Admin panel
    PROVIDERS_PANEL_URL: str = "http://localhost:3002"  # Providers panel
    
    # Rate Limiting Configuration
    # OTP Rate Limits (max attempts per time window)
    OTP_MAX_ATTEMPTS: int = 3  # Maximum OTP requests per time window
    OTP_TIME_WINDOW_SECONDS: int = 3600  # Time window in seconds (default: 1 hour)
    OTP_EXPIRY_SECONDS: int = 300  # OTP code expiry time (default: 5 minutes)
    OTP_VERIFICATION_TOKEN_EXPIRY_SECONDS: int = 600  # Verification token expiry (default: 10 minutes)
    
    # Email Verification Rate Limits
    EMAIL_VERIFICATION_MAX_ATTEMPTS: int = 3  # Maximum email verification requests per time window
    EMAIL_VERIFICATION_TIME_WINDOW_SECONDS: int = 3600  # Time window in seconds (default: 1 hour)
    
    # Password Reset Rate Limits
    PASSWORD_RESET_MAX_ATTEMPTS: int = 3  # Maximum password reset requests per time window
    PASSWORD_RESET_TIME_WINDOW_SECONDS: int = 3600  # Time window in seconds (default: 1 hour)
    
    # Taskiq Scheduled Task Cron Schedules
    TASKIQ_TRIP_REMINDER_CRON: str = "0 9 * * *"  # Daily at 9 AM (24h before trip)
    TASKIQ_REVIEW_REMINDER_CRON: str = "0 20 * * *"  # Daily at 8 PM (after trip ends)
    TASKIQ_PAYMENT_REMINDER_CRON: str = "0 */6 * * *"  # Every 6 hours (pending payments)

    class Config:
        case_sensitive = True

settings = Settings()
