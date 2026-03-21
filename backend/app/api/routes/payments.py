"""Payment API routes for Moyasar integration."""

import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

import hmac
import hashlib
import json

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Header
from fastapi.responses import HTMLResponse
from sqlmodel import Session, select

from app.api.deps import get_current_active_user, get_session
from app.core.config import settings
from app.models.payment import Payment, PaymentStatus, PaymentMethod
from app.models.trip_registration import TripRegistration
from app.models.user import User
from app.schemas.payment import (
    PaymentCreate,
    PaymentPrepareResponse,
    PaymentResponse,
    RefundRequest,
)
from app.services.moyasar import payment_service
from app.services.fcm import fcm_service
from app.models.user_push_token import UserPushToken
from app.utils.localization import get_name

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prepare — app calls this first to get payment details, then calls Moyasar
# directly using its own publishable key. Card data never touches our backend.
# ---------------------------------------------------------------------------

@router.post("/prepare", response_model=PaymentPrepareResponse, status_code=201)
def prepare_payment(
    *,
    session: Session = Depends(get_session),
    payment_in: PaymentCreate,
    current_user: User = Depends(get_current_active_user),
):
    """
    Prepare a payment record and return the details the app needs to call
    Moyasar directly.

    Flow:
      1. App calls POST /payments/prepare  →  gets { payment_db_id, amount_halalas,
         currency, description, callback_url }
      2. App calls Moyasar API directly with its EXPO_PUBLIC_MOYASAR_PUBLISHABLE_KEY
         and the card details (card data never reaches our backend — Moyasar policy).
      3. App calls POST /payments/confirm to store the Moyasar payment ID.
      4. Moyasar hits GET /payments/callback after 3DS; backend updates DB and
         redirects the browser to the app deep link supplied in redirect_url.
    """
    registration = session.get(TripRegistration, payment_in.registration_id)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    if registration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if registration.status != "pending_payment":
        raise HTTPException(
            status_code=400,
            detail=f"Registration is not pending payment. Current status: {registration.status}",
        )

    # Guard: no double-payment
    already_paid = session.exec(
        select(Payment).where(
            Payment.registration_id == payment_in.registration_id,
            Payment.status == PaymentStatus.PAID,
        )
    ).first()
    if already_paid:
        raise HTTPException(status_code=400, detail="Payment already completed")

    # Cancel any stale INITIATED payments so the user can retry cleanly.
    # Also attempt to void them at Moyasar so a dangling authorisation can't
    # later complete and charge the card a second time.
    stale = session.exec(
        select(Payment).where(
            Payment.registration_id == payment_in.registration_id,
            Payment.status == PaymentStatus.INITIATED,
        )
    ).all()
    for p in stale:
        if p.moyasar_payment_id:
            import threading, asyncio
            moyasar_id = p.moyasar_payment_id
            def _void(mid: str) -> None:
                try:
                    asyncio.run(payment_service.void_payment(mid))
                except Exception:
                    pass  # best-effort; DB record is marked FAILED regardless
            threading.Thread(target=_void, args=(moyasar_id,), daemon=True).start()
        p.status = PaymentStatus.FAILED
        session.add(p)

    # Set the 15-minute spot reservation window only on first attempt (don't reset on retries)
    now_utc = datetime.utcnow()
    if not registration.spot_reserved_until or registration.spot_reserved_until < now_utc:
        registration.spot_reserved_until = now_utc + timedelta(minutes=15)
    session.add(registration)

    trip = registration.trip
    description = f"Trip: {get_name(trip)} - Registration #{registration.id}"

    # The Moyasar callback must be an HTTPS URL pointing to our backend.
    # We append ngrok-skip-browser-warning so ngrok doesn't show its warning
    # page when Moyasar redirects the browser here after 3DS.
    moyasar_callback_url = (
        f"{settings.BACKEND_URL}/api/v1/payments/callback"
        "?ngrok-skip-browser-warning=true"
    )

    # Store the app's redirect deep link so the callback handler can use it
    # without hardcoding it in the backend.
    app_redirect_url = payment_in.redirect_url or f"{settings.APP_DEEP_LINK_SCHEME}://payment-callback"

    payment = Payment(
        registration_id=payment_in.registration_id,
        amount=registration.total_amount,
        currency="SAR",
        status=PaymentStatus.INITIATED,
        payment_method=payment_in.payment_method,
        description=description,
        # callback_url stores the app deep link base (used after Moyasar callback)
        callback_url=app_redirect_url,
    )
    session.add(payment)
    session.commit()
    session.refresh(payment)

    return PaymentPrepareResponse(
        payment_db_id=payment.id,
        amount_halalas=int(registration.total_amount * 100),
        currency="SAR",
        description=description,
        callback_url=moyasar_callback_url,
    )


