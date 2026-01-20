# Project T - Travel Booking Platform

A comprehensive travel booking platform with multi-source authentication, OTP verification, and scheduled notifications.

## 🏗️ Architecture

### Backend Stack
- **Framework**: FastAPI (Python 3.12)
- **Database**: PostgreSQL with SQLModel ORM
- **Cache/Queue**: Redis
- **Task Queue**: Taskiq with Redis backend
- **Authentication**: JWT with multi-source support
- **SMS**: Twilio
- **Email**: SendGrid
- **Storage**: AWS S3

### Multi-Source System
The platform supports three distinct user sources:
- **Mobile App** (`mobile_app`) - Phone-based authentication with OTP
- **Admin Panel** (`admin_panel`) - Email-based authentication
- **Providers Panel** (`providers_panel`) - Email-based authentication

Each source maintains separate user accounts, allowing the same email/phone to exist across different sources.

## 🔐 Authentication & Verification

### Phone OTP Verification (Mobile App)
**Status**: ✅ COMPLETED

Mobile users authenticate exclusively via phone number with OTP verification:

1. **Send OTP**: `POST /api/v1/otp/send-otp`
   - Sends 6-digit OTP via SMS
   - Rate limited: 3 requests per hour per phone
   - OTP expires in 5 minutes

2. **Verify OTP**: `POST /api/v1/otp/verify-otp-registration`
   - Validates OTP code
   - Returns verification token (valid 15 minutes)
   - Marks phone as verified

3. **Register**: `POST /api/v1/register`
   - Requires verification token from step 2
   - Creates user account with verified phone
   - Mobile users provide ONLY phone (no email)

### Email Verification (Admin/Provider)
- Traditional email/password authentication
- Email verification via token link
- Password reset via email

### User Profile Updates with Re-verification
Users can update their email/phone, but changes require re-verification:

**Endpoint**: `PATCH /api/v1/users/me`

- **Name/Password**: Update directly without verification
- **Email Change**: Requires `email_verification_token` from OTP flow
- **Phone Change**: Requires `phone_verification_token` from OTP flow

## 📋 Rate Limiting Configuration

All rate limits are configurable via environment variables:

```bash
# OTP Rate Limits
OTP_SEND_MAX_REQUESTS=3              # Max OTP requests per window
OTP_SEND_WINDOW_SECONDS=3600         # Rate limit window (1 hour)
OTP_VERIFY_MAX_REQUESTS=5            # Max verification attempts
OTP_VERIFY_WINDOW_SECONDS=300        # Verification window (5 minutes)

# OTP Expiry
OTP_CODE_EXPIRY_SECONDS=300          # OTP code validity (5 minutes)
OTP_VERIFICATION_TOKEN_EXPIRY_SECONDS=900  # Token validity (15 minutes)

# Verification Rate Limits
VERIFICATION_SEND_MAX_REQUESTS=3
VERIFICATION_SEND_WINDOW_SECONDS=3600
```

See `RATE_LIMITING.md` for detailed documentation.

## 🔔 Scheduled Tasks (Taskiq)

The platform uses Taskiq for background scheduled tasks:

### Trip Reminders
- **Schedule**: Daily at 9 AM
- **Purpose**: Remind users of trips starting tomorrow
- **Delivery**: SMS (if phone verified) or Email (if email verified)

### Review Reminders
- **Schedule**: Daily at 8 PM
- **Purpose**: Request reviews for trips that ended yesterday
- **Delivery**: SMS or Email
- **Logic**: Skips users who already submitted reviews

### Payment Reminders
- **Schedule**: Every 6 hours
- **Purpose**: Remind users with pending payments
- **Delivery**: SMS or Email
- **Logic**: Only for bookings older than 1 hour

### Docker Services
```yaml
services:
  redis:
    image: redis:7-alpine
    
  taskiq-worker:
    build: ./backend
    command: bash taskiq-worker-start.sh
    depends_on: [redis, db]
    
  taskiq-scheduler:
    build: ./backend
    command: bash taskiq-scheduler-start.sh
    depends_on: [redis, db]
```

