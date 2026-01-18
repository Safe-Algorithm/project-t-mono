# Development Workflow Hints

This file contains important instructions and reminders for working with this project. Read this file before performing common development tasks.

---

## 🐳 **Docker Environment**

### **Important: All services run in Docker containers**

The project uses Docker Compose with the following services:
- `project-t-mono-backend-1` - FastAPI backend
- `project-t-mono-db-1` - PostgreSQL database
- `project-t-mono-admin-panel-1` - Next.js admin panel
- `project-t-mono-providers-panel-1` - Next.js providers panel
- `vibe-mono-redis-1` - Redis cache
- `vibe-mono-pgadmin-1` - pgAdmin interface
- `redisinsight` - Redis GUI

### **Check running containers**
```bash
docker ps
```

### **Start all services**
```bash
cd /home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono
docker-compose up -d
```

### **Stop all services**
```bash
docker-compose down
```

### **View logs**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f db
```

---

## 🗄️ **Database Migrations**

### **⚠️ CRITICAL: Migrations MUST run inside Docker container**

**DO NOT** run migrations from the host machine using `poetry run alembic`. The database hostname "db" only resolves inside the Docker network.

### **Correct way to run migrations**

```bash
# Apply all pending migrations
docker exec project-t-mono-backend-1 alembic upgrade head

# Check current migration version
docker exec project-t-mono-backend-1 alembic current

# View migration history
docker exec project-t-mono-backend-1 alembic history

# Rollback one migration
docker exec project-t-mono-backend-1 alembic downgrade -1

# Create new migration
docker exec project-t-mono-backend-1 alembic revision -m "description"

# Auto-generate migration from model changes
docker exec project-t-mono-backend-1 alembic revision --autogenerate -m "description"
```

### **Migration file location**
```
backend/alembic/versions/
```

---

## 🧪 **Running Unit Tests**

### **⚠️ CRITICAL: Tests MUST run inside Docker container**

Tests use the backend container which has access to Redis and proper environment variables.

### **Run all tests**
```bash
docker exec project-t-mono-backend-1 pytest
```

### **Run tests with verbose output**
```bash
docker exec project-t-mono-backend-1 pytest -v
```

### **Run specific test file**
```bash
docker exec project-t-mono-backend-1 pytest app/tests/api/routes/test_trips.py
```

### **Run specific test function**
```bash
docker exec project-t-mono-backend-1 pytest app/tests/api/routes/test_trips.py::test_search_trips_by_name -v
```

### **Run tests with coverage**
```bash
docker exec project-t-mono-backend-1 pytest --cov=app --cov-report=html
```

### **Run tests and stop on first failure**
```bash
docker exec project-t-mono-backend-1 pytest -x
```

### **Test file locations**
```
backend/app/tests/
├── api/
│   └── routes/
│       ├── test_auth.py
│       ├── test_trips.py
│       ├── test_admin.py
│       └── test_providers.py
└── conftest.py  # Test fixtures and configuration
```

---

## 📦 **Python Dependencies**

### **Add new dependency**
```bash
# Enter backend container
docker exec -it project-t-mono-backend-1 bash

# Inside container
poetry add package-name

# Or for dev dependencies
poetry add --group dev package-name
```

### **Update dependencies**
```bash
docker exec -it project-t-mono-backend-1 poetry update
```

---

## 🔌 **3rd Party Integrations**

### **Available Services**

The project has integrated services for:
1. **Backblaze B2** - Object storage (images, files)
2. **Twilio** - SMS notifications
3. **SendGrid** - Email notifications
4. **Checkout.com** - Payment processing

### **Configuration**

All credentials are stored in `backend/app/core/config.py` and can be overridden via environment variables.

**⚠️ IMPORTANT**: The `accounts.txt` file in the project root contains all API keys and credentials. This file is gitignored for security.

### **Usage Examples**

#### **1. Backblaze B2 (Object Storage)**

```python
from app.services.storage import storage_service

# Upload a file
result = await storage_service.upload_file(
    file_data=image_bytes,
    file_name="profile.jpg",
    content_type="image/jpeg",
    folder="avatars"
)
# Returns: {"fileId": "...", "fileName": "...", "downloadUrl": "..."}

# Delete a file
await storage_service.delete_file(file_id="...", file_name="...")

# Get file info
info = await storage_service.get_file_info(file_id="...")
```

#### **2. Twilio SMS**

```python
from app.services.sms import sms_service

# Send OTP
result = await sms_service.send_otp(
    to_phone="+966501234567",
    otp_code="123456"
)

# Send trip reminder
await sms_service.send_trip_reminder(
    to_phone="+966501234567",
    trip_name="Desert Safari",
    start_date="2026-02-01"
)

