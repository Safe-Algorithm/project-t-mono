"""RefundRecord model — audit trail for every refund action."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlmodel import Field, SQLModel


class RefundRecord(SQLModel, table=True):
    """Immutable audit record created for every refund or cancellation-with-no-refund event."""

    __tablename__ = "refundrecord"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    # Which registration this refund belongs to
    registration_id: uuid.UUID = Field(foreign_key="tripregistration.id", index=True)

    # Which payment was refunded (nullable — no refund = no payment to refund)
    payment_id: Optional[uuid.UUID] = Field(default=None, foreign_key="payments.id", index=True)
    moyasar_payment_id: Optional[str] = Field(default=None, max_length=100)

    # Who triggered the cancellation/refund
    # Values: 'user', 'provider', 'admin', 'system'
    cancelled_by: str = Field(max_length=50)

    # The actor's user UUID (null for 'system' auto-cancels)
    actor_user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id", index=True)

    # Refund outcome
    refund_percentage: int = Field()  # 0, 50, or 100
    refund_amount: Decimal = Field(decimal_places=2, max_digits=10)  # Actual SAR refunded
    original_amount: Decimal = Field(decimal_places=2, max_digits=10)  # Total paid

    # Policy rule that determined the refund (for audit clarity)
    # e.g. 'cooling_off', 'guided_100', 'guided_50', 'guided_0', 'self_arranged_pre_confirm',
    #       'self_arranged_post_confirm', 'non_refundable', 'provider_cancel', 'admin_override'
    refund_rule: str = Field(max_length=100)

    # Free-text reason provided by actor (optional)
    reason: Optional[str] = Field(default=None, max_length=500)

    # Moyasar refund response (for full traceability)
    moyasar_refund_response: Optional[str] = Field(default=None, max_length=1000)

    # Whether the Moyasar API call succeeded
    refund_succeeded: bool = Field(default=False)

    created_at: datetime = Field(default_factory=datetime.utcnow)
