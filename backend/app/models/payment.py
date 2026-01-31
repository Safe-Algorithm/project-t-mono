"""Payment model for tracking Moyasar payments."""

import uuid
from datetime import datetime
from typing import Optional
from decimal import Decimal
from sqlmodel import SQLModel, Field, Column, JSON
from enum import Enum


class PaymentStatus(str, Enum):
    """Payment status enum matching Moyasar statuses."""
    INITIATED = "initiated"
    PAID = "paid"
    FAILED = "failed"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    REFUNDED = "refunded"
    VOIDED = "voided"


class PaymentMethod(str, Enum):
    """Payment method types supported by Moyasar."""
    CREDITCARD = "creditcard"
    APPLEPAY = "applepay"
    STCPAY = "stcpay"
    MADA = "mada"


class Payment(SQLModel, table=True):
    """Payment model for tracking Moyasar payments."""
    
    __tablename__ = "payments"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    
    # Moyasar payment ID
    moyasar_payment_id: Optional[str] = Field(default=None, max_length=100, index=True)
    
    # Registration reference
    registration_id: uuid.UUID = Field(foreign_key="tripregistration.id", index=True)
    
    # Payment details
    amount: Decimal = Field(max_digits=10, decimal_places=2)
    currency: str = Field(default="SAR", max_length=3)
    status: PaymentStatus = Field(default=PaymentStatus.INITIATED)
    payment_method: Optional[PaymentMethod] = Field(default=None)
    
    # Payment description
    description: str = Field(max_length=500)
    
    # Callback URL
    callback_url: Optional[str] = Field(default=None, max_length=500)
    
    # Refund information
    refunded: bool = Field(default=False)
    refunded_amount: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=2)
    refunded_at: Optional[datetime] = Field(default=None)
    
    # Metadata from Moyasar
    moyasar_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    # Fee charged by Moyasar
    fee: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=2)
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    paid_at: Optional[datetime] = Field(default=None)
    failed_at: Optional[datetime] = Field(default=None)
    
    # Error information for failed payments
    failure_reason: Optional[str] = Field(default=None, max_length=500)
