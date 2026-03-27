# Financials Feature

Platform-wide payout management between admins and trip providers. Tracks every booking's financial split (gross revenue → platform cut → provider share), allows admins to batch-pay providers, and lets providers view their own earnings in full detail.

---

## Overview

The financials system operates on a simple ledger model:

1. A user completes a booking and payment is captured.
2. Once a booking passes its refund window it becomes **owed** — an `EarningLine` row is created for the provider.
3. An admin selects one or more owed `EarningLine`s and creates a `ProviderPayout` (bank transfer record).
4. The payout starts as `pending`; once the admin confirms the bank transfer is done it is marked `completed`.
5. The provider can see all of this in their own panel (no user PII exposed).

---

## Database Models

### `EarningLine` — `earning_lines`
`@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/backend/app/models/earning_line.py:1-58`

One row per paid `TripRegistration` once that booking becomes non-refundable.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `registration_id` | UUID FK unique | One-to-one with `TripRegistration` |
| `provider_id` | UUID FK indexed | Denormalised for fast queries |
| `trip_id` | UUID FK indexed | Denormalised |
| `gross_amount` | Decimal(10,2) | Full booking payment |
| `platform_cut_pct` | Decimal(5,2) | Provider's commission rate at time of booking |
| `platform_cut_amount` | Decimal(10,2) | `gross × platform_cut_pct / 100` |
| `provider_amount` | Decimal(10,2) | `gross − platform_cut_amount` |
| `payout_id` | UUID FK nullable | NULL = unpaid; set when included in a `ProviderPayout` |
| `became_owed_at` | datetime | When the booking passed its refund window |
| `created_at` | datetime | |

**Key design:** Lines are created **lazily** — the service checks all paid registrations on first query for a provider and materialises any that are now owed. This means no background job is required.

---

### `ProviderPayout` — `provider_payouts`
`@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/backend/app/models/provider_payout.py:1-66`

One record per admin pay-run (a batch of earning lines paid together).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `provider_id` | UUID FK indexed | |
| `total_gross` | Decimal(12,2) | Denormalised sum of included lines |
| `total_platform_cut` | Decimal(12,2) | |
| `total_provider_amount` | Decimal(12,2) | Actual amount transferred |
| `booking_count` | int | Number of earning lines included |
| `status` | `pending` \| `completed` | `pending` = created; `completed` = bank transfer confirmed |
| `note` | str(1000) nullable | Admin notes |
| `bank_transfer_reference` | str(200) nullable | e.g. `TXN-2026-001` |
| `receipt_file_url` | str(500) nullable | URL to uploaded receipt |
| `paid_by_admin_id` | UUID FK nullable | Which admin actioned it |
| `paid_at` | datetime nullable | Set when status → completed |
| `created_at` / `updated_at` | datetime | |

**Status flow:** `pending` → `completed` (one-way, no reversal).

Only `completed` payouts count toward a provider's `total_paid_out` balance.

---

## Backend

### Service Layer
`@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/backend/app/services/financials.py`

Contains `get_or_create_earning_lines_for_provider()` — the lazy materialisation function. Called by nearly every CRUD function to ensure earning lines are up-to-date before any query runs.

Logic: for each paid, non-cancelled `TripRegistration` belonging to the provider where no `EarningLine` exists yet and `_is_owed()` returns `True`, create the earning line.

`_is_owed()` returns `True` when the booking's refund window has passed (the computed refund percentage is 0%).

---

### CRUD
`@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/backend/app/crud/financials.py:1-472`

| Function | Purpose |
|---|---|
| `get_owed_earning_lines(session, provider_id)` | All unpaid earning lines for a provider |
| `get_all_earning_lines(session, provider_id, status_filter, trip_id)` | All lines with optional `owed`/`paid` filter |
| `create_payout(...)` | Validate lines belong to provider and are unpaid, create `ProviderPayout`, set `payout_id` on each line |
| `complete_payout(...)` | Set status → completed, record `paid_at` |
| `get_payout_detail(session, payout_id)` | Single payout with all its earning lines |
| `list_all_payouts(session, provider_id?)` | Admin list; optionally scoped to one provider |
| `get_payouts_for_provider(session, provider_id)` | Provider's own payouts |
| `get_provider_financial_summary(session, provider)` | Full summary for one provider (owed, paid, totals) |
| `get_admin_overview(session)` | All providers' summaries + grand totals |
| `get_trip_financial_detail(session, trip_id, for_admin)` | Per-booking breakdown for a trip; `for_admin=False` omits user PII |
| `get_provider_trips_summary(session, provider_id)` | Per-trip summary list without booking detail |
| `get_provider_self_summary(session, provider)` | Provider's own view (same as admin summary, no provider_name) |