# Send booking confirmation
await sms_service.send_booking_confirmation(
    to_phone="+966501234567",
    trip_name="Desert Safari",
    booking_reference="BOOK123456"
)
```

#### **3. SendGrid Email**

```python
from app.services.email import email_service

# Send verification email
result = await email_service.send_verification_email(
    to_email="user@example.com",
    to_name="John Doe",
    verification_token="abc123",
    verification_url="https://app.com/verify"
)

# Send password reset
await email_service.send_password_reset_email(
    to_email="user@example.com",
    to_name="John Doe",
    reset_token="xyz789",
    reset_url="https://app.com/reset"
)

# Send booking confirmation
await email_service.send_booking_confirmation_email(
    to_email="user@example.com",
    to_name="John Doe",
    trip_name="Desert Safari",
    booking_reference="BOOK123456",
    start_date="2026-02-01",
    total_amount="1500 SAR"
)
```

#### **4. Checkout.com Payment**

```python
from app.services.payment import payment_service
from decimal import Decimal

# Create payment
result = await payment_service.create_payment(
    amount=Decimal("1500.00"),
    currency="SAR",
    reference="BOOK123",
    customer_email="user@example.com",
    customer_name="John Doe",
    metadata={"trip_id": "trip_123"}
)
# Returns: {"payment_id": "...", "status": "...", "redirect_url": "..."}

# Get payment details
details = await payment_service.get_payment_details(payment_id="...")

# Refund payment
refund = await payment_service.refund_payment(
    payment_id="...",
    amount=Decimal("1500.00"),  # Optional, full refund if not specified
    reference="REFUND_123"
)

# Verify webhook signature
is_valid = payment_service.verify_webhook_signature(
    payload=request_body,
    signature=request.headers["Cko-Signature"],
    secret=webhook_secret
)
```

### **Testing Integrations**

```bash
# Run all integration tests
docker exec project-t-mono-backend-1 pytest app/tests/services/ -v

# Run specific service tests
docker exec project-t-mono-backend-1 pytest app/tests/services/test_storage.py -v
docker exec project-t-mono-backend-1 pytest app/tests/services/test_sms.py -v
docker exec project-t-mono-backend-1 pytest app/tests/services/test_email.py -v
docker exec project-t-mono-backend-1 pytest app/tests/services/test_payment.py -v
```

### **Service Files**

```
backend/app/services/
├── storage.py   # Backblaze B2 integration
├── sms.py       # Twilio SMS integration
├── email.py     # SendGrid email integration
└── payment.py   # Checkout.com payment integration
```

### **Test Coverage**

All services have comprehensive unit tests:
- ✅ 40 integration tests passing
- ✅ Storage: 8 tests (upload, delete, auth, etc.)
- ✅ SMS: 9 tests (send, OTP, reminders, etc.)
- ✅ Email: 10 tests (verification, reset, booking, etc.)
- ✅ Payment: 13 tests (create, capture, refund, webhooks, etc.)

---

## 🔧 **Backend Development**

### **Access backend container shell**
```bash
docker exec -it project-t-mono-backend-1 bash
```

### **Backend runs on**
- URL: http://localhost:8000
- API Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### **Restart backend after code changes**
```bash
docker-compose restart backend
```

**Note:** Backend has hot-reload enabled, so most changes don't require restart.

---

## 🎨 **Frontend Development**

### **Admin Panel**
- URL: http://localhost:3001
- Container: `project-t-mono-admin-panel-1`

### **Providers Panel**
- URL: http://localhost:3002
- Container: `project-t-mono-providers-panel-1`

### **Access frontend container**
```bash
# Admin panel
docker exec -it project-t-mono-admin-panel-1 sh

# Providers panel
docker exec -it project-t-mono-providers-panel-1 sh
```

### **Install npm packages**
```bash
# Admin panel
docker exec -it project-t-mono-admin-panel-1 npm install package-name

