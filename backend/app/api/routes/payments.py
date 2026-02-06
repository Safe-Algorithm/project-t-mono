"""Payment API routes for Moyasar integration."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, Header
from sqlmodel import Session, select
from typing import List, Optional
import uuid
import hmac
import hashlib
import json
from app.utils.localization import get_name
from app.api.deps import get_session
from app.models.user import User
from app.models.payment import Payment, PaymentStatus, PaymentMethod
from app.models.trip_registration import TripRegistration
from app.schemas.payment import (
    PaymentCreate,
    PaymentResponse,
    PaymentInitiateResponse,
    PaymentWebhook,
    RefundRequest
)
from app.api.deps import get_current_active_user
from app.services.moyasar import payment_service
from app.core.config import settings

router = APIRouter()


@router.post("/create", response_model=PaymentInitiateResponse, status_code=201)
async def create_payment(
    *,
    session: Session = Depends(get_session),
    payment_in: PaymentCreate,
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a payment for a trip registration.
    
    This endpoint initiates a payment with Moyasar and returns the payment source URL
    for the user to complete the payment (3D Secure, etc.).
    """
    # Get the registration
    registration = session.get(TripRegistration, payment_in.registration_id)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    # Verify the registration belongs to the current user
    if registration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to pay for this registration")
    
    # Check if registration is in pending_payment status
    if registration.status != "pending_payment":
        raise HTTPException(
            status_code=400,
            detail=f"Registration is not pending payment. Current status: {registration.status}"
        )
    
    # Check if payment already exists for this registration
    existing_payment = session.exec(
        select(Payment).where(
            Payment.registration_id == payment_in.registration_id,
            Payment.status.in_([PaymentStatus.PAID, PaymentStatus.INITIATED])
        )
    ).first()
    
    if existing_payment:
        raise HTTPException(
            status_code=400,
            detail="Payment already exists for this registration"
        )
    
    # Get trip details for description
    trip = registration.trip
    description = f"Trip: {get_name(trip)} - Registration #{registration.id}"
    
    # Build callback URL
    callback_url = payment_in.callback_url or f"{settings.FRONTEND_URL}/payments/callback"
    
    # Create payment in database
    payment = Payment(
        registration_id=payment_in.registration_id,
        amount=registration.total_amount,
        currency="SAR",
        status=PaymentStatus.INITIATED,
        payment_method=payment_in.payment_method,
        description=description,
        callback_url=callback_url
    )
    session.add(payment)
    session.commit()
    session.refresh(payment)
    
    try:
        # Create payment with Moyasar
        moyasar_response = await payment_service.create_payment(
            amount=registration.total_amount,
            currency="SAR",
            description=description,
            callback_url=callback_url,
            source_type=payment_in.payment_method.value,
            metadata={
                "registration_id": str(registration.id),
                "payment_id": str(payment.id),
                "user_id": str(current_user.id),
                "trip_id": str(trip.id)
            }
        )
        
        # Update payment with Moyasar payment ID
        payment.moyasar_payment_id = moyasar_response["payment_id"]
        payment.moyasar_metadata = moyasar_response.get("metadata")
        session.add(payment)
        session.commit()
        session.refresh(payment)
        
        return PaymentInitiateResponse(
            payment_id=payment.id,
            moyasar_payment_id=moyasar_response["payment_id"],
            amount=Decimal(moyasar_response["amount"]) / 100,  # Convert from halalas
            currency=moyasar_response["currency"],
            status=moyasar_response["status"],
            source=moyasar_response["source"],
            callback_url=moyasar_response.get("callback_url")
        )
        
    except Exception as e:
        # Update payment status to failed
        payment.status = PaymentStatus.FAILED
        payment.failed_at = datetime.utcnow()
        payment.failure_reason = str(e)
        session.add(payment)
        session.commit()
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create payment with Moyasar: {str(e)}"
        )


@router.get("/callback")
async def payment_callback(
    *,
    session: Session = Depends(get_session),
    id: str,  # Moyasar payment ID from query params
):
    """
    Handle payment callback from Moyasar after user completes payment.
    
    This endpoint is called by Moyasar after the user completes the payment flow.
    It verifies the payment status and updates the registration accordingly.
    """
    try:
        # Get payment details from Moyasar
        moyasar_payment = await payment_service.get_payment_details(id)
        
        # Find payment in database
        payment = session.exec(
            select(Payment).where(Payment.moyasar_payment_id == id)
        ).first()
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        # Update payment status based on Moyasar response
        if moyasar_payment["status"] == "paid":
            payment.status = PaymentStatus.PAID
            payment.paid_at = datetime.utcnow()
            payment.fee = Decimal(moyasar_payment.get("fee", 0)) / 100 if moyasar_payment.get("fee") else None
            
            # Update registration status to confirmed
            registration = session.get(TripRegistration, payment.registration_id)
            if registration:
                registration.status = "confirmed"
                session.add(registration)
        
        elif moyasar_payment["status"] == "failed":
            payment.status = PaymentStatus.FAILED
            payment.failed_at = datetime.utcnow()
            payment.failure_reason = "Payment failed"
        
        payment.updated_at = datetime.utcnow()
        session.add(payment)
        session.commit()
        
        return {
            "message": "Payment callback processed",
            "status": payment.status,
            "payment_id": str(payment.id)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process payment callback: {str(e)}"
        )


