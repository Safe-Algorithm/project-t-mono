"""
Refund calculation service.

Encodes all business rules from the Cancellation & Refund Policy:

COOLING-OFF (always applies, even non-refundable):
  - Within 1 hour of payment AND registration_deadline > 24h away → 100% refund

GUIDED TRIPS (when refundable):
  Calculated against registration_deadline:
  - > 72h before deadline  → 100%
  - 12–72h before deadline → 50%
  - < 12h before deadline  → 0%
  - Deadline passed        → 0%

SELF-ARRANGED TRIPS (when refundable):
  - Before provider accepts  (status == awaiting_provider) → 100%
  - After provider accepts   (status == processing)        → 0%  (arrangements started)
  - After provider finishes  (status == confirmed)         → 0%  (already arranged)

NON-REFUNDABLE (either trip type):
  - Cooling-off still applies (100%)
  - Outside cooling-off → 0%

PROVIDER / ADMIN CANCEL:
  - Always 100% regardless of refundability
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional


@dataclass
class RefundDecision:
    refund_percentage: int          # 0, 50, or 100
    refund_amount: Decimal          # Actual SAR amount to refund
    refund_rule: str                # Audit label
    eligible: bool                  # True if any refund is owed
    explanation: str                # Human-readable reason (for API response)


def _now_naive_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hours_until(dt: datetime) -> float:
    """Hours from now until dt (negative if dt is in the past)."""
    delta = dt - _now_naive_utc()
    return delta.total_seconds() / 3600


def compute_refund(
    *,
    total_amount: Decimal,
    is_refundable: bool,
    trip_type: str,                   # 'guided' | 'self_arranged'
    registration_status: str,         # current booking status
    registration_deadline: datetime,  # naive UTC
    paid_at: Optional[datetime],      # naive UTC, when payment completed
    cancelled_by: str,                # 'user' | 'provider' | 'admin' | 'system'
    admin_override_percentage: Optional[int] = None,  # admin manual override
) -> RefundDecision:
    """
    Compute the refund decision for a cancellation.

    Returns a RefundDecision with percentage, amount, rule label, and explanation.
    """

    def _make(pct: int, rule: str, explanation: str) -> RefundDecision:
        amount = (Decimal(pct) / Decimal(100)) * total_amount
        amount = amount.quantize(Decimal("0.01"))
        return RefundDecision(
            refund_percentage=pct,
            refund_amount=amount,
            refund_rule=rule,
            eligible=pct > 0,
            explanation=explanation,
        )

    # ── Admin manual override ────────────────────────────────────────────────
    if cancelled_by == "admin" and admin_override_percentage is not None:
        pct = admin_override_percentage
        return _make(pct, "admin_override", f"Admin issued {pct}% refund manually.")

    # ── Provider trip-level cancel → always 100% ────────────────────────────
    if cancelled_by == "provider":
        return _make(100, "provider_cancel", "Trip cancelled by provider — full refund issued.")

    # ── System auto-cancel (awaiting_provider 3-day timeout) ────────────────
    if cancelled_by == "system":
        return _make(100, "system_auto_cancel", "Booking auto-cancelled by system — full refund issued.")

    # ── User-initiated cancellation below ───────────────────────────────────

    # Cooling-off: within 1 hour of payment AND deadline > 24h away
    if paid_at is not None:
        hours_since_payment = (_now_naive_utc() - paid_at).total_seconds() / 3600
        hours_to_deadline = _hours_until(registration_deadline)
        if hours_since_payment <= 1.0 and hours_to_deadline > 24:
            return _make(100, "cooling_off", "Cancelled within the 1-hour cooling-off period — full refund.")

    # ── Non-refundable (outside cooling-off) ────────────────────────────────
    if not is_refundable:
        return _make(0, "non_refundable", "This booking is non-refundable. No refund will be issued.")

    # ── Self-arranged refundable ─────────────────────────────────────────────
    if trip_type == "self_arranged":
        if registration_status == "awaiting_provider":
            return _make(
                100,
                "self_arranged_pre_confirm",
                "Cancelled before provider confirmed — full refund.",
            )
        else:
            # processing or confirmed → arrangements already started
            return _make(
                0,
                "self_arranged_post_confirm",
                "Provider has already confirmed and begun arrangements. No refund can be issued.",
            )

    # ── Guided refundable ────────────────────────────────────────────────────
    hours_to_deadline = _hours_until(registration_deadline)

    if hours_to_deadline <= 0:
        return _make(0, "guided_0_deadline_passed", "Registration deadline has passed — no refund.")

    if hours_to_deadline > 72:
        return _make(100, "guided_100", "Cancelled more than 72 hours before the registration deadline — full refund.")

    if hours_to_deadline >= 12:
        return _make(50, "guided_50", "Cancelled between 12 and 72 hours before the registration deadline — 50% refund.")

    return _make(0, "guided_0", "Cancelled less than 12 hours before the registration deadline — no refund.")
