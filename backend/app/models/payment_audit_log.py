"""Payment Audit Log model for tracking all payment-related events."""

import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column, JSON
from enum import Enum


class PaymentEventType(str, Enum):
    """Payment event types for audit logging."""
    PAYMENT_CREATED = "payment_created"
    PAYMENT_INITIATED = "payment_initiated"
    PAYMENT_PAID = "payment_paid"
    PAYMENT_FAILED = "payment_failed"
    PAYMENT_REFUNDED = "payment_refunded"
    PAYMENT_VOIDED = "payment_voided"
    WEBHOOK_RECEIVED = "webhook_received"
    WEBHOOK_VERIFIED = "webhook_verified"
    WEBHOOK_FAILED = "webhook_failed"
    API_CALL_SUCCESS = "api_call_success"
    API_CALL_FAILED = "api_call_failed"
    STATUS_CHANGED = "status_changed"
    REFUND_REQUESTED = "refund_requested"
    REFUND_PROCESSED = "refund_processed"


class PaymentAuditLog(SQLModel, table=True):
    """
    Audit log for all payment-related events.
    
    This table provides a complete audit trail for compliance, debugging,
    and security monitoring. Every payment action is logged here.
    """
    
    __tablename__ = "payment_audit_logs"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    
    # Payment reference
    payment_id: Optional[uuid.UUID] = Field(default=None, foreign_key="payments.id", index=True)
    moyasar_payment_id: Optional[str] = Field(default=None, max_length=100, index=True)
    
    # Event details
    event_type: PaymentEventType = Field(index=True)
    event_description: str = Field(max_length=500)
    
    # User/Actor information
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id", index=True)
    ip_address: Optional[str] = Field(default=None, max_length=45)  # IPv6 support
    user_agent: Optional[str] = Field(default=None, max_length=500)
    
    # Request/Response data (for debugging)
    request_data: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    response_data: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    # Status tracking
    old_status: Optional[str] = Field(default=None, max_length=50)
    new_status: Optional[str] = Field(default=None, max_length=50)
    
    # Error information
    error_message: Optional[str] = Field(default=None, max_length=1000)
    error_code: Optional[str] = Field(default=None, max_length=50)
    
    # Webhook specific
    webhook_signature: Optional[str] = Field(default=None, max_length=500)
    webhook_verified: Optional[bool] = Field(default=None)
    
    # Timestamp
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    
    # Extra data for additional context
    extra_data: Optional[dict] = Field(default=None, sa_column=Column(JSON))
