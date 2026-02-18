# Rihla Mobile App — Design & Implementation

## Overview

**Rihla (رحلة)** is the consumer-facing mobile app for the Project T travel platform. It allows users to discover, save, and book curated trips offered by verified providers.

- **Framework:** React Native (Expo SDK 54)
- **Language:** TypeScript (strict mode)
- **Navigation:** Expo Router 6 (file-based, similar to Next.js)
- **Location:** `rihla-app/`

---

## Design System

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#0EA5E9` | Sky blue — buttons, links, active states |
| `primaryDark` | `#0284C7` | Pressed/hover primary |
| `primaryLight` | `#38BDF8` | Highlights |
| `primarySurface` | `#F0F9FF` | Tinted backgrounds, info boxes |
| `accent` | `#F97316` | Warm coral — prices, CTAs, badges |
| `accentLight` | `#FFF7ED` | Accent surface |
| `success` | `#10B981` | Confirmed status, checkmarks |
| `warning` | `#F59E0B` | Pending status |
| `error` | `#EF4444` | Errors, cancelled status |
| `info` | `#3B82F6` | Informational boxes |
| `background` | `#F8FAFC` | App background |
| `white` | `#FFFFFF` | Cards, surfaces |
| `textPrimary` | `#0F172A` | Headings, primary text |
| `textSecondary` | `#475569` | Body text |
| `textTertiary` | `#94A3B8` | Placeholders, captions |
| `border` | `#E2E8F0` | Dividers, input borders |

All tokens are defined in `constants/Theme.ts` and exported as `Colors`, `FontSize`, `Spacing`, `Radius`, `Shadow`.

### Typography

| Token | Size | Usage |
|---|---|---|
| `xs` | 11px | Captions, labels |
| `sm` | 13px | Secondary text, badges |
| `md` | 15px | Body text |
| `lg` | 17px | Section titles |
| `xl` | 20px | Card titles |
| `xxl` | 24px | Screen titles |
| `xxxl` | 28px | Large headings |
| `display` | 32px | App name, hero text |

### Spacing & Radius

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px
- Radius scale: `sm`=6, `md`=10, `lg`=14, `xl`=18, `xxl`=24, `full`=9999
- Shadow scale: `sm`, `md`, `lg` (platform-aware elevation)

---

## Architecture

### Directory Structure

```
rihla-app/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout: QueryClient + GestureHandler + auth init
│   ├── (auth)/                   # Auth group (redirects to tabs if authenticated)
│   │   ├── _layout.tsx
│   │   ├── onboarding.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── otp.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/                   # Main tab group (redirects to login if unauthenticated)
│   │   ├── _layout.tsx           # Tab bar with 4 tabs
│   │   ├── index.tsx             # Explore / Home
│   │   ├── favorites.tsx         # Saved trips
│   │   ├── bookings.tsx          # My trips / registrations
│   │   └── profile.tsx           # User profile
│   ├── trip/
│   │   └── [id].tsx              # Trip detail screen
│   ├── booking/
│   │   ├── [tripId].tsx          # Booking flow
│   │   └── success.tsx           # Booking confirmation
│   └── provider/
│       └── [id].tsx              # Provider public profile
├── components/
│   ├── ui/                       # Reusable primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── StarRating.tsx
│   │   └── SkeletonLoader.tsx
│   └── trips/                    # Domain-specific components
│       ├── TripCard.tsx
│       └── FilterSheet.tsx
├── constants/
│   └── Theme.ts                  # Design tokens
├── hooks/
│   └── useTrips.ts               # React Query hooks for all trip APIs
├── lib/
│   └── api.ts                    # Axios client with auth + token refresh
├── store/
│   └── authStore.ts              # Zustand auth store
└── types/
    └── trip.ts                   # TypeScript interfaces
```

### State Management

| Concern | Solution |
|---|---|
| Auth state (user, tokens) | **Zustand** (`store/authStore.ts`) — persisted to AsyncStorage |
| Server data (trips, reviews, etc.) | **React Query** (`hooks/useTrips.ts`) — cached, stale-while-revalidate |
| Local UI state | `useState` / `useReducer` per screen |

