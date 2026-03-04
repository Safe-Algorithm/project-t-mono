# Production Checklist — Backend Environment Variables

This document covers every env var you must set before going to production,
with a focus on the three features that use deep-links or public URLs:
**trip sharing**, **payment callbacks**, and **auth email links**.

---

## 1. Backend public URL (`BACKEND_URL`)

```env
BACKEND_URL=https://api.yourdomain.com
```

**Used by:**
- Moyasar payment callback URL (`GET /api/v1/payments/callback`) — **must be HTTPS**, Moyasar rejects plain HTTP.
- Trip share canonical URL (`GET /api/v1/share/{token}`) — the URL put inside `og:url` and returned to the provider panel.

**In dev:** use ngrok — `ngrok http 8000` → set `BACKEND_URL=https://xxxx.ngrok-free.app`

---

## 2. Mobile app deep-link scheme (`APP_DEEP_LINK_SCHEME`)

```env
APP_DEEP_LINK_SCHEME=rihlaapp
```

**Must match** the `scheme` field in your `app.json` / Expo config. Default is `rihlaapp`.

**Used by:**
- Trip share page — `rihlaapp://trip/{id}` to open the trip in the app after a user taps the link.
- Payment callback page — `rihlaapp://payment-callback?registrationId=...&status=paid` to return the user to the app after 3DS.
- Auth emails — `rihlaapp://reset-password?token=...` and `rihlaapp://verify-email?token=...` for mobile users.

---

## 3. Auth email links — panel URLs

```env
ADMIN_PANEL_URL=https://admin.yourdomain.com
PROVIDERS_PANEL_URL=https://providers.yourdomain.com
```

**Used by** password reset and email verification emails sent to **admin** and **provider** users.
Mobile app users receive deep-links (`rihlaapp://`) instead — those are driven by `APP_DEEP_LINK_SCHEME` above.

---

## 4. Trip sharing — App Store URLs

```env
# Set once your app is published to both stores
IOS_APP_STORE_URL=https://apps.apple.com/app/id1234567890
ANDROID_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.safealgo.rihla

# iOS Safari Smart App Banner (optional but recommended)
IOS_APP_STORE_ID=1234567890
```

**Used by** the `/share/{token}` HTML page:
- If a user taps the link on iOS and the app is not installed → redirected to the App Store.
- If a user taps the link on Android and the app is not installed → redirected to the Play Store.
- `IOS_APP_STORE_ID` enables the Safari Smart App Banner (the native banner at the top of Safari suggesting to open the app).

Leave these as the defaults during development — the share page works fine, it just won't redirect to a store.

---

## 5. Payment gateway (`MOYASAR_*`)

```env
MOYASAR_API_KEY=sk_live_...          # Secret key — backend only
MOYASAR_PUBLISHABLE_KEY=pk_live_...  # Sent to the mobile app for direct Moyasar calls
MOYASAR_WEBHOOK_SECRET=whsec_...     # Webhook HMAC verification
```

Switch from `test_` keys to `live_` keys. Also update the Moyasar dashboard:
- **Callback URL** → `https://api.yourdomain.com/api/v1/payments/callback`
- **Webhook URL** → `https://api.yourdomain.com/api/v1/payments/webhook`

---

## 6. Other services

```env
# SendGrid — email delivery
SENDGRID_API_KEY=SG.live_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=Rihla

# Twilio — OTP SMS
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_PHONE_NUMBER=+966xxxxxxxxx

# Backblaze B2 — file/image storage
BACKBLAZE_KEY_ID=xxxx
BACKBLAZE_APPLICATION_KEY=xxxx
BACKBLAZE_BUCKET_NAME=your-prod-bucket
```

---

## Full production `.env` diff (what changes from dev)

| Variable | Dev value | Production value |
|---|---|---|
| `BACKEND_URL` | `https://xxxx.ngrok-free.app` | `https://api.yourdomain.com` |
| `ADMIN_PANEL_URL` | `http://localhost:3001` | `https://admin.yourdomain.com` |
| `PROVIDERS_PANEL_URL` | `http://localhost:3002` | `https://providers.yourdomain.com` |
| `APP_DEEP_LINK_SCHEME` | `rihlaapp` | `rihlaapp` (unchanged) |
| `IOS_APP_STORE_URL` | default placeholder | `https://apps.apple.com/app/id...` |
| `ANDROID_PLAY_STORE_URL` | default placeholder | `https://play.google.com/store/...` |
| `IOS_APP_STORE_ID` | `` (empty) | `1234567890` |
| `MOYASAR_API_KEY` | `test_sk_...` | `live_sk_...` |
| `MOYASAR_PUBLISHABLE_KEY` | `test_pk_...` | `live_pk_...` |
| `SECRET_KEY` | dev placeholder | Long random string (run `openssl rand -hex 32`) |

---

## Mobile app (`rihla-app/.env`)

```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
EXPO_PUBLIC_MOYASAR_PUBLISHABLE_KEY=pk_live_...
```
