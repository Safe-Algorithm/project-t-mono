"""ProviderPayout model — one record per admin pay-run for a provider."""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional, TYPE_CHECKING

from sqlmodel import Field, SQLModel, Relationship


if TYPE_CHECKING:
    from .earning_line import EarningLine
    from .provider import Provider
    from .user import User


class PayoutStatus(str, Enum):
    PENDING = "pending"       # created but bank transfer not yet confirmed
    COMPLETED = "completed"   # admin confirmed the transfer


class ProviderPayout(SQLModel, table=True):
    """
    One payout record per admin pay-run.

    The admin selects a set of EarningLines (via earning_lines relationship),
    records the bank transfer details, and marks it completed.
    EarningLine.payout_id is set to this record's id for each included line.
    """

    __tablename__ = "provider_payouts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    provider_id: uuid.UUID = Field(foreign_key="provider.id", index=True)

    # Totals (denormalised for fast display without re-summing lines)
    total_gross: Decimal = Field(max_digits=12, decimal_places=2)
    total_platform_cut: Decimal = Field(max_digits=12, decimal_places=2)
    total_provider_amount: Decimal = Field(max_digits=12, decimal_places=2)

    # How many booking lines are included
    booking_count: int = Field(default=0)

    status: PayoutStatus = Field(default=PayoutStatus.PENDING)

    # Admin-provided transfer details
    note: Optional[str] = Field(default=None, max_length=1000)
    bank_transfer_reference: Optional[str] = Field(default=None, max_length=200)
    receipt_file_url: Optional[str] = Field(default=None, max_length=500)

    # Audit
    paid_by_admin_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="user.id", index=True
    )
    paid_at: Optional[datetime] = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    provider: "Provider" = Relationship()
    paid_by_admin: Optional["User"] = Relationship()
    earning_lines: List["EarningLine"] = Relationship(back_populates="payout")