# Providers panel
docker exec -it project-t-mono-providers-panel-1 npm install package-name
```

### **Restart frontend after changes**
```bash
docker-compose restart admin-panel
docker-compose restart providers-panel
```

---

## 🗃️ **Database Access**

### **PostgreSQL Database**
- Host: localhost
- Port: 5432
- Database: project_t
- User: postgres
- Password: postgres

### **Access database via psql**
```bash
docker exec -it project-t-mono-db-1 psql -U postgres -d project_t
```

### **Common psql commands**
```sql
\dt              -- List all tables
\d table_name    -- Describe table
\di              -- List indexes
\q               -- Quit
```

### **pgAdmin Web Interface**
- URL: http://localhost:5013
- Email: admin@admin.com
- Password: admin

---

## 🔴 **Redis**

### **Redis CLI**
```bash
docker exec -it vibe-mono-redis-1 redis-cli
```

### **RedisInsight GUI**
- URL: http://localhost:6380

### **Common Redis commands**
```bash
KEYS *           # List all keys
GET key          # Get value
DEL key          # Delete key
FLUSHALL         # Clear all data (use with caution!)
```

---

## 🐛 **Debugging**

### **View backend logs**
```bash
docker-compose logs -f backend
```

### **View database logs**
```bash
docker-compose logs -f db
```

### **Check container status**
```bash
docker ps -a
```

### **Restart specific service**
```bash
docker-compose restart backend
docker-compose restart db
```

### **Rebuild containers after dependency changes**
```bash
docker-compose up -d --build
```

---

## 📝 **Common Workflows**

### **After pulling new code**
```bash
# 1. Rebuild containers if dependencies changed
docker-compose up -d --build

# 2. Run migrations
docker exec project-t-mono-backend-1 alembic upgrade head

# 3. Run tests to verify
docker exec project-t-mono-backend-1 pytest
```

### **Before committing code**
```bash
# 1. Run all tests
docker exec project-t-mono-backend-1 pytest -v

# 2. Check for any migration issues
docker exec project-t-mono-backend-1 alembic current
```

### **Creating a new feature**
```bash
# 1. Make code changes
# 2. Create migration if models changed
docker exec project-t-mono-backend-1 alembic revision --autogenerate -m "add_new_feature"

# 3. Review and edit migration file if needed
# 4. Apply migration
docker exec project-t-mono-backend-1 alembic upgrade head

# 5. Write tests
# 6. Run tests
docker exec project-t-mono-backend-1 pytest
```

---

## ⚠️ **Common Mistakes to Avoid**

1. **❌ Running migrations outside Docker**
   - Error: `could not translate host name "db"`
   - Solution: Use `docker exec project-t-mono-backend-1 alembic ...`

2. **❌ Running tests outside Docker**
   - Error: Redis connection errors, missing environment variables
   - Solution: Use `docker exec project-t-mono-backend-1 pytest ...`

3. **❌ Forgetting to apply migrations**
   - Error: Database schema mismatch
   - Solution: Always run `docker exec project-t-mono-backend-1 alembic upgrade head`

4. **❌ Not rebuilding after dependency changes**
   - Error: Import errors, missing packages
   - Solution: Run `docker-compose up -d --build`

5. **❌ Using wrong database credentials**
   - Inside Docker: hostname is `db`
   - From host: hostname is `localhost`

---

## 🔍 **Troubleshooting**

### **Database connection issues**
```bash
# Check if database is running
docker ps | grep db

# Check database logs
docker-compose logs db

# Restart database
docker-compose restart db
```

### **Backend not starting**
```bash
# Check logs
docker-compose logs backend

# Rebuild backend
docker-compose up -d --build backend
```

### **Tests failing**
```bash
# Check if Redis is running
docker ps | grep redis

# Clear test database
docker exec project-t-mono-backend-1 pytest --create-db

# Run with verbose output
docker exec project-t-mono-backend-1 pytest -vv
```

---

## 📚 **Important File Locations**

### **Backend**
- Models: `backend/app/models/`
- Schemas: `backend/app/schemas/`
- API Routes: `backend/app/api/routes/`
- CRUD: `backend/app/crud/`
- Tests: `backend/app/tests/`
- Migrations: `backend/alembic/versions/`
- Config: `backend/app/core/config.py`

### **Frontend**
- Admin Pages: `admin-panel/src/pages/`
- Admin Components: `admin-panel/src/components/`
- Provider Pages: `providers-panel/src/pages/`
- Provider Components: `providers-panel/src/components/`

### **Configuration**
- Docker Compose: `docker-compose.yml`
- Backend Env: `backend/.env`
- Alembic Config: `backend/alembic.ini`

---

## 🎯 **Quick Reference**

| Task | Command |
|------|---------|
| Run all tests | `docker exec project-t-mono-backend-1 pytest` |
| Run migrations | `docker exec project-t-mono-backend-1 alembic upgrade head` |
| Check migration status | `docker exec project-t-mono-backend-1 alembic current` |
| View backend logs | `docker-compose logs -f backend` |
| Access database | `docker exec -it project-t-mono-db-1 psql -U postgres -d project_t` |
| Backend shell | `docker exec -it project-t-mono-backend-1 bash` |
| Restart all services | `docker-compose restart` |
| Rebuild all | `docker-compose up -d --build` |

---

**Remember: When in doubt, check if the service is running in Docker and use `docker exec` to run commands inside the container!**