### API Client (`lib/api.ts`)

- Base URL from `EXPO_PUBLIC_API_URL` env variable
- Automatically attaches `Authorization: Bearer <token>` header
- Sends `X-Source: mobile_app` header (required by backend for user isolation)
- On 401 response: silently refreshes token via `/auth/refresh`, retries original request
- On refresh failure: clears tokens and redirects to login

---

## Screens

### Auth Flow

#### Onboarding (`app/(auth)/onboarding.tsx`)
- 3-slide animated carousel using `react-native-reanimated`
- Horizontal scroll with `useAnimatedScrollHandler`
- Slide content fades/translates in with `interpolate`
- Animated dot indicators that expand on active slide
- Skip button and Next/Get Started CTA

#### Login (`app/(auth)/login.tsx`)
- Email + password form with inline validation
- Branded header with logo and tagline
- Links to Register and Forgot Password
- Calls `POST /auth/login` → stores tokens → navigates to tabs

#### Register (`app/(auth)/register.tsx`)
- 3-step flow with animated step indicator:
  1. **Contact** — email or phone toggle, sends OTP via `POST /otp/send-*`
  2. **OTP Verification** — 6-digit code, verifies via `POST /otp/verify-*`, gets `verification_token`
  3. **Profile Details** — name + password, calls `POST /auth/register` with verification token
- Resend OTP option

#### Forgot Password (`app/(auth)/forgot-password.tsx`)
- Email input → calls `POST /forgot-password`
- Success state with instructions

---

### Main Tabs

#### Explore (`app/(tabs)/index.tsx`)
- Greeting header with user's first name
- Search bar with real-time filtering
- Filter button with active filter count badge
- Opens `FilterSheet` bottom modal
- Trip list with `FlatList`, pull-to-refresh, skeleton loaders
- Empty state with icon

#### Favorites (`app/(tabs)/favorites.tsx`)
- Lists trips saved via heart toggle
- Uses `useFavorites()` React Query hook
- Inline unfavorite with optimistic update

#### My Trips (`app/(tabs)/bookings.tsx`)
- Lists all user registrations
- Status badges: Confirmed (green), Pending (yellow), Cancelled (red), Completed (gray)
- Shows trip name, package, date, participant count, booking reference
- Taps through to trip detail

#### Profile (`app/(tabs)/profile.tsx`)
- Avatar with initials fallback
- Inline name editing (PATCH `/users/me`)
- Stats row (trips, saved, reviews)
- Menu sections: Account, Activity, Support
- Sign out with confirmation alert

---

### Detail Screens

#### Trip Detail (`app/trip/[id].tsx`)
- Scrollable image gallery with dot indicators
- Sticky back/favorite overlay buttons
- Provider name → taps to provider profile
- Rating row with star display
- Info chips grid: start date, end date, max participants, refund policy
- Meeting point box (if applicable)
- About section (bilingual description, EN preferred)
- Amenities grid with icons
- Extra fees list
- Package selector cards (tap to select, visual highlight)
- Reviews section (up to 3 shown)
- Sticky bottom bar: shows selected package price + "Book Now" button

#### Booking Flow (`app/booking/[tripId].tsx`)
- Step 1 — Participants:
  - Counter (1–10) with +/− buttons
  - Dynamic form per participant based on `required_fields` from selected package
  - Field labels mapped from backend field types (e.g. `date_of_birth` → "Date of Birth")
  - Validation before proceeding
- Step 2 — Confirm:
  - Summary card: trip, package, participants, price per person, total
  - Info box about payment redirect
  - "Confirm & Pay" → calls `POST /trips/{id}/register`
- Progress indicator (2 steps)

#### Booking Success (`app/booking/success.tsx`)
- Spring-animated checkmark icon (scale from 0 → 1)
- Fade-in content with upward translate
- Booking reference display
- CTAs: View My Trips, Explore More