## 🧪 Testing

### Test Coverage
- **Total Tests**: 225 tests
- **Status**: ✅ All passing

### Test Suites
1. **OTP Tests** (`test_otp.py`) - 12 tests
   - OTP sending and verification
   - Rate limiting
   - Registration flow with tokens
   
2. **User Profile Tests** (`test_users_profile.py`) - 12 tests
   - Profile updates
   - Email/phone re-verification
   - Validation and error handling

3. **Auth Tests** (`test_auth.py`) - Multiple tests
   - Login, registration, password reset
   - Multi-source authentication
   
4. **Worker Tests** (`test_worker.py`) - 10 tests
   - Trip, review, and payment reminders
   - Error handling

### Running Tests
```bash
# All tests
docker exec project-t-mono-backend-1 pytest app/tests/ -v

# Specific test file
docker exec project-t-mono-backend-1 pytest app/tests/api/routes/test_otp.py -v

# With coverage
docker exec project-t-mono-backend-1 pytest app/tests/ --cov=app --cov-report=html
```

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- Python 3.12+ (for local development)
- PostgreSQL 15+
- Redis 7+

### Environment Setup
1. Copy `.env.example` to `.env`:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Configure required services:
   - Twilio credentials (SMS)
   - SendGrid API key (Email)
   - AWS S3 credentials (Storage)
   - Database connection
   - Redis connection

### Running with Docker
```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f backend

# Stop services
docker compose down
```

### Database Migrations
```bash
# Run migrations
docker exec project-t-mono-backend-1 alembic upgrade head

# Create new migration
docker exec project-t-mono-backend-1 alembic revision --autogenerate -m "description"
```

## 📁 Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── routes/          # API endpoints
│   │       ├── auth.py      # Authentication
│   │       ├── otp.py       # OTP verification
│   │       ├── users.py     # User management
│   │       └── ...
│   ├── core/
│   │   ├── config.py        # Configuration
│   │   ├── security.py      # JWT & password hashing
│   │   └── taskiq_app.py    # Taskiq setup
│   ├── models/              # Database models
│   ├── schemas/             # Pydantic schemas
│   ├── services/            # External services
│   │   ├── sms.py          # Twilio SMS
│   │   ├── email.py        # SendGrid email
│   │   └── storage.py      # AWS S3
│   ├── tasks/
│   │   └── worker.py       # Taskiq scheduled tasks
│   ├── tests/              # Unit tests
│   └── crud/               # Database operations
├── alembic/                # Database migrations
├── docker-compose.yml      # Docker services
├── pyproject.toml         # Python dependencies
└── .env.example           # Environment template
```

## 📚 Key Documentation Files

- `RATE_LIMITING.md` - Rate limiting configuration and usage
- `pre_mobile_plan.md` - Mobile app implementation plan and progress
- `backend/.env.example` - Environment variables reference

## 🔧 Development

### Adding New Features
1. Create database models in `app/models/`
2. Create Pydantic schemas in `app/schemas/`
3. Implement CRUD operations in `app/crud/`
4. Create API routes in `app/api/routes/`
5. Write unit tests in `app/tests/`
6. Update documentation

### Code Quality
- Follow PEP 8 style guide
- Use type hints
- Write comprehensive tests
- Document complex logic

## 🐛 Troubleshooting

### Common Issues

**OTP not received**
- Check Twilio credentials in `.env`
- Verify phone number format (+966...)
- Check Twilio account balance

**Redis connection errors**
- Ensure Redis service is running
- Check `REDIS_URL` in `.env`

**Database migrations fail**
- Check database connection
- Ensure migrations are in correct order
- Review migration files for conflicts

## 📝 API Documentation

Once running, access interactive API docs:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 🤝 Contributing

1. Create feature branch
2. Implement changes with tests
3. Ensure all tests pass
4. Update documentation
5. Submit pull request

## 📄 License

[Add your license here]
