"""Payment schemas for API requests and responses."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field
from app.models.payment import PaymentStatus, PaymentMethod


class PaymentCreate(BaseModel):
    """Schema for initiating a payment preparation."""
    registration_id: uuid.UUID
    payment_method: PaymentMethod = PaymentMethod.CREDITCARD
    redirect_url: Optional[str] = None  # App deep link to open after payment (e.g. rihlaapp://payment-callback)


class PaymentResponse(BaseModel):
    """Schema for payment response."""
    id: uuid.UUID
    moyasar_payment_id: Optional[str]
    registration_id: uuid.UUID
    amount: Decimal
    currency: str
    status: PaymentStatus
    payment_method: Optional[PaymentMethod]
    description: str
    callback_url: Optional[str]
    refunded: bool
    refunded_amount: Optional[Decimal]
    refunded_at: Optional[datetime]
    fee: Optional[Decimal]
    created_at: datetime
    updated_at: datetime
    paid_at: Optional[datetime]
    failed_at: Optional[datetime]
    failure_reason: Optional[str]
    
    class Config:
        from_attributes = True


class PaymentPrepareResponse(BaseModel):
    """
    Returned to the app before it calls Moyasar directly.
    The app uses its own EXPO_PUBLIC_MOYASAR_PUBLISHABLE_KEY env var.
    Card data must NEVER be sent to our backend.
    """
    payment_db_id: uuid.UUID       # Our internal payment record ID
    amount_halalas: int            # Amount in smallest unit (halalas) for Moyasar
    currency: str
    description: str
    callback_url: str              # HTTPS backend URL Moyasar will redirect to


class PaymentWebhook(BaseModel):
    """Schema for Moyasar webhook payload."""
    id: str
    status: str
    amount: int
    fee: Optional[int]
    currency: str
    refunded: Optional[int]
    refunded_at: Optional[str]
    captured: Optional[int]
    captured_at: Optional[str]
    voided_at: Optional[str]
    description: str
    amount_format: str
    fee_format: Optional[str]
    refunded_format: Optional[str]
    captured_format: Optional[str]
    invoice_id: Optional[str]
    ip: Optional[str]
    callback_url: Optional[str]
    created_at: str
    updated_at: str
    metadata: Optional[dict]
    source: dict


class RefundRequest(BaseModel):
    """Schema for refund request."""
    amount: Optional[Decimal] = Field(None, description="Amount to refund (leave empty for full refund)")
    description: Optional[str] = Field(None, description="Refund reason/description")