#### Provider Profile (`app/provider/[id].tsx`)
- Company avatar with initials fallback
- Company name, rating, stats (total trips, active trips, rating)
- Contact info (email, phone)
- Bio (bilingual, EN preferred)
- Provider's available trips list

---

## UI Components

### Button (`components/ui/Button.tsx`)
- Variants: `primary`, `secondary`, `outline`, `ghost`, `danger`
- Sizes: `sm`, `md`, `lg`
- Props: `loading`, `disabled`, `fullWidth`, `leftIcon`, `rightIcon`
- Spring press animation (scale 0.97 on press)

### Input (`components/ui/Input.tsx`)
- Props: `label`, `error`, `hint`, `leftIcon`, `rightIcon`, `isPassword`
- Password toggle (show/hide)
- Focus ring animation (border color transition)
- Error state with red border + error message

### Badge (`components/ui/Badge.tsx`)
- Variants: `primary`, `success`, `warning`, `error`, `neutral`
- Sizes: `sm`, `md`

### StarRating (`components/ui/StarRating.tsx`)
- Configurable size and color
- Supports half-stars (filled/outline icons)

### SkeletonLoader (`components/ui/SkeletonLoader.tsx`)
- Shimmer animation using `react-native-reanimated`
- `Skeleton` primitive (configurable width/height/borderRadius)
- `TripCardSkeleton` composite for list loading states

### TripCard (`components/trips/TripCard.tsx`)
- Full card with image, title, provider, rating, price, dates
- Heart button with animated toggle
- Spring press scale animation
- Compact variant for horizontal lists

### FilterSheet (`components/trips/FilterSheet.tsx`)
- Bottom sheet modal
- Filters: min/max price, min participants, min rating, sort order
- Apply / Reset buttons

---

## API Integration

All API calls go through `lib/api.ts` (Axios instance). React Query hooks in `hooks/useTrips.ts` wrap all endpoints:

| Hook | Endpoint | Description |
|---|---|---|
| `usePublicTrips(filters)` | `GET /public/trips` | List trips with filters |
| `useTrip(id)` | `GET /public/trips/{id}` | Single trip detail |
| `useTripRating(id)` | `GET /trips/{id}/rating` | Average rating + count |
| `useTripReviews(id)` | `GET /trips/{id}/reviews` | Review list |
| `useFavorites()` | `GET /users/me/favorites` | Saved trips |
| `useToggleFavorite()` | `POST/DELETE /users/me/favorites/{id}` | Add/remove favorite |
| `useMyRegistrations()` | `GET /users/me/registrations` | User's bookings |
| `useProviderProfile(id)` | `GET /public/providers/{id}` | Provider public profile |

---

## Running the App

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android emulator) or Xcode (for iOS simulator)

### Setup
```bash
cd rihla-app
npm install
```

### Environment
Edit `.env`:
```env
# Android emulator (host machine = 10.0.2.2)
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api/v1

# iOS simulator or physical device on same network
# EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1

# Physical device (replace with your machine's local IP)
# EXPO_PUBLIC_API_URL=http://192.168.1.X:8000/api/v1
```

### Run
```bash
npm run android    # Android emulator
npm run ios        # iOS simulator
npm run web        # Web browser (limited native features)
```

### Backend
Start the backend with Docker Compose from the monorepo root:
```bash
docker compose up
```
Backend will be available at `http://localhost:8000`. The API URL depends on where the app runs — see Environment section above.

---

## Testing

Unit tests use **Jest** + **React Native Testing Library**. See `rihla-app/__tests__/` for:

- `store/authStore.test.ts` — Auth store: login, logout, token persistence
- `lib/api.test.ts` — API client: token injection, 401 refresh, header assertions
- `hooks/useTrips.test.tsx` — React Query hooks: data fetching, cache behavior
- `components/ui/Button.test.tsx` — Button rendering, press, loading, disabled states
- `components/ui/Input.test.tsx` — Input rendering, error display, password toggle
- `components/trips/TripCard.test.tsx` — TripCard rendering, favorite toggle, press handler

Run tests:
```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- --coverage # With coverage report
```