# ---------------------------------------------------------------------------
# Confirm — app calls this after Moyasar returns a payment ID, so our DB
# record can be matched when Moyasar hits the callback URL.
# ---------------------------------------------------------------------------

@router.post("/confirm", status_code=200)
def confirm_payment(
    *,
    session: Session = Depends(get_session),
    payment_db_id: uuid.UUID,
    moyasar_payment_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """
    Store the Moyasar payment ID on our payment record so the callback
    endpoint can look it up when Moyasar redirects after 3DS.
    """
    payment = session.get(Payment, payment_db_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    registration = session.get(TripRegistration, payment.registration_id)
    if not registration or registration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    payment.moyasar_payment_id = moyasar_payment_id
    session.add(payment)
    session.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Callback — Moyasar redirects the browser here after 3DS completes.
# We verify the payment with our secret key, update the DB, then serve
# an HTML page that triggers the app deep link.
# ---------------------------------------------------------------------------

@router.get("/callback")
async def payment_callback(
    *,
    session: Session = Depends(get_session),
    id: str,  # Moyasar payment ID passed as query param by Moyasar
):
    """
    Called by Moyasar (via browser redirect) after the user completes 3DS.

    We verify the payment status using our secret key (never exposed to the
    app), update the DB, then serve an HTML page whose JS triggers the app
    deep link stored in payment.callback_url.
    """
    try:
        moyasar_payment = await payment_service.get_payment_details(id)

        payment = session.exec(
            select(Payment).where(Payment.moyasar_payment_id == id)
        ).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        registration = None
        if moyasar_payment["status"] == "paid":
            if payment.status != PaymentStatus.PAID:
                payment.status = PaymentStatus.PAID
                payment.paid_at = datetime.utcnow()
                if moyasar_payment.get("fee"):
                    payment.fee = Decimal(moyasar_payment["fee"]) / 100

                registration = session.get(TripRegistration, payment.registration_id)
                if registration and registration.status == "pending_payment":
                    trip_obj = registration.trip
                    if trip_obj and getattr(trip_obj, 'trip_type', None) and trip_obj.trip_type.value == 'self_arranged':
                        registration.status = "awaiting_provider"
                    else:
                        registration.status = "confirmed"
                    session.add(registration)

                payment.updated_at = datetime.utcnow()
                session.add(payment)
                session.commit()
            # Already PAID — idempotent, skip DB write

        elif moyasar_payment["status"] == "failed":
            if payment.status not in (PaymentStatus.PAID, PaymentStatus.FAILED):
                payment.status = PaymentStatus.FAILED
                payment.failed_at = datetime.utcnow()
                payment.failure_reason = "Payment failed"
                payment.updated_at = datetime.utcnow()
                session.add(payment)
                session.commit()

        # Send confirmation email + push after successful payment
        if registration and registration.status in ("confirmed", "awaiting_provider"):
            from app.models.user import User as UserModel
            from app.services.email import email_service
            from app.utils.localization import get_localized_field
            import asyncio
            user = session.get(UserModel, registration.user_id)
            if user:
                trip = registration.trip
                lang = getattr(user, "preferred_language", "en") or "en"
                trip_name = get_localized_field(trip, "name", lang) if trip else "Trip"
                reg_id = str(registration.id)
                if user.email:
                    start_date = trip.start_date.strftime("%Y-%m-%d") if trip and trip.start_date else ""
                    asyncio.create_task(email_service.send_booking_confirmation_email(
                        to_email=user.email,
                        to_name=user.name,
                        trip_name=trip_name,
                        booking_reference=registration.booking_reference or str(registration.id)[:8].upper(),
                        start_date=start_date,
                        total_amount=f"{registration.total_amount} SAR",
                        language=lang,
                    ))
                tokens = [pt.token for pt in session.exec(
                    select(UserPushToken).where(UserPushToken.user_id == user.id)
                ).all()]
                for token in tokens:
                    if registration.status == "awaiting_provider":
                        asyncio.create_task(fcm_service.notify_awaiting_provider(
                            fcm_token=token, trip_name=trip_name, lang=lang, registration_id=reg_id,
                        ))
                    else:
                        asyncio.create_task(fcm_service.notify_booking_confirmed(
                            fcm_token=token, trip_name=trip_name,
                            reference=registration.booking_reference or str(registration.id)[:8].upper(),
                            lang=lang, registration_id=reg_id,
                        ))

        # Build the deep link using the redirect URL the app provided at /prepare.
        # Query params carry the result so the app can act accordingly.
        registration_id = str(payment.registration_id)
        status_val = payment.status.value
        base_redirect = payment.callback_url or f"{settings.APP_DEEP_LINK_SCHEME}://payment-callback"
        deep_link = f"{base_redirect}?registrationId={registration_id}&status={status_val}"

        # Serve an HTML page that triggers the deep link via JS.
        # A plain HTTP redirect to a custom scheme (rihlaapp://) is not followed
        # by browsers — JS navigation is required.
        html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Payment Complete</title>
  <style>
    body{{font-family:sans-serif;display:flex;align-items:center;justify-content:center;
         min-height:100vh;margin:0;background:#f0fdf4;}}
    .card{{background:#fff;border-radius:16px;padding:32px;text-align:center;
           box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:360px;width:90%;}}
    h2{{color:#16a34a;margin:0 0 8px;}}
    p{{color:#6b7280;margin:0 0 24px;}}
    a.btn{{display:block;background:#0ea5e9;color:#fff;text-decoration:none;
           padding:14px 24px;border-radius:12px;font-size:16px;font-weight:600;}}
  </style>
  <script>
    window.onload = function() {{
      window.location.href = "{deep_link}";
      setTimeout(function() {{
        document.getElementById('btn').style.display = 'block';
      }}, 1500);
    }};
  </script>
</head>
<body>
  <div class="card">
    <h2>&#10003; Payment Complete</h2>
    <p>Returning you to the app&hellip;</p>
    <a id="btn" class="btn" href="{deep_link}" style="display:none;">Open Rihla App</a>
  </div>
</body>
</html>"""
        return HTMLResponse(content=html, headers={"ngrok-skip-browser-warning": "true"})

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process payment callback: {str(e)}",
        )


# ---------------------------------------------------------------------------
# Webhook — Moyasar server-to-server event (paid, failed, refunded, etc.)
# This is a belt-and-suspenders mechanism alongside the callback.
# ---------------------------------------------------------------------------

@router.post("/webhook")
async def payment_webhook(
    *,
    background_tasks: BackgroundTasks,
    request: Request,
    session: Session = Depends(get_session),
    x_event_secret: str = Header(None),
):
    """
    Handle server-to-server webhook events from Moyasar.
    Verifies the HMAC-SHA256 signature when a webhook secret is configured.
    If no secret is configured, the signature check is skipped with a warning.
    """
    body = await request.body()
    payload_str = body.decode("utf-8")

    if not payment_service.webhook_secret:
        logger.warning("MOYASAR_WEBHOOK_SECRET not set; skipping webhook secret verification")
    elif not x_event_secret:
        logger.warning(
            "WEBHOOK: x-event-secret header missing — processing anyway. "
            "Headers received: %s",
            dict(request.headers),
        )
    elif not hmac.compare_digest(x_event_secret, payment_service.webhook_secret):
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    webhook_data = json.loads(payload_str)
    moyasar_id = webhook_data.get("id")

    payment = session.exec(
        select(Payment).where(Payment.moyasar_payment_id == moyasar_id)
    ).first()
    if not payment:
        # Valid signature but unknown payment — acknowledge and ignore
        return {"message": "Webhook acknowledged"}

    webhook_status = webhook_data.get("status")

    confirmed_registration = None
    if webhook_status == "paid" and payment.status != PaymentStatus.PAID:
        payment.status = PaymentStatus.PAID
        payment.paid_at = datetime.utcnow()
        if webhook_data.get("fee"):
            payment.fee = Decimal(webhook_data["fee"]) / 100

        registration = session.get(TripRegistration, payment.registration_id)
        if registration and registration.status == "pending_payment":
            trip_obj = registration.trip
            if trip_obj and getattr(trip_obj, 'trip_type', None) and trip_obj.trip_type.value == 'self_arranged':
                registration.status = "awaiting_provider"
            else:
                registration.status = "confirmed"
            session.add(registration)
            confirmed_registration = registration

    elif webhook_status == "failed" and payment.status != PaymentStatus.FAILED:
        payment.status = PaymentStatus.FAILED
        payment.failed_at = datetime.utcnow()
        payment.failure_reason = "Payment failed (webhook)"

    elif webhook_status == "refunded":
        payment.status = PaymentStatus.REFUNDED
        payment.refunded = True
        payment.refunded_amount = Decimal(webhook_data.get("refunded", 0)) / 100
        payment.refunded_at = datetime.utcnow()

        registration = session.get(TripRegistration, payment.registration_id)
        if registration:
            registration.status = "cancelled"
            session.add(registration)

    payment.updated_at = datetime.utcnow()
    session.add(payment)
    session.commit()

    # Send confirmation email + push after successful webhook payment
    if confirmed_registration:
        from app.models.user import User as UserModel
        from app.services.email import email_service
        from app.utils.localization import get_localized_field
        user = session.get(UserModel, confirmed_registration.user_id)
        if user:
            trip = confirmed_registration.trip
            lang = getattr(user, "preferred_language", "en") or "en"
            trip_name = get_localized_field(trip, "name", lang) if trip else "Trip"
            reg_id = str(confirmed_registration.id)
            if user.email:
                start_date = trip.start_date.strftime("%Y-%m-%d") if trip and trip.start_date else ""
                background_tasks.add_task(
                    email_service.send_booking_confirmation_email,
                    to_email=user.email,
                    to_name=user.name,
                    trip_name=trip_name,
                    booking_reference=confirmed_registration.booking_reference or str(confirmed_registration.id)[:8].upper(),
                    start_date=start_date,
                    total_amount=f"{confirmed_registration.total_amount} SAR",
                    language=lang,
                )
            tokens = [pt.token for pt in session.exec(
                select(UserPushToken).where(UserPushToken.user_id == user.id)
            ).all()]
            for token in tokens:
                if confirmed_registration.status == "awaiting_provider":
                    background_tasks.add_task(
                        fcm_service.notify_awaiting_provider,
                        fcm_token=token, trip_name=trip_name, lang=lang, registration_id=reg_id,
                    )
                else:
                    background_tasks.add_task(
                        fcm_service.notify_booking_confirmed,
                        fcm_token=token, trip_name=trip_name,
                        reference=confirmed_registration.booking_reference or str(confirmed_registration.id)[:8].upper(),
                        lang=lang, registration_id=reg_id,
                    )

    return {"message": "Webhook processed"}


# ---------------------------------------------------------------------------
# Read endpoints
# ---------------------------------------------------------------------------

@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    *,
    session: Session = Depends(get_session),
    payment_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
):
    """Get a single payment by ID (must belong to current user)."""
    payment = session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    registration = session.get(TripRegistration, payment.registration_id)
    if not registration or registration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return payment


@router.get("/registration/{registration_id}", response_model=List[PaymentResponse])
def get_payments_by_registration(
    *,
    session: Session = Depends(get_session),
    registration_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
):
    """Get all payments for a registration (must belong to current user)."""
    registration = session.get(TripRegistration, registration_id)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    if registration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return session.exec(
        select(Payment).where(Payment.registration_id == registration_id)
    ).all()


# ---------------------------------------------------------------------------
# Refund
# ---------------------------------------------------------------------------

@router.post("/{payment_id}/refund", response_model=PaymentResponse)
async def refund_payment(
    *,
    session: Session = Depends(get_session),
    payment_id: uuid.UUID,
    refund_request: RefundRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Request a full or partial refund for a completed payment."""
    payment = session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    registration = session.get(TripRegistration, payment.registration_id)
    if not registration or registration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if payment.status != PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Only paid payments can be refunded")
    if payment.refunded:
        raise HTTPException(status_code=400, detail="Payment already refunded")

    try:
        refund_response = await payment_service.refund_payment(
            payment_id=payment.moyasar_payment_id,
            amount=refund_request.amount,
            description=refund_request.description,
        )

        payment.status = PaymentStatus.REFUNDED
        payment.refunded = True
        payment.refunded_amount = Decimal(refund_response["amount"]) / 100
        payment.refunded_at = datetime.utcnow()
        payment.updated_at = datetime.utcnow()

        registration.status = "cancelled"
        session.add(payment)
        session.add(registration)
        session.commit()
        session.refresh(payment)
        return payment

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Refund failed: {str(e)}")
