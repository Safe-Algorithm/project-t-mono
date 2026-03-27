"""Schemas for the financials / payouts system."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from app.models.provider_payout import PayoutStatus


# ─── EarningLine ─────────────────────────────────────────────────────────────

class EarningLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    registration_id: uuid.UUID
    provider_id: uuid.UUID
    trip_id: uuid.UUID
    gross_amount: Decimal
    platform_cut_pct: Decimal
    platform_cut_amount: Decimal
    provider_amount: Decimal
    payout_id: Optional[uuid.UUID]
    became_owed_at: datetime
    created_at: datetime

    # Denormalised from joined data (populated by CRUD)
    booking_reference: Optional[str] = None
    trip_name: Optional[str] = None
    booking_date: Optional[datetime] = None


# ─── ProviderPayout ───────────────────────────────────────────────────────────

class PayoutCreate(BaseModel):
    earning_line_ids: List[uuid.UUID]
    note: Optional[str] = None
    bank_transfer_reference: Optional[str] = None


class PayoutComplete(BaseModel):
    receipt_file_url: Optional[str] = None
    note: Optional[str] = None
    bank_transfer_reference: Optional[str] = None


class ProviderPayoutRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider_id: uuid.UUID
    total_gross: Decimal
    total_platform_cut: Decimal
    total_provider_amount: Decimal
    booking_count: int
    status: PayoutStatus
    note: Optional[str]
    bank_transfer_reference: Optional[str]
    receipt_file_url: Optional[str]
    paid_by_admin_id: Optional[uuid.UUID]
    paid_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    # Populated by CRUD
    provider_name: Optional[str] = None
    paid_by_admin_name: Optional[str] = None


class ProviderPayoutDetail(ProviderPayoutRead):
    earning_lines: List[EarningLineRead] = []


# ─── Provider summary ─────────────────────────────────────────────────────────

class ProviderFinancialSummary(BaseModel):
    provider_id: uuid.UUID
    provider_name: str
    commission_rate: Decimal
    total_gross_earned: Decimal           # all-time gross from paid bookings
    total_platform_cut: Decimal           # all-time platform cut
    total_provider_earned: Decimal        # all-time provider share
    total_paid_out: Decimal               # sum of completed payouts
    total_owed: Decimal                   # currently owed (not yet in a payout)
    last_payout_date: Optional[datetime]
    unpaid_booking_count: int


class AdminFinancialsOverview(BaseModel):
    providers: List[ProviderFinancialSummary]
    grand_total_owed: Decimal
    grand_total_paid_out: Decimal


# ─── Trip-level financial breakdown ──────────────────────────────────────────

class TripEarningStatus(BaseModel):
    """Status of a single booking's earning line within a trip."""
    registration_id: uuid.UUID
    booking_reference: str
    booking_date: datetime
    gross_amount: Decimal
    platform_cut_amount: Decimal
    provider_amount: Decimal
    status: str          # "paid_out" | "owed" | "refundable" | "cancelled"
    payout_id: Optional[uuid.UUID] = None
    paid_out_at: Optional[datetime] = None
    # Admin view includes user info
    user_name: Optional[str] = None
    user_email: Optional[str] = None


class TripFinancialSummary(BaseModel):
    trip_id: uuid.UUID
    trip_name: str
    total_bookings: int
    paid_out_count: int
    owed_count: int
    refundable_count: int
    cancelled_count: int
    total_gross: Decimal
    total_platform_cut: Decimal
    total_provider_amount: Decimal
    paid_out_amount: Decimal
    owed_amount: Decimal


class TripFinancialDetail(TripFinancialSummary):
    bookings: List[TripEarningStatus] = []


# ─── Commission update ────────────────────────────────────────────────────────

class CommissionUpdate(BaseModel):
    commission_rate: Decimal


# ─── Provider panel summary ───────────────────────────────────────────────────

class ProviderFinancialsSelf(BaseModel):
    commission_rate: Decimal
    total_gross_earned: Decimal
    total_platform_cut: Decimal
    total_provider_earned: Decimal
    total_paid_out: Decimal
    total_owed: Decimal
    unpaid_booking_count: int
    last_payout_date: Optional[datetime] = None
