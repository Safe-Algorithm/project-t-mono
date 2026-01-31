"""Payment audit logging service."""

import uuid
from typing import Optional, Dict, Any
from sqlmodel import Session
from datetime import datetime

from app.models.payment_audit_log import PaymentAuditLog, PaymentEventType


class PaymentAuditService:
    """Service for logging payment-related events for security and compliance."""
    
    @staticmethod
    def log_event(
        session: Session,
        event_type: PaymentEventType,
        event_description: str,
        payment_id: Optional[uuid.UUID] = None,
        moyasar_payment_id: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_data: Optional[Dict[str, Any]] = None,
        response_data: Optional[Dict[str, Any]] = None,
        old_status: Optional[str] = None,
        new_status: Optional[str] = None,
        error_message: Optional[str] = None,
        error_code: Optional[str] = None,
        webhook_signature: Optional[str] = None,
        webhook_verified: Optional[bool] = None,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> PaymentAuditLog:
        """
        Log a payment event to the audit log.
        
        This creates a permanent record of all payment-related actions for:
        - Security monitoring
        - Compliance requirements
        - Debugging payment issues
        - Financial reconciliation
        """
        audit_log = PaymentAuditLog(
            payment_id=payment_id,
            moyasar_payment_id=moyasar_payment_id,
            event_type=event_type,
            event_description=event_description,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_data=request_data,
            response_data=response_data,
            old_status=old_status,
            new_status=new_status,
            error_message=error_message,
            error_code=error_code,
            webhook_signature=webhook_signature,
            webhook_verified=webhook_verified,
            extra_data=extra_data
        )
        
        session.add(audit_log)
        session.commit()
        session.refresh(audit_log)
        
        return audit_log
    
    @staticmethod
    def log_payment_created(
        session: Session,
        payment_id: uuid.UUID,
        user_id: uuid.UUID,
        amount: float,
        currency: str,
        ip_address: Optional[str] = None
    ):
        """Log payment creation event."""
        return PaymentAuditService.log_event(
            session=session,
            event_type=PaymentEventType.PAYMENT_CREATED,
            event_description=f"Payment created for {amount} {currency}",
            payment_id=payment_id,
            user_id=user_id,
            ip_address=ip_address,
            new_status="initiated",
            extra_data={"amount": amount, "currency": currency}
        )
    
    @staticmethod
    def log_payment_status_change(
        session: Session,
        payment_id: uuid.UUID,
        moyasar_payment_id: str,
        old_status: str,
        new_status: str,
        user_id: Optional[uuid.UUID] = None
    ):
        """Log payment status change."""
        return PaymentAuditService.log_event(
            session=session,
            event_type=PaymentEventType.STATUS_CHANGED,
            event_description=f"Payment status changed from {old_status} to {new_status}",
            payment_id=payment_id,
            moyasar_payment_id=moyasar_payment_id,
            user_id=user_id,
            old_status=old_status,
            new_status=new_status
        )
    
    @staticmethod
    def log_webhook_received(
        session: Session,
        moyasar_payment_id: str,
        webhook_data: Dict[str, Any],
        signature: str,
        verified: bool,
        ip_address: Optional[str] = None
    ):
        """Log webhook receipt and verification."""
        event_type = PaymentEventType.WEBHOOK_VERIFIED if verified else PaymentEventType.WEBHOOK_FAILED
        
        return PaymentAuditService.log_event(
            session=session,
            event_type=event_type,
            event_description=f"Webhook received for payment {moyasar_payment_id}",
            moyasar_payment_id=moyasar_payment_id,
            ip_address=ip_address,
            request_data=webhook_data,
            webhook_signature=signature,
            webhook_verified=verified,
            error_message="Invalid signature" if not verified else None
        )
    
    @staticmethod
    def log_api_call(
        session: Session,
        payment_id: Optional[uuid.UUID],
        moyasar_payment_id: Optional[str],
        endpoint: str,
        success: bool,
        request_data: Optional[Dict[str, Any]] = None,
        response_data: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None
    ):
        """Log Moyasar API call."""
        event_type = PaymentEventType.API_CALL_SUCCESS if success else PaymentEventType.API_CALL_FAILED
        
        return PaymentAuditService.log_event(
            session=session,
            event_type=event_type,
            event_description=f"Moyasar API call to {endpoint}",
            payment_id=payment_id,
            moyasar_payment_id=moyasar_payment_id,
            request_data=request_data,
            response_data=response_data,
            error_message=error_message
        )
    
    @staticmethod
    def log_refund(
        session: Session,
        payment_id: uuid.UUID,
        moyasar_payment_id: str,
        user_id: uuid.UUID,
        amount: float,
        reason: Optional[str] = None,
        ip_address: Optional[str] = None
    ):
        """Log refund request."""
        return PaymentAuditService.log_event(
            session=session,
            event_type=PaymentEventType.REFUND_REQUESTED,
            event_description=f"Refund requested for {amount}",
            payment_id=payment_id,
            moyasar_payment_id=moyasar_payment_id,
            user_id=user_id,
            ip_address=ip_address,
            extra_data={"amount": amount, "reason": reason}
        )


# Singleton instance
audit_service = PaymentAuditService()
