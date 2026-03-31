"""CommissionRateHistory — audit log of every commission rate change per provider."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlmodel import Field, SQLModel

if TYPE_CHECKING:
    pass


class CommissionRateHistory(SQLModel, table=True):
    """
    One row per commission rate change for a provider.

    effective_from is the datetime the new rate took effect (set to utcnow()
    when the admin saves the change).  The rate that applies to a payment made
    at time T is the row whose effective_from is the largest value <= T.

    The very first row for a provider is written when the provider is created
    (or back-filled via the migration for existing providers).
    """

    __tablename__ = "commission_rate_history"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    provider_id: uuid.UUID = Field(foreign_key="provider.id", index=True)

    rate: Decimal = Field(max_digits=5, decimal_places=2)

    effective_from: datetime = Field(index=True)

    changed_by_admin_id: uuid.UUID = Field(
        default=None, foreign_key="user.id", nullable=True
    )

    created_at: datetime = Field(default_factory=datetime.utcnow)
