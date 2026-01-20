# Rate Limiting Configuration

This document describes the configurable rate limiting system for OTP verification, email verification, and password reset functionality.

## Overview

The application implements rate limiting to prevent abuse of sensitive operations like OTP requests, email verification, and password resets. All rate limits are configurable via environment variables.

## Environment Variables

### OTP Rate Limits

Control how many OTP requests can be made for phone and email verification:

| Variable | Default | Description |
|----------|---------|-------------|
| `OTP_MAX_ATTEMPTS` | `3` | Maximum number of OTP requests allowed per time window |
| `OTP_TIME_WINDOW_SECONDS` | `3600` | Time window in seconds (default: 1 hour) |
| `OTP_EXPIRY_SECONDS` | `300` | How long the OTP code remains valid (default: 5 minutes) |
| `OTP_VERIFICATION_TOKEN_EXPIRY_SECONDS` | `600` | How long the verification token remains valid after OTP verification (default: 10 minutes) |

### Email Verification Rate Limits

Control email verification link requests:

| Variable | Default | Description |
|----------|---------|-------------|
| `EMAIL_VERIFICATION_MAX_ATTEMPTS` | `3` | Maximum email verification requests per time window |
| `EMAIL_VERIFICATION_TIME_WINDOW_SECONDS` | `3600` | Time window in seconds (default: 1 hour) |

### Password Reset Rate Limits

Control password reset requests:

| Variable | Default | Description |
|----------|---------|-------------|
| `PASSWORD_RESET_MAX_ATTEMPTS` | `3` | Maximum password reset requests per time window |
| `PASSWORD_RESET_TIME_WINDOW_SECONDS` | `3600` | Time window in seconds (default: 1 hour) |

## Configuration Examples

### Development Environment (More Lenient)

For development, you might want to allow more attempts and shorter time windows:

```bash
# .env
OTP_MAX_ATTEMPTS=10
OTP_TIME_WINDOW_SECONDS=600  # 10 minutes
OTP_EXPIRY_SECONDS=600  # 10 minutes
OTP_VERIFICATION_TOKEN_EXPIRY_SECONDS=1800  # 30 minutes
```

### Production Environment (Strict)

For production, use stricter limits to prevent abuse:

```bash
# .env
OTP_MAX_ATTEMPTS=3
OTP_TIME_WINDOW_SECONDS=3600  # 1 hour
OTP_EXPIRY_SECONDS=300  # 5 minutes
OTP_VERIFICATION_TOKEN_EXPIRY_SECONDS=600  # 10 minutes

EMAIL_VERIFICATION_MAX_ATTEMPTS=3
EMAIL_VERIFICATION_TIME_WINDOW_SECONDS=3600

PASSWORD_RESET_MAX_ATTEMPTS=3
PASSWORD_RESET_TIME_WINDOW_SECONDS=3600
```

### High-Traffic Environment

For high-traffic scenarios where legitimate users might need more attempts:

```bash
# .env
OTP_MAX_ATTEMPTS=5
OTP_TIME_WINDOW_SECONDS=1800  # 30 minutes
OTP_EXPIRY_SECONDS=300  # 5 minutes
OTP_VERIFICATION_TOKEN_EXPIRY_SECONDS=900  # 15 minutes
```

## Affected Endpoints

### OTP Endpoints

The following endpoints are affected by OTP rate limits:

- `POST /api/v1/otp/send-otp` - Send OTP to authenticated user's phone
- `POST /api/v1/otp/send-otp-registration` - Send OTP during phone registration
- `POST /api/v1/otp/send-email-otp-registration` - Send OTP during email registration

### Rate Limit Behavior

When a user exceeds the rate limit:

1. **HTTP 429 (Too Many Requests)** is returned
2. Error message includes the time to wait: `"Too many OTP requests. Please try again in X minutes."`
3. The rate limit counter is stored in Redis with the configured time window
4. After successful OTP verification, the rate limit is cleared for that contact method

## Implementation Details

### Redis Keys

Rate limits are tracked using Redis with the following key patterns:

- `otp_rate_limit:{phone}` - For phone OTP requests
- `otp_rate_limit:{email}` - For email OTP requests
- `phone_otp:{phone}` - Stores the actual OTP code
- `email_otp_registration:{email}` - Stores email OTP code
- `phone_verified:{token}` - Stores verification token after successful OTP
- `email_verified:{token}` - Stores verification token after successful email OTP

### Rate Limit Reset

Rate limits are automatically reset when:

1. The time window expires (configured by `*_TIME_WINDOW_SECONDS`)
2. The user successfully verifies their OTP (rate limit is cleared immediately)

## Monitoring and Adjustments

### When to Increase Limits

Consider increasing rate limits if:

- Legitimate users frequently hit the limit
- You have good fraud detection in place
- Your SMS/email provider costs are acceptable
- You're in a testing/development phase

### When to Decrease Limits

Consider decreasing rate limits if:

- You're experiencing abuse or spam
- SMS/email costs are too high
- You want to enforce stricter security

### Monitoring Recommendations

Monitor these metrics:

1. **Rate limit hits** - How often users hit the limit
2. **OTP success rate** - Percentage of OTPs that are successfully verified
3. **Time to verification** - How long users take to verify OTPs
4. **Cost per verification** - SMS/email costs per successful verification

## Security Considerations

1. **Balance security and UX** - Too strict limits frustrate users, too lenient allows abuse
2. **Monitor for patterns** - Watch for suspicious patterns like:
   - Same IP requesting OTPs for many different numbers
   - Rapid sequential requests from the same user
   - High failure rates on OTP verification
3. **Consider additional measures**:
   - CAPTCHA after failed attempts
   - IP-based rate limiting
   - Device fingerprinting
   - Anomaly detection

## Troubleshooting

### Users Can't Receive OTP

1. Check if they've hit the rate limit (429 error)
2. Verify Redis is running and accessible
3. Check Twilio/SendGrid credentials and quotas
4. Review application logs for errors

### Rate Limits Too Strict

1. Increase `OTP_MAX_ATTEMPTS`
2. Decrease `OTP_TIME_WINDOW_SECONDS`
3. Consider clearing rate limits manually via Redis CLI if needed:
   ```bash
   redis-cli DEL "otp_rate_limit:+966501234567"
   ```

### Rate Limits Not Working

1. Verify environment variables are loaded correctly
2. Check Redis connection
3. Review application logs for Redis errors
4. Ensure settings are imported in the OTP routes

## Example Configuration Workflow

1. **Start with defaults** in production
2. **Monitor for 1-2 weeks** to understand usage patterns
3. **Adjust based on data**:
   - If < 1% of users hit limits: Keep current settings
   - If 1-5% hit limits: Increase by 50%
   - If > 5% hit limits: Double the limits or investigate abuse
4. **Re-evaluate quarterly** based on growth and abuse patterns

## Related Documentation

- [OTP Implementation](./docs/otp-implementation.md)
- [Email Service](./docs/email-service.md)
- [SMS Service](./docs/sms-service.md)
- [Redis Configuration](./docs/redis-configuration.md)
