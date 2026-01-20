# Project T - System Architecture

## Overview

Project T is a multi-tenant travel booking platform with source-based user segregation, OTP verification, and automated notification systems.

## Core Concepts

### Multi-Source Architecture

The system supports three independent user sources, each with isolated user bases:

```
┌─────────────────────────────────────────────────────────┐
│                    User Sources                          │
├─────────────────────────────────────────────────────────┤
│  mobile_app      │  admin_panel   │  providers_panel    │
│  (Phone-based)   │  (Email-based) │  (Email-based)      │
│                  │                │                      │
│  - OTP Auth      │  - Email Auth  │  - Email Auth       │
│  - Phone Only    │  - Email+Phone │  - Email+Phone      │
│  - Travelers     │  - Admins      │  - Tour Providers   │
└─────────────────────────────────────────────────────────┘
```

**Key Principle**: Same email/phone can exist across different sources as separate accounts.

### Authentication Flow

#### Mobile App (Phone OTP)
```
User → Send OTP → Verify OTP → Get Token → Register/Login
       (SMS)      (6-digit)    (15min)     (Account)
```

#### Admin/Provider (Email)
```
User → Register → Verify Email → Login
       (Email)    (Token Link)   (JWT)
```

### Database Schema

#### Core Models

**User**
- Multi-source support via `source` field
- Separate verification flags: `is_phone_verified`, `is_email_verified`
- Role-based access: `NORMAL`, `SUPER_USER`

**Trip**
- Created by providers
- Linked to provider via `provider_id`
- Date-based scheduling

**Booking**
- Links users to trips
- Status tracking: `pending`, `confirmed`, `cancelled`
- Payment tracking

**Review**
- User feedback on completed trips
- Rating (1-5) and comment

## Service Architecture

### Backend Services

```
┌──────────────────────────────────────────────────────┐
│                   FastAPI Backend                     │
├──────────────────────────────────────────────────────┤
│  API Routes                                           │
│  ├── /api/v1/auth        (Login, Register, Reset)   │
│  ├── /api/v1/otp         (Send, Verify OTP)         │
│  ├── /api/v1/users       (Profile, Update)          │
│  ├── /api/v1/trips       (Browse, Book)             │
│  ├── /api/v1/bookings    (Manage Bookings)          │
│  └── /api/v1/reviews     (Submit Reviews)           │
└──────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    PostgreSQL             Redis              External APIs
    (Data Store)      (Cache/Queue)      (Twilio, SendGrid, S3)
```

### Background Workers (Taskiq)

```
┌─────────────────────────────────────────────────────┐
│              Taskiq Scheduler                        │
├─────────────────────────────────────────────────────┤
│  Trip Reminders      → Daily @ 9 AM                 │
│  Review Reminders    → Daily @ 8 PM                 │
│  Payment Reminders   → Every 6 hours                │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Taskiq Worker                           │
├─────────────────────────────────────────────────────┤
│  - Query database for due notifications             │
│  - Send SMS via Twilio                              │
│  - Send Email via SendGrid                          │
│  - Log results                                      │
└─────────────────────────────────────────────────────┘
```

## Data Flow

### OTP Registration Flow

```
┌──────┐    1. Send OTP     ┌─────────┐    2. Store OTP    ┌───────┐
│Client│ ─────────────────→ │ Backend │ ─────────────────→ │ Redis │
└──────┘                    └─────────┘                    └───────┘
   │                             │
   │                             ▼
   │                        ┌────────┐
   │                        │ Twilio │ (Send SMS)
   │                        └────────┘
   │
   │        3. Verify OTP
   │ ─────────────────────────────→
   │                             │
   │                             ▼
   │                        Check Redis
   │                             │
   │        4. Token         ┌───▼────┐
   │ ←─────────────────────  │ Valid? │
   │                         └────────┘
   │
   │        5. Register
   │ ─────────────────────────────→
   │                             │
   │                             ▼
   │                        ┌──────────┐
   │        6. JWT          │PostgreSQL│
   │ ←───────────────────── └──────────┘
```

### Profile Update with Re-verification

```
User wants to change phone/email
         │
         ▼
1. Send OTP to NEW phone/email
         │
         ▼
2. Verify OTP → Get verification_token
         │
         ▼
3. PATCH /users/me with:
   - new_phone/new_email
   - phone_verification_token/email_verification_token
         │
         ▼
4. Backend validates token matches new contact
         │
         ▼
5. Update user record + mark as verified
```

## Security Architecture

### Rate Limiting

**Redis-based rate limiting** prevents abuse:

```
Key Pattern: {action}_rate_limit:{identifier}
Value: Request count
TTL: Window duration

Example:
  otp_rate_limit:+966501234567 → 2 (expires in 3600s)
```

**Configurable Limits**:
- OTP Send: 3 requests/hour per phone
- OTP Verify: 5 attempts/5min per phone
- Email Verification: 3 requests/hour per email

### Token Management

