"""EarningLine model — one row per paid booking, tracks platform cut and provider share."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlmodel import Field, SQLModel, Relationship


if TYPE_CHECKING:
    from .provider import Provider
    from .trip_registration import TripRegistration
    from .provider_payout import ProviderPayout


class EarningLine(SQLModel, table=True):
    """
    One row per paid TripRegistration once that booking becomes non-refundable.

    Created lazily (on first query) when compute_refund would return 0%
    for a user-initiated cancel — meaning the provider is owed that money.

    payout_id is NULL while unpaid; set when the admin includes this line
    in a ProviderPayout.
    """

    __tablename__ = "earning_lines"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    # One-to-one with TripRegistration (a booking produces at most one earning line)
    registration_id: uuid.UUID = Field(
        foreign_key="tripregistration.id", unique=True, index=True
    )

    # Denormalised for fast queries without joins
    provider_id: uuid.UUID = Field(foreign_key="provider.id", index=True)
    trip_id: uuid.UUID = Field(foreign_key="trip.id", index=True)

    # Financial amounts (SAR)
    gross_amount: Decimal = Field(max_digits=10, decimal_places=2)
    platform_cut_pct: Decimal = Field(max_digits=5, decimal_places=2)   # e.g. 10.00
    platform_cut_amount: Decimal = Field(max_digits=10, decimal_places=2)
    provider_amount: Decimal = Field(max_digits=10, decimal_places=2)

    # NULL = not yet included in any payout
    payout_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="provider_payouts.id", index=True
    )

    became_owed_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    provider: "Provider" = Relationship()
    payout: Optional["ProviderPayout"] = Relationship(back_populates="earning_lines")
