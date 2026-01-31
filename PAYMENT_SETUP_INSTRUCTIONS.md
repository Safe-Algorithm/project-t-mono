# Moyasar Payment Gateway - Setup & Testing Instructions

## 📋 Table of Contents
1. [Overview](#overview)
2. [Security & Auditing Features](#security--auditing-features)
3. [Getting Your Moyasar Credentials](#getting-your-moyasar-credentials)
4. [Backend Configuration](#backend-configuration)
5. [Frontend Configuration](#frontend-configuration)
6. [Local Development Without Webhooks](#local-development-without-webhooks)
7. [Testing Payment Flow](#testing-payment-flow)
8. [Production Deployment](#production-deployment)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This application uses **Moyasar** as the payment gateway. Moyasar is a Saudi Arabian payment processor that supports:
- 💳 **Mada** (Saudi local cards)
- 💳 **Visa & Mastercard**
- 🍎 **Apple Pay**
- 📱 **STC Pay**

### Architecture
- **Backend**: Handles payment creation, verification, refunds, and webhook processing
- **Frontend**: Displays payment UI using Moyasar's publishable key
- **Database**: Tracks all payments and maintains complete audit logs

---

## Security & Auditing Features

### ✅ What's Already Implemented

#### 1. **Payment Tracking Table** (`payments`)
Every payment is stored with:
- Payment ID (internal UUID)
- Moyasar payment ID
- Registration reference
- Amount, currency, status
- Payment method (creditcard, applepay, stcpay, mada)
- Refund tracking
- Fee tracking
- Timestamps for all events (created, paid, failed, refunded)
- Error messages for failed payments

#### 2. **Payment Audit Log Table** (`payment_audit_logs`)
Complete audit trail for compliance and security:
- **Every payment event is logged**: creation, status changes, API calls, webhooks
- **User tracking**: User ID, IP address, user agent
- **Request/Response data**: Full API request and response for debugging
- **Webhook verification**: Signature verification status
- **Error tracking**: Detailed error messages and codes
- **Indexed for fast queries**: By payment ID, user ID, event type, timestamp

#### 3. **Security Best Practices**
- ✅ Secret key stored in backend only (never exposed to frontend)
- ✅ Webhook signature verification (HMAC-SHA256)
- ✅ Payment status validation before processing
- ✅ User authorization checks (users can only pay for their own registrations)
- ✅ Duplicate payment prevention
- ✅ Complete audit trail for all payment actions
- ✅ IP address and user agent logging
- ✅ Error tracking and monitoring

#### 4. **Audit Service**
Automatic logging of:
- Payment creation
- Status changes
- Webhook receipts
- API calls to Moyasar
- Refund requests
- Failed transactions

---

## Getting Your Moyasar Credentials

### Step 1: Sign Up for Moyasar
1. Go to https://moyasar.com
2. Click "Sign Up" or "Get Started"
3. Complete the registration process
4. Verify your email

### Step 2: Get Test Credentials
1. Log in to Moyasar Dashboard
2. Go to **Settings** → **API Keys**
3. You'll see two keys:
   - **Secret Key** (starts with `sk_test_` for test mode)
   - **Publishable Key** (starts with `pk_test_` for test mode)

### Step 3: Get Webhook Secret (for production)
1. In Moyasar Dashboard, go to **Settings** → **Webhooks**
2. Add a webhook URL (your production domain + `/api/v1/payments/webhook`)
3. Copy the **Webhook Secret** provided

---

## Backend Configuration

### 1. Update `.env` File

```bash
# Moyasar Payment Gateway
MOYASAR_API_KEY=sk_test_YOUR_SECRET_KEY_HERE
MOYASAR_WEBHOOK_SECRET=your_webhook_secret_here
```

**Important Notes:**
- ⚠️ **Never commit the `.env` file to git**
- ⚠️ **Secret key must NEVER be exposed to frontend**
- ⚠️ Use test keys (`sk_test_`) for development
- ⚠️ Use live keys (`sk_live_`) only in production

### 2. Verify Configuration

```bash
# Check if backend can read the config
docker compose exec backend python -c "from app.core.config import settings; print(f'API Key configured: {bool(settings.MOYASAR_API_KEY)}')"
```

---

## Frontend Configuration

### Mobile App (React Native)

Add to your environment config (e.g., `.env` or `app.config.js`):

```javascript
MOYASAR_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
```

### Admin/Provider Panels (React)

Add to `.env.local`:

```bash
REACT_APP_MOYASAR_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
```

**Note:** Publishable key is safe to expose in frontend code.

---

## Local Development Without Webhooks

Since your app is running locally, Moyasar cannot send webhooks to `localhost`. Here's how to handle this:

### Option 1: Manual Payment Verification (Recommended for Local Dev)

After a user completes payment, they'll be redirected to your callback URL. The backend will:

1. **Receive callback**: `GET /api/v1/payments/callback?id={moyasar_payment_id}`
2. **Verify with Moyasar**: Backend calls Moyasar API to get payment status
3. **Update database**: Payment and registration status updated
4. **Audit log**: All actions logged automatically

**This works without webhooks!** The callback endpoint handles everything.

### Option 2: Use ngrok for Webhook Testing

If you want to test webhooks locally:

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Start ngrok tunnel
ngrok http 8000

# You'll get a URL like: https://abc123.ngrok.io
# Add webhook in Moyasar dashboard:
# https://abc123.ngrok.io/api/v1/payments/webhook
```

### Option 3: Polling (Not Recommended)

You could create a background job to poll Moyasar for payment status updates, but this is inefficient.

---

## Testing Payment Flow

### Test Cards (Moyasar Test Mode)

Use these test card numbers in test mode:

#### Successful Payment
```
Card Number: 4111 1111 1111 1111
CVV: 123
Expiry: Any future date
Name: Any name
```

#### Failed Payment
```
Card Number: 4000 0000 0000 0002
CVV: 123
Expiry: Any future date
```

#### 3D Secure Test
```
Card Number: 4000 0027 6000 3184
CVV: 123
Expiry: Any future date
```

### Complete Test Flow

#### 1. Create a Trip Registration
```bash
POST /api/v1/trips/{trip_id}/register
{
  "participants": [...],
  "package_id": "..."
}

# Response includes registration_id
```

#### 2. Initiate Payment
```bash
POST /api/v1/payments/create
{
  "registration_id": "uuid-here",
  "payment_method": "creditcard",
  "callback_url": "https://yourapp.com/payment-success"
}

# Response includes:
# - payment_id (your internal ID)
# - moyasar_payment_id
# - source.transaction_url (redirect user here)
```

#### 3. User Completes Payment
- Redirect user to `source.transaction_url`
- User enters card details on Moyasar's secure page
- Moyasar processes payment (with 3D Secure if needed)
- User redirected to your `callback_url`

#### 4. Backend Verifies Payment
```bash
GET /api/v1/payments/callback?id={moyasar_payment_id}

# Backend automatically:
# - Fetches payment status from Moyasar
# - Updates payment status in database
# - Updates registration status to "confirmed"
# - Logs everything in audit log
```

#### 5. Check Payment Status
```bash
GET /api/v1/payments/{payment_id}

# Response shows:
# - status: "paid"
# - paid_at: timestamp
# - fee: Moyasar's fee
# - All payment details
```

#### 6. View Audit Trail
```sql
-- Query audit logs
SELECT * FROM payment_audit_logs 
WHERE payment_id = 'your-payment-uuid'
ORDER BY created_at DESC;

-- You'll see:
-- - PAYMENT_CREATED
-- - API_CALL_SUCCESS (to Moyasar)
-- - STATUS_CHANGED (initiated -> paid)
-- - PAYMENT_PAID
```

---

## Production Deployment

### 1. Switch to Live Keys

```bash
# In production .env
MOYASAR_API_KEY=sk_live_YOUR_LIVE_SECRET_KEY
MOYASAR_WEBHOOK_SECRET=your_live_webhook_secret
```

### 2. Configure Webhook in Moyasar Dashboard

1. Go to **Settings** → **Webhooks**
2. Add webhook URL: `https://yourdomain.com/api/v1/payments/webhook`
3. Select events to receive:
   - ✅ `payment.paid`
   - ✅ `payment.failed`
   - ✅ `payment.refunded`
4. Save and copy the webhook secret
5. Add webhook secret to your `.env` file

### 3. Test Webhook

Moyasar provides a "Test Webhook" button in the dashboard. Use it to verify your endpoint works.

### 4. Monitor Audit Logs

Set up monitoring for:
- Failed payments (`payment_audit_logs` where `event_type = 'PAYMENT_FAILED'`)
- Failed webhooks (`event_type = 'WEBHOOK_FAILED'`)
- Failed API calls (`event_type = 'API_CALL_FAILED'`)

---

## Troubleshooting

### Payment Creation Fails

**Error: "Registration not found"**
- Verify the registration exists and belongs to the user
- Check registration status is "pending_payment"

**Error: "Payment already exists"**
- User already initiated payment for this registration
- Check existing payment status before creating new one

### Webhook Not Received

**In Local Development:**
- ✅ This is expected! Use the callback endpoint instead
- ✅ Or use ngrok to expose your local server

**In Production:**
- Check webhook URL is correct in Moyasar dashboard
- Verify webhook secret is correct in `.env`
- Check server logs for incoming webhook requests
- Ensure your server is accessible from internet

### Payment Shows as "Initiated" but User Paid

**Solution:**
- User may have closed browser before redirect
- Manually trigger callback: `GET /api/v1/payments/callback?id={moyasar_payment_id}`
- Or wait for webhook (in production)
- Check audit logs to see what happened

### Refund Fails

**Error: "Payment is not in paid status"**
- Can only refund paid payments
- Check payment status first

**Error: "Payment already refunded"**
- Payment was already refunded
- Check `refunded` field and `refunded_at` timestamp

---

## API Endpoints Reference

### Payment Endpoints

```bash
# Create payment
POST /api/v1/payments/create
Body: { registration_id, payment_method, callback_url? }
Auth: Required

# Get payment details
GET /api/v1/payments/{payment_id}
Auth: Required

# List payments for registration
GET /api/v1/payments/registration/{registration_id}
Auth: Required

# Payment callback (called by Moyasar)
GET /api/v1/payments/callback?id={moyasar_payment_id}
Auth: Not required

# Webhook (called by Moyasar)
POST /api/v1/payments/webhook
Headers: X-Moyasar-Signature
Auth: Not required (verified by signature)

# Refund payment
POST /api/v1/payments/{payment_id}/refund
Body: { amount?, description? }
Auth: Required
```

---

## Database Schema

### Payments Table
```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY,
    moyasar_payment_id VARCHAR(100),
    registration_id UUID REFERENCES tripregistration(id),
    amount DECIMAL(10,2),
    currency VARCHAR(3),
    status VARCHAR(50),  -- initiated, paid, failed, refunded, voided
    payment_method VARCHAR(50),  -- creditcard, applepay, stcpay, mada
    description VARCHAR(500),
    callback_url VARCHAR(500),
    refunded BOOLEAN,
    refunded_amount DECIMAL(10,2),
    refunded_at TIMESTAMP,
    moyasar_metadata JSON,
    fee DECIMAL(10,2),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    paid_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_reason VARCHAR(500)
);
```

### Payment Audit Logs Table
```sql
CREATE TABLE payment_audit_logs (
    id UUID PRIMARY KEY,
    payment_id UUID REFERENCES payments(id),
    moyasar_payment_id VARCHAR(100),
    event_type VARCHAR(50),  -- PAYMENT_CREATED, STATUS_CHANGED, etc.
    event_description VARCHAR(500),
    user_id UUID REFERENCES user(id),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    request_data JSON,
    response_data JSON,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    error_message VARCHAR(1000),
    error_code VARCHAR(50),
    webhook_signature VARCHAR(500),
    webhook_verified BOOLEAN,
    created_at TIMESTAMP,
    extra_data JSON
);
```

---

## Security Checklist

- [ ] Secret key stored in `.env` (never in code)
- [ ] `.env` file in `.gitignore`
- [ ] Different keys for test/production
- [ ] Webhook signature verification enabled
- [ ] HTTPS enabled in production
- [ ] User authorization checks in place
- [ ] Audit logging enabled
- [ ] Error monitoring set up
- [ ] Regular audit log reviews
- [ ] Backup strategy for payment data

---

## Support & Resources

- **Moyasar Documentation**: https://moyasar.com/docs/
- **Moyasar Dashboard**: https://dashboard.moyasar.com
- **Moyasar Support**: support@moyasar.com
- **API Reference**: https://moyasar.com/docs/api/

---

## Quick Start Checklist

For local development:

1. [ ] Get Moyasar test credentials
2. [ ] Add `MOYASAR_API_KEY` to backend `.env`
3. [ ] Add publishable key to frontend config
4. [ ] Run migrations (when you have sudo access)
5. [ ] Test payment creation endpoint
6. [ ] Test with Moyasar test card
7. [ ] Verify callback works
8. [ ] Check audit logs in database

For production:

1. [ ] Get Moyasar live credentials
2. [ ] Update `.env` with live keys
3. [ ] Configure webhook in Moyasar dashboard
4. [ ] Test webhook delivery
5. [ ] Set up monitoring and alerts
6. [ ] Test end-to-end payment flow
7. [ ] Document runbook for payment issues
8. [ ] Train support team on payment troubleshooting