**OTP Codes** (Redis)
- Key: `phone_otp:{phone}` or `email_otp:{email}`
- Value: Hashed 6-digit code
- TTL: 5 minutes

**Verification Tokens** (Redis)
- Key: `phone_verified:{token}` or `email_verified:{token}`
- Value: JSON with phone/email and metadata
- TTL: 15 minutes

**JWT Tokens**
- Access Token: 30 minutes
- Refresh Token: 7 days
- Stored in HTTP-only cookies

### Password Security

- **Hashing**: bcrypt with automatic salt
- **Validation**: Min 8 chars, complexity requirements
- **Reset**: Time-limited tokens via Redis

## Notification System

### Delivery Priority

```
For each notification:
  1. Check if user has verified phone → Send SMS
  2. Else check if user has verified email → Send Email
  3. Else log warning (no verified contact)
```

### Notification Types

**Trip Reminders**
- Trigger: 24 hours before trip start
- Content: Trip details, start time, preparation tips

**Review Reminders**
- Trigger: 24 hours after trip end
- Content: Request feedback, rating link
- Skip: If user already submitted review

**Payment Reminders**
- Trigger: Bookings pending > 1 hour
- Content: Payment link, booking details
- Frequency: Every 6 hours until paid/cancelled

## Scalability Considerations

### Horizontal Scaling

**Backend API**
- Stateless design
- JWT authentication (no session storage)
- Can run multiple instances behind load balancer

**Taskiq Workers**
- Multiple workers can process tasks concurrently
- Redis ensures task distribution
- Idempotent task design

### Database Optimization

**Indexes**:
- User: `(email, source)`, `(phone, source)`
- Trip: `start_date`, `end_date`, `provider_id`
- Booking: `user_id`, `trip_id`, `status`, `created_at`

**Queries**:
- Use SQLModel's `select()` for type safety
- Eager loading for relationships
- Pagination for list endpoints

### Caching Strategy

**Redis Usage**:
1. Rate limiting counters
2. OTP codes and verification tokens
3. Session data (future)
4. Frequently accessed data (future)

## Monitoring & Logging

### Logging Levels

```python
DEBUG   → Development details
INFO    → Normal operations (task runs, API calls)
WARNING → Recoverable issues (missing contact info)
ERROR   → Failures requiring attention
```

### Key Metrics to Monitor

- OTP send/verify success rates
- API response times
- Database query performance
- Task execution times
- Redis memory usage
- Failed notification count

## Deployment Architecture

### Docker Compose Services

```yaml
services:
  db:           PostgreSQL database
  redis:        Cache and task queue
  backend:      FastAPI application
  taskiq-worker:    Background task processor
  taskiq-scheduler: Task scheduler
```

### Environment Configuration

**Development**: `.env` file with local services
**Production**: Environment variables via orchestration platform

### Health Checks

- `/health` endpoint for API
- Database connection check
- Redis connection check
- External service availability

## Future Enhancements

### Planned Features

1. **WebSocket Support**
   - Real-time booking updates
   - Live chat support

2. **Advanced Caching**
   - Trip search results
   - User preferences
   - Popular destinations

3. **Analytics**
   - User behavior tracking
   - Booking patterns
   - Revenue metrics

4. **Multi-language Support**
   - i18n for notifications
   - Localized content

5. **Payment Integration**
   - Stripe/PayPal integration
   - Automated refunds
   - Payment webhooks

### Scalability Roadmap

1. **Phase 1**: Current (Single instance)
2. **Phase 2**: Load balancer + Multiple API instances
3. **Phase 3**: Database read replicas
4. **Phase 4**: Microservices architecture
5. **Phase 5**: Global CDN + Regional databases

## Development Guidelines

### Adding New Features

1. **Database Changes**
   - Create migration: `alembic revision --autogenerate`
   - Test migration up/down
   - Update models and schemas

2. **API Endpoints**
   - Define route in appropriate file
   - Add authentication/authorization
   - Implement business logic
   - Add input validation

3. **Background Tasks**
   - Define task in `worker.py`
   - Set appropriate schedule
   - Handle errors gracefully
   - Add logging

4. **Testing**
   - Write unit tests for new code
   - Test edge cases
   - Verify rate limiting
   - Check error handling

### Code Standards

- Type hints for all functions
- Docstrings for public APIs
- Error handling with appropriate HTTP codes
- Logging for debugging and monitoring
- Security: Validate all inputs, sanitize outputs

## Troubleshooting Guide

### Common Issues

**OTP Not Received**
- Check Twilio credentials
- Verify phone number format
- Check Twilio logs
- Verify SMS service is not blocked

**Task Not Running**
- Check taskiq-scheduler logs
- Verify Redis connection
- Check cron schedule syntax
- Ensure worker is running

**Database Connection Errors**
- Verify DATABASE_URL
- Check PostgreSQL is running
- Verify network connectivity
- Check connection pool settings

**Rate Limit Issues**
- Check Redis for rate limit keys
- Verify rate limit configuration
- Clear Redis keys if needed for testing
- Review rate limit logs
