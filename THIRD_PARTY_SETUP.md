# Third-Party Service Setup Guide

This document explains how to set up all third-party services required for the Safe Algo Tourism platform.

## 🚨 Critical Issue Found

**The email invitation you sent failed because the SendGrid API key is invalid/expired.**

Error from logs:
```
HTTP Request: POST https://api.sendgrid.com/v3/mail/send "HTTP/1.1 403 Forbidden"
```

## Required Services

### 1. SendGrid (Email Service) ⚠️ **CURRENTLY NOT WORKING**

**Purpose**: Send transactional emails (invitations, password resets, booking confirmations)

**Setup Steps**:
1. Go to [SendGrid](https://sendgrid.com/) and create an account
2. Navigate to Settings → API Keys: https://app.sendgrid.com/settings/api_keys
3. Click "Create API Key"
4. Name it (e.g., "Safe Algo Tourism Production")
5. Select "Full Access" or at minimum "Mail Send" permissions
6. Copy the API key (you'll only see it once!)
7. Add to your `.env` file:
   ```bash
   SENDGRID_API_KEY=SG.your-actual-api-key-here
   SENDGRID_FROM_EMAIL=noreply@safealgo.com  # Must be verified in SendGrid
   SENDGRID_FROM_NAME=Safe Algo Tourism
   ```

**Important Notes**:
- You must verify your sender email in SendGrid before sending emails
- Free tier: 100 emails/day
- The current hardcoded key in `config.py` is expired/invalid

---

### 2. Twilio (SMS Service)

**Purpose**: Send OTP codes and SMS notifications

**Setup Steps**:
1. Go to [Twilio Console](https://console.twilio.com/)
2. Create an account and verify your phone number
3. Get your credentials from the dashboard:
   - Account SID
   - Auth Token
4. Get a phone number from Twilio
5. Create a Messaging Service (optional but recommended)
6. Add to your `.env` file:
   ```bash
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_PHONE_NUMBER=+1234567890
   TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

**Current Status**: Credentials in `config.py` may be test/expired

---

### 3. Backblaze B2 (Object Storage)

**Purpose**: Store uploaded files (images, documents)

**Setup Steps**:
1. Go to [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html)
2. Create an account
3. Create a bucket for your application
4. Navigate to App Keys: https://secure.backblaze.com/app_keys.htm
5. Create a new application key with access to your bucket
6. Add to your `.env` file:
   ```bash
   BACKBLAZE_KEY_ID=your-key-id
   BACKBLAZE_APPLICATION_KEY=your-application-key
   BACKBLAZE_BUCKET_NAME=your-bucket-name
   BACKBLAZE_BUCKET_ID=  # Leave empty, will be fetched automatically
   ```

**Current Status**: Credentials in `config.py` may be test/expired

---

### 4. Checkout.com (Payment Gateway)

**Purpose**: Process payments for trip bookings

**Setup Steps**:
1. Go to [Checkout.com](https://www.checkout.com/)
2. Create an account
3. Navigate to Developers → API Keys: https://dashboard.checkout.com/
4. Get your Secret Key and Public Key
5. For testing, use sandbox credentials
6. Add to your `.env` file:
   ```bash
   CHECKOUT_SECRET_KEY=sk_test_your-secret-key
   CHECKOUT_PUBLIC_KEY=pk_test_your-public-key
   CHECKOUT_API_URL=https://api.sandbox.checkout.com  # Use production URL for live
   ```

**Current Status**: Credentials in `config.py` may be test/expired

---

## How to Configure

### Step 1: Create `.env` file

Copy the example file:
```bash
cd backend
cp .env.example .env
```

### Step 2: Fill in your credentials

Edit the `.env` file and replace all placeholder values with your actual credentials from the services above.

### Step 3: Restart the backend

```bash
docker-compose restart backend
```

### Step 4: Verify configuration

Check the logs to ensure services are connecting:
```bash
docker logs project-t-mono-backend-1 --tail 100
```

---

## Email Features That Need SendGrid

The following features **will not work** until you configure a valid SendGrid API key:

1. ✉️ **Team Invitations** (Provider and Admin)
   - Endpoint: `POST /api/v1/team/invite`
   - Endpoint: `POST /api/v1/admin/invite-admin`

2. ✉️ **Email Verification**
   - Endpoint: `POST /api/v1/send-verification-email`

3. ✉️ **Password Reset**
   - Endpoint: `POST /api/v1/forgot-password`

4. ✉️ **Booking Confirmations**
   - Automatic on trip registration

---

## Testing Email Sending

Once you've configured SendGrid, test it with:

```bash
# From the backend directory
docker exec -it project-t-mono-backend-1 python -c "
from app.services.email import email_service
import asyncio

async def test():
    result = await email_service.send_email(
        to_email='your-test-email@gmail.com',
        subject='Test Email',
        html_content='<h1>Test</h1><p>If you receive this, SendGrid is working!</p>',
        text_content='Test email from Safe Algo Tourism'
    )
    print(result)

asyncio.run(test())
"
```

---

## Current Configuration Issues

Based on the logs, here's what needs to be fixed:

1. ⚠️ **SendGrid API Key**: The hardcoded key is returning 403 Forbidden
2. ⚠️ **All credentials**: Currently hardcoded in `config.py` instead of environment variables
3. ⚠️ **No `.env` file**: The application is using default/test credentials

---

## Quick Fix for Email Issue

**To fix the email invitation issue immediately:**

1. Get a valid SendGrid API key (see instructions above)
2. Create/edit `backend/.env`:
   ```bash
   SENDGRID_API_KEY=SG.your-new-valid-key-here
   SENDGRID_FROM_EMAIL=noreply@safealgo.com
   SENDGRID_FROM_NAME=Safe Algo Tourism
   ```
3. Restart backend:
   ```bash
   docker-compose restart backend
   ```
4. Try sending the invitation again

---

## Security Best Practices

1. ✅ Never commit `.env` file to git (already in `.gitignore`)
2. ✅ Use different credentials for development and production
3. ✅ Rotate API keys regularly
4. ✅ Use environment-specific keys (test vs production)
5. ✅ Verify sender emails in SendGrid before going live

---

## Support Links

- **SendGrid**: https://docs.sendgrid.com/
- **Twilio**: https://www.twilio.com/docs
- **Backblaze B2**: https://www.backblaze.com/b2/docs/
- **Checkout.com**: https://docs.checkout.com/
