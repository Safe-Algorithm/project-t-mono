# Timezone Handling

## How dates are stored

All trip datetimes (`start_date`, `end_date`, `registration_deadline`, `meeting_time`) are stored in the database as **naive UTC** (PostgreSQL `TIMESTAMP WITHOUT TIME ZONE`). Each trip also carries a `timezone` field (IANA string, e.g. `Asia/Riyadh`) that tells clients what timezone those UTC values should be displayed in.

```
Provider enters: "June 1, 09:00 AM" in Riyadh
Stored in DB:    2025-06-01T06:00:00  (UTC, no offset)
trip.timezone:   "Asia/Riyadh"
```

## How the timezone is set

The `timezone` field is **always auto-derived from the starting city** on the backend (`crud.trip.create_trip` / `update_trip`). Whatever value the client submits is overridden if the starting city has a timezone set on it. Falls back to `Asia/Riyadh` if the city has no timezone configured.

Providers no longer pick a timezone manually — the provider panel shows a read-only note: *"Dates are entered in the timezone of the selected starting city."*

## Why we display dates in the trip's timezone, not the user's device timezone

Trip dates are **departure/arrival times at the starting city**. The traveller needs to know "be at the meeting point at 09:00 Riyadh time", not "that's 06:00 London time when you're at home."

This matches airline convention: departure and arrival times are always shown in the **airport's local time**, never the passenger's home timezone.

> Note: the device timezone is available without any location permission via `Intl.DateTimeFormat().resolvedOptions().timeZone`. We deliberately choose **not** to use it for trip dates for the reason above.

The one place device timezone is appropriate is time-sensitive push notification copy (e.g. "Your trip starts in 2 hours") — that conversion makes sense because the user needs to act from wherever they are.

## Date filter

The explore filter ("trips starting from / to date") sends UTC midnight/end-of-day boundaries:

```
User picks:  June 1
Sent as:     2025-06-01T00:00:00Z  (from)
             2025-06-01T23:59:59Z  (to)
```

This is correct because `start_date` in the DB is UTC and most trips depart in Saudi Arabia / nearby regions (UTC+3). Using the device's local timezone for the filter would skew results for users in other timezones and add complexity with no meaningful benefit given that the filter granularity is one whole day.

## Mobile app display

`formatDate` and `formatMeetingTime` in `app/trip/[id].tsx` always pass `trip.timezone` to `Intl.DateTimeFormat`, so dates are shown in the trip's departure city time regardless of the device timezone.

A small timezone chip is shown below the info grid on the trip detail screen:

> *"All dates are in Asia/Riyadh timezone"*

This is especially useful for international trips where the departure city timezone differs from the user's home timezone.

## Summary table

| Context | Timezone used | Reason |
|---|---|---|
| Trip dates stored in DB | UTC (naive) | Single canonical representation |
| `trip.timezone` field | Starting city IANA TZ | Auto-derived from city on save |
| Trip detail display | `trip.timezone` | Departure city wall-clock time |
| Meeting time display | `trip.timezone` | Same — meeting is at the city |
| Date filter (explore) | UTC boundaries | Device-agnostic, consistent |
| Push notification copy | Device timezone | User needs to act from their location |