**`create_payout` validation:**
- Each `earning_line_id` must exist and belong to `provider_id` — raises `ValueError` → HTTP 400 otherwise.
- Each line must have `payout_id = NULL` (unpaid) — raises `ValueError` if already in a payout.

---

### Schemas
`@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/backend/app/schemas/financials.py:1-152`

| Schema | Used for |
|---|---|
| `EarningLineRead` | Single earning line with denormalised booking/trip info |
| `PayoutCreate` | Admin POST body: list of line IDs + optional note/reference |
| `PayoutComplete` | Admin PATCH body: optional receipt URL, note, reference |
| `ProviderPayoutRead` | Payout list item (no line detail) |
| `ProviderPayoutDetail` | Payout + embedded earning lines |
| `ProviderFinancialSummary` | Admin view of one provider's totals |
| `AdminFinancialsOverview` | All providers + grand totals |
| `TripEarningStatus` | Single booking row within a trip breakdown |
| `TripFinancialSummary` | Trip-level aggregates (no booking list) |
| `TripFinancialDetail` | `TripFinancialSummary` + `bookings: List[TripEarningStatus]` |
| `CommissionUpdate` | PATCH body for updating commission rate |
| `ProviderFinancialsSelf` | Provider panel summary (no provider name/id — self-scoped) |

**Booking status values** within `TripEarningStatus.status`:

| Value | Meaning |
|---|---|
| `paid_out` | Has an earning line AND that line is in a completed payout |
| `owed` | Has an earning line but `payout_id` is NULL |
| `refundable` | Paid booking but still within refund window (no earning line yet) |
| `cancelled` | Registration is cancelled |

---

### API Routes
`@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/backend/app/api/routes/financials.py:1-337`

All routes require authentication. Admin routes require `require_admin_permission`. Provider routes require `require_provider_permission`.

#### Admin endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/financials/overview` | All providers' summaries + grand totals |
| `GET` | `/admin/financials/providers/{provider_id}/owed` | Unpaid earning lines for one provider |
| `GET` | `/admin/financials/providers/{provider_id}/summary` | Full financial summary for one provider |
| `POST` | `/admin/financials/providers/{provider_id}/payouts` | Create a payout for selected earning lines |
| `PATCH` | `/admin/financials/payouts/{payout_id}/complete` | Mark payout completed (bank transfer done) |
| `GET` | `/admin/financials/payouts` | List all payouts (optional `?provider_id=` filter) |
| `GET` | `/admin/financials/payouts/{payout_id}` | Single payout detail |
| `GET` | `/admin/financials/trips/by-provider?provider_id=` | Per-trip summaries for one provider |
| `GET` | `/admin/financials/trips/{trip_id}` | Full per-booking breakdown for a trip (includes user PII) |
| `PATCH` | `/admin/providers/{provider_id}/commission` | Update provider's commission rate (0–100) |

#### Provider endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/provider/financials/summary` | Own financial summary |
| `GET` | `/provider/financials/earnings` | Own earning lines (optional `?status=owed\|paid&trip_id=`) |
| `GET` | `/provider/financials/trips` | Per-trip financial summaries |
| `GET` | `/provider/financials/trips/{trip_id}` | Full per-booking breakdown for own trip (no user PII) |
| `GET` | `/provider/financials/payouts` | Own payout history |
| `GET` | `/provider/financials/payouts/{payout_id}` | Own payout detail (ownership check enforced) |

**Important:** The provider trip detail endpoint performs an ownership check — HTTP 403 if the trip doesn't belong to the requesting provider.

---

## Frontend — Admin Panel

### Service
`@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/admin-panel/src/services/financialsService.ts:1-154`

Mirrors every backend endpoint. All monetary fields arrive as `string` (FastAPI serialises `Decimal` as string). Use `parseFloat()` / `fmtSAR()` for display.

### Pages

#### Financials Overview — `/financials`
`@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/admin-panel/src/pages/financials/index.tsx`

- Grand total stat cards (total owed, total paid out).
- Searchable table of all providers with their summary figures.
- "Manage" button links to the provider detail page.

#### Provider Financial Detail — `/financials/providers/[id]`
`@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/admin-panel/src/pages/financials/providers/[id].tsx`

Three tabs:

**Pending Payout tab**
- Lists all unpaid earning lines as a selectable table.
- Checkbox per row + Select All.
- Running total of selected amount shown in footer.
- "Pay Provider — SAR X" button opens the payout modal.
- Modal collects optional bank reference and note, then calls `createPayout`.

**Trips tab**
- Fetches `getProviderTripsSummary` (the `/admin/financials/trips/by-provider` endpoint).
- Shows per-trip aggregates: bookings, paid-out count, owed amount, provider's total share.
- "Details" links to the trip detail page.

**Payout History tab**
- Lists all payouts for the provider with status badges, amounts, references, and receipt links.

