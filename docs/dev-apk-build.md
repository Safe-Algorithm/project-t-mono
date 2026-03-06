# Building a Dev APK for Testing Deep-Links

## Why Expo Go doesn't work for deep-links and payments

Expo Go is a **generic** app published by Expo. It has its own bundle ID and its own URL scheme (`exp://`). It does **not** register `rihlaapp://` on the device, so:

- Tapping a trip share link → the OS doesn't know what app to open → falls back to the store redirect or stays on the page.
- After Moyasar 3DS completes → the backend HTML page tries `window.location.href = "rihlaapp://payment-callback?..."` → the OS ignores it → the "Open Rihla App" button stays on screen but nothing happens.
- Password reset / email verification deep-links sent to mobile users have the same problem.

**Solution:** Build a real APK (Android) or IPA (iOS) using Expo's development build. This installs an app with your own bundle ID and scheme registered, so `rihlaapp://` works exactly like it will in production.

---

## Option A — Android APK (recommended for quick testing)

### Prerequisites

- Node.js 18+, npm
- Java 17 (`sudo apt install openjdk-17-jdk` on Ubuntu)
- Android SDK / Android Studio (for the emulator, optional if using a physical device)
- EAS CLI: `npm install -g eas-cli`
- Expo account: `eas login`

### Step 1 — Configure EAS Build

In `rihla-app/`, run once:

```bash
eas build:configure
```

This creates `rihla-app/eas.json`. Make sure it has a `development` profile:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### Step 2 — Confirm your app scheme in `app.json`

```json
{
  "expo": {
    "scheme": "rihlaapp",
    "android": {
      "package": "com.safealgo.rihla"
    }
  }
}
```

`scheme` must match `APP_DEEP_LINK_SCHEME` in the backend `.env`.

### Step 3 — Build the APK on EAS servers (no local Android SDK needed)

```bash
cd rihla-app
eas build --profile development --platform android
```

- This uploads your code to Expo's build servers and returns a download link (~10-15 min).
- Download the `.apk` file.

### Step 4 — Install on a physical Android device

1. Enable **Developer Options** → **USB Debugging** on your phone.
2. Connect via USB and run:

```bash
adb install rihla-app.apk
```

Or just transfer the `.apk` to the device and open it (allow "Install from unknown sources").

### Step 5 — Install on an Android emulator

```bash
# Start emulator first (from Android Studio or command line)
emulator -avd Pixel_6_API_34

# Then install:
adb install rihla-app.apk
```

### Step 6 — Start the Metro bundler

Run this in your `rihla-app/` directory on your machine:

```bash
npx expo start --dev-client
```

Open the installed app on your phone — it will ask for the Metro server address or let you scan the QR code shown in the terminal. **Both your phone and machine must be on the same WiFi network.**

### Step 7 — Point the app at your local/ngrok backend

In `rihla-app/.env`:

```env
EXPO_PUBLIC_API_URL=https://xxxx.ngrok-free.app/api/v1
EXPO_PUBLIC_MOYASAR_PUBLISHABLE_KEY=test_pk_...
```

Rebuild after changing `.env` (env vars are baked in at build time for native builds).

---

## Option B — Local APK build (no EAS account, requires Android SDK)

```bash
cd rihla-app

# Install dependencies
npm install

# Build a local development client APK
npx expo run:android --variant debug
```

This compiles locally and installs directly on a connected device/emulator. Slower first run (~5 min) but no cloud dependency.

---

## Option C — iOS (requires a Mac + Apple Developer account)

```bash
eas build --profile development --platform ios
```

- Requires an Apple Developer account ($99/year).
- The resulting `.ipa` can be installed via TestFlight or direct device install with EAS.
- For the simulator: `eas build --profile development --platform ios --local` then open in Xcode simulator.

---

## Testing deep-links after installing the APK

### Trip share link
1. Start the backend with ngrok running.
2. In the provider panel, open any trip and click **Share** to copy the link.
3. Paste that URL into the Android browser or send it via WhatsApp to yourself.
4. Tapping it should open the Rihla app directly on the trip screen.
5. If the app is not installed, you'll be redirected to the Play Store URL (or the fallback page in dev since store URLs aren't configured yet).

### Payment callback
1. Go through the booking flow in the app.
2. Complete (or fail) a test payment on the Moyasar sandbox.
3. After 3DS, Moyasar redirects to `BACKEND_URL/api/v1/payments/callback`.
4. The backend page triggers `rihlaapp://payment-callback?registrationId=...&status=paid`.
5. The installed APK intercepts this and navigates to the booking success/failure screen.

### Auth deep-links (password reset / email verification)
1. Trigger "Forgot Password" from the app.
2. Open the email — the link will be `rihlaapp://reset-password?token=...`.
3. Tapping it on the device with the APK installed will open the app directly at the reset screen.

---

## Summary — which option to use when

| Goal | Option |
|---|---|
| Quick test on physical Android phone | **Option A** (EAS cloud build) |
| Local development loop | **Option B** (`expo run:android`) |
| iOS testing | **Option C** (requires Mac + Apple account) |
| Production release | EAS `production` profile → Google Play / App Store |

---

## Important: rebuild after scheme or env changes

Every time you change `APP_DEEP_LINK_SCHEME`, `scheme` in `app.json`, or any `EXPO_PUBLIC_*` env var, you must rebuild the APK — these are baked in at compile time, not read at runtime.
