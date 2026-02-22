# Moyasar Payment Flow

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PAYMENT FLOW                                │
│                                                                     │
│  App                    Backend                  Moyasar            │
│  ───                    ───────                  ───────            │
│                                                                     │
│  1. POST /payments/prepare ──────────────────►                      │
│     { registration_id, payment_method,                              │
│       redirect_url: "rihlaapp://payment-callback" }                 │
│                                                                     │
│     ◄──────────────────────────────────────────                     │
│     { payment_db_id, amount_halalas,                                │
│       currency, description, callback_url }                         │
│                                                                     │
│  2. POST https://api.moyasar.com/v1/payments ──────────────────────►│
│     Authorization: Basic <PUBLISHABLE_KEY>:                         │
│     { amount, currency, description,                                │
│       callback_url (backend HTTPS URL),                             │
│       source: { type, name, number, month, year, cvc } }            │
│                                                                     │
│     ◄──────────────────────────────────────────────────────────────│
│     { id, status, source: { transaction_url } }                     │
│                                                                     │
│  3. POST /payments/confirm ──────────────────►                      │
│     { payment_db_id, moyasar_payment_id }                           │
│     (links our DB record to Moyasar's ID)                           │
│                                                                     │
│  4. Linking.openURL(source.transaction_url)                         │
│     (opens bank 3DS page in system browser)                         │
│                                                                     │
│                          User completes 3DS on bank page            │
│                                                                     │
│  5.                     ◄── GET /payments/callback?id=...           │
│                              (Moyasar redirects browser here)       │
│                                                                     │
│                         Verify payment via secret key               │
│                         Update payment + registration in DB         │
│                                                                     │
│                         Serve HTML page with:                       │
│                         window.location.href = redirect_url +       │
│                           "?registrationId=...&status=paid"         │
│                                                                     │
│  6. payment-callback.tsx receives deep link                         │
│     → routes to /booking/success (paid)                             │
│       or /booking/[registrationId] (failed)                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### Why the app calls Moyasar directly (not via backend)
Moyasar's Terms of Service explicitly prohibit sending cardholder data through
a merchant backend. The **publishable key** (`pk_test_...`) is designed to be
shipped in client code and can only create payments — it cannot read, refund,
or modify them. The **secret key** (`sk_test_...`) stays backend-only.

### Why the callback URL is a backend HTTPS URL (not the app deep link)
Moyasar requires the `callback_url` to be an **HTTPS URL**. Custom URL schemes
(`rihlaapp://`) are rejected. After 3DS, Moyasar redirects the user's browser
to this HTTPS URL. Our backend then:
1. Verifies the payment status using the **secret key** (the app cannot do this
   securely — the secret key must never leave the backend).
2. Updates the database.
3. Serves an HTML page that triggers the app deep link.

### Why the app sends `redirect_url` to `/prepare`
Rather than hardcoding `rihlaapp://payment-callback` in the backend, the app
tells the backend where to redirect after processing. This keeps the URL scheme
as the app's concern, not the backend's. The backend stores it in
`payment.callback_url` and uses it in the callback handler.

### Why we serve HTML instead of a 307 redirect to `rihlaapp://`
Browsers do not follow HTTP redirects to custom URL schemes. A `307 Location:
rihlaapp://...` response is silently ignored. JavaScript navigation
(`window.location.href = "rihlaapp://..."`) does work because it triggers the
browser's URL scheme handler directly.

### Webhook vs Callback
Both update the DB, but they serve different purposes:
- **Callback** (`GET /payments/callback`): browser-based redirect after 3DS,
  used to return the user to the app.
- **Webhook** (`POST /payments/webhook`): server-to-server event from Moyasar,
  used as a reliable fallback (e.g. if the user closes the browser mid-flow).
  Verified with HMAC-SHA256 signature.

---

## Files

### Backend
| File | Purpose |
|------|---------|
| `backend/app/api/routes/payments.py` | All payment endpoints |
| `backend/app/schemas/payment.py` | Request/response schemas |
| `backend/app/services/moyasar.py` | Moyasar API client (secret key only) |
| `backend/app/models/payment.py` | Payment DB model |
| `backend/app/main.py` | `/.well-known/assetlinks.json` for Android App Links |

### Mobile App
| File | Purpose |
|------|---------|
| `rihla-app/app/booking/[registrationId].tsx` | Card input modal + payment flow |
| `rihla-app/app/payment-callback.tsx` | Deep link handler after 3DS |
| `rihla-app/app/booking/success.tsx` | Post-payment success screen |
| `rihla-app/hooks/useTrips.ts` | `usePreparePayment`, `useConfirmPayment` hooks |
| `rihla-app/.env` | `EXPO_PUBLIC_MOYASAR_PUBLISHABLE_KEY` |

---

## Environment Variables

### Backend (`backend/.env`)
```
MOYASAR_API_KEY=sk_test_...          # Secret key — never expose to client
MOYASAR_PUBLISHABLE_KEY=pk_test_...  # Not used by backend (kept for reference)
MOYASAR_WEBHOOK_SECRET=...           # For HMAC webhook signature verification
BACKEND_URL=https://your-ngrok-url   # Must be HTTPS — Moyasar rejects http://
ANDROID_APP_FINGERPRINT=AA:BB:...    # SHA-256 of release keystore for App Links
```

### Mobile App (`rihla-app/.env`)
```
EXPO_PUBLIC_API_URL=http://...       # Backend API base URL
EXPO_PUBLIC_MOYASAR_PUBLISHABLE_KEY=pk_test_...  # Safe to ship in app
```

---

## Android App Links (Deep Link from Browser)

For the browser to open the app after 3DS, two things must be configured:

### 1. `app.json` — intent filters
```json
"intentFilters": [
  {
    "action": "VIEW",
    "autoVerify": true,
    "data": [{ "scheme": "https", "host": "your-domain.com", "pathPrefix": "/payment-callback" }],
    "category": ["BROWSABLE", "DEFAULT"]
  },
  {
    "action": "VIEW",
    "data": [{ "scheme": "rihlaapp" }],
    "category": ["BROWSABLE", "DEFAULT"]
  }
]
```

### 2. `/.well-known/assetlinks.json` — served by backend
Android fetches this file from your domain to verify the app is authorised to
handle its HTTPS links. The `sha256_cert_fingerprints` must match your APK's
signing certificate.

Get the fingerprint:
```bash
# Debug keystore (dev builds)
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey \
  -storepass android -keypass android | grep SHA256

# Release keystore
keytool -list -v -keystore your-release.keystore | grep SHA256
```

Set it in `backend/.env`:
```
ANDROID_APP_FINGERPRINT=AA:BB:CC:...
```

> **Note for Expo Go:** Custom URL schemes (`rihlaapp://`) do not work in Expo
> Go. Run `npx expo run:android` to build a dev APK that registers the scheme.
> App Links (HTTPS) require a signed build and a verified domain.

---

## Spot Reservation System

When a user confirms booking, a 15-minute spot reservation is created
(`spot_reserved_until`). A background worker (`cancel_expired_spot_reservations`,
runs every minute) cancels `pending_payment` registrations whose window has
expired.

When the user taps "Pay Now", `/prepare` refreshes the window by another 15
minutes from that moment, giving them time to complete the card form and 3DS.

**Important:** `spot_reserved_until` is stored as a naive UTC datetime in the
database. When displaying the countdown in the app, always append `Z` before
parsing to ensure JavaScript treats it as UTC:
```ts
const utcStr = raw.endsWith('Z') || raw.includes('+') ? raw : raw + 'Z';
const diff = new Date(utcStr).getTime() - Date.now();
```