Also contains:
- Inline commission rate editor (PATCH `/admin/providers/{id}/commission`).
- Summary stat cards at the top (owed now, total paid, provider earned, platform cut).

#### Trip Financial Detail — `/financials/trips/[id]`
`@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/admin-panel/src/pages/financials/trips/[id].tsx`

- Summary cards: paid-out amount, owed amount, refundable count, total gross.
- Filter tabs: All / Paid Out / Owed / Refundable / Cancelled (with counts).
- Bookings table: booking ref, user name + email, date, gross, platform cut, provider share, status badge, paid-out date.

---

## Frontend — Provider Panel

### Service
`@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/providers-panel/src/services/financialsService.ts:1-122`

Read-only from the provider's perspective. `getProviderEarnings()` supports optional `statusFilter` and `tripId` query params.

### Pages

#### Provider Financials — `/financials`
`@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/providers-panel/src/pages/financials/index.tsx`

Four tabs:

**Overview tab**
- Earnings breakdown card: total gross → platform cut → your share → paid out so far → still owed.
- Top 5 trips by earnings widget with owed callout.

**Earnings tab**
- Full earning line table filterable by All / Owed / Paid Out.
- Columns: trip, booking ref, date owed, gross, your share, status badge.

**By Trip tab**
- Per-trip table: trip name, total bookings, paid-out count, owed amount, your share.
- "Details" links to the trip detail page.

**Payouts tab**
- Payout history table: date, bookings, amount, bank reference, status badge, note, receipt link.
- Empty state message if no payouts received yet.

Summary cards at top: Commission Rate, Pending Payout, Total Received (with last payout date), Total Earned.

#### Provider Trip Detail — `/financials/trips/[id]`
`@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/providers-panel/src/pages/financials/trips/[id].tsx`

- Same layout as admin trip detail but with no user PII (booking ref is anonymised if not present).
- Privacy notice banner explaining anonymised references.
- Filter tabs and bookings table identical to admin version minus the user columns.

---

## i18n

All UI strings are fully localised in English and Arabic via `react-i18next` using the `fin.*` key namespace.

| Panel | i18n file |
|---|---|
| Admin | `@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/admin-panel/src/i18n.ts` |
| Provider | `@/home/almuwallad/Desktop/projectT/vibe-mono/project-t-mono/providers-panel/src/i18n.ts` |

Status badges, table headers, tab labels, modal text, error messages, and stat card labels are all translated. Status values (`paid_out`, `owed`, etc.) from the API are mapped to translation keys in the component — they are never rendered raw.

---

## Business Rules & Constraints

1. **One earning line per booking** — `registration_id` has a unique constraint on `earning_lines`. A booking can never appear twice.
2. **Lazy materialisation** — earning lines are created on-demand when any financial query is made for a provider. No cron job required.
3. **Immutable once included** — an earning line already linked to a `payout_id` cannot be added to another payout (HTTP 400).
4. **Only completed payouts count** — `total_paid_out` in all summaries sums only `status = completed` payouts. A `pending` payout does not reduce the owed balance until confirmed.
5. **Commission rate is snapshotted at earning line creation** — `platform_cut_pct` on the earning line captures the rate at materialisation time. Changing a provider's commission rate later does not retroactively change existing lines.
6. **Trip ownership check on provider trip detail** — providers can only view trips they own; HTTP 403 otherwise.
7. **No user PII in provider views** — `for_admin=False` is passed to `get_trip_financial_detail`; `user_name` and `user_email` are left `None`.
8. **Commission rate bounds** — the PATCH commission endpoint enforces 0 ≤ rate ≤ 100; HTTP 400 otherwise.
9. **Payout status is one-way** — there is no endpoint to revert a completed payout back to pending.

---

## Key Files Reference

| Layer | File |
|---|---|
| DB model — earning line | `backend/app/models/earning_line.py` |
| DB model — payout | `backend/app/models/provider_payout.py` |
| Service (lazy materialisation) | `backend/app/services/financials.py` |
| CRUD | `backend/app/crud/financials.py` |
| Schemas | `backend/app/schemas/financials.py` |
| API routes | `backend/app/api/routes/financials.py` |
| Admin TS service | `admin-panel/src/services/financialsService.ts` |
| Provider TS service | `providers-panel/src/services/financialsService.ts` |
| Admin overview page | `admin-panel/src/pages/financials/index.tsx` |
| Admin provider detail page | `admin-panel/src/pages/financials/providers/[id].tsx` |
| Admin trip detail page | `admin-panel/src/pages/financials/trips/[id].tsx` |
| Provider financials page | `providers-panel/src/pages/financials/index.tsx` |
| Provider trip detail page | `providers-panel/src/pages/financials/trips/[id].tsx` |
| Admin i18n | `admin-panel/src/i18n.ts` |
| Provider i18n | `providers-panel/src/i18n.ts` |