@router.post("/webhook")
async def payment_webhook(
    *,
    request: Request,
    session: Session = Depends(get_session),
    x_moyasar_signature: str = Header(None)
):
    """
    Handle webhook events from Moyasar.
    
    Moyasar sends webhooks for payment events (paid, failed, refunded, etc.).
    This endpoint verifies the webhook signature and updates payment status.
    """
    # Get raw body for signature verification
    body = await request.body()
    payload = body.decode('utf-8')
    
    # Verify webhook signature
    if not x_moyasar_signature:
        raise HTTPException(status_code=400, detail="Missing signature header")
    
    try:
        is_valid = payment_service.verify_webhook_signature(payload, x_moyasar_signature)
        if not is_valid:
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # Parse webhook payload
    webhook_data = await request.json()
    
    # Find payment in database
    payment = session.exec(
        select(Payment).where(Payment.moyasar_payment_id == webhook_data["id"])
    ).first()
    
    if not payment:
        # Payment not found, but webhook is valid - log and return success
        return {"message": "Payment not found, webhook acknowledged"}
    
    # Update payment based on webhook event
    webhook_status = webhook_data["status"]
    
    if webhook_status == "paid":
        payment.status = PaymentStatus.PAID
        payment.paid_at = datetime.utcnow()
        payment.fee = Decimal(webhook_data.get("fee", 0)) / 100 if webhook_data.get("fee") else None
        
        # Update registration status
        registration = session.get(TripRegistration, payment.registration_id)
        if registration and registration.status == "pending_payment":
            registration.status = "confirmed"
            session.add(registration)
    
    elif webhook_status == "failed":
        payment.status = PaymentStatus.FAILED
        payment.failed_at = datetime.utcnow()
        payment.failure_reason = "Payment failed (webhook)"
    
    elif webhook_status == "refunded":
        payment.status = PaymentStatus.REFUNDED
        payment.refunded = True
        payment.refunded_amount = Decimal(webhook_data.get("refunded", 0)) / 100
        payment.refunded_at = datetime.utcnow()
        
        # Update registration status
        registration = session.get(TripRegistration, payment.registration_id)
        if registration:
            registration.status = "cancelled"
            session.add(registration)
    
    payment.updated_at = datetime.utcnow()
    session.add(payment)
    session.commit()
    
    return {"message": "Webhook processed successfully"}


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    *,
    session: Session = Depends(get_session),
    payment_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user)
):
    """Get payment details by ID."""
    payment = session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Verify the payment belongs to the current user
    registration = session.get(TripRegistration, payment.registration_id)
    if not registration or registration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this payment")
    
    return payment


@router.get("/registration/{registration_id}", response_model=List[PaymentResponse])
def get_payments_by_registration(
    *,
    session: Session = Depends(get_session),
    registration_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user)
):
    """Get all payments for a registration."""
    # Verify the registration belongs to the current user
    registration = session.get(TripRegistration, registration_id)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    if registration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view these payments")
    
    payments = session.exec(
        select(Payment).where(Payment.registration_id == registration_id)
    ).all()
    
    return payments


@router.post("/{payment_id}/refund", response_model=PaymentResponse)
async def refund_payment(
    *,
    session: Session = Depends(get_session),
    payment_id: uuid.UUID,
    refund_request: RefundRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Refund a payment (full or partial).
    
    Only the user who made the payment can request a refund.
    """
    payment = session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Verify the payment belongs to the current user
    registration = session.get(TripRegistration, payment.registration_id)
    if not registration or registration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to refund this payment")
    
    # Check if payment is paid
    if payment.status != PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Payment is not in paid status")
    
    # Check if already refunded
    if payment.refunded:
        raise HTTPException(status_code=400, detail="Payment already refunded")
    
    try:
        # Process refund with Moyasar
        refund_response = await payment_service.refund_payment(
            payment_id=payment.moyasar_payment_id,
            amount=refund_request.amount,
            description=refund_request.description
        )
        
        # Update payment
        payment.status = PaymentStatus.REFUNDED
        payment.refunded = True
        payment.refunded_amount = Decimal(refund_response["amount"]) / 100
        payment.refunded_at = datetime.utcnow()
        payment.updated_at = datetime.utcnow()
        
        # Update registration status
        registration.status = "cancelled"
        
        session.add(payment)
        session.add(registration)
        session.commit()
        session.refresh(payment)
        
        return payment
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process refund: {str(e)}"
        )
