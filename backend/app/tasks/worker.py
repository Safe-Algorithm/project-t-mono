"""
Taskiq worker for scheduled tasks.

This module defines all scheduled tasks for the application including:
- Trip reminders (24 h before trip starts)
- Review reminders (1 day after trip ends)
- Spot reservation expiry (every minute)
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import List

from sqlmodel import Session, select

from app.core.taskiq_app import broker, scheduler
from app.core.config import settings
from app.core.db import engine
from app.models.trip import Trip
from app.models.trip_registration import TripRegistration
from app.services.notification import NotificationService
from app.utils.localization import get_name, get_description

logger = logging.getLogger(__name__)


@broker.task(schedule=[{"cron": settings.TASKIQ_TRIP_REMINDER_CRON}])
async def send_trip_reminders():
    """
    Send trip reminders to users 24 hours before their trip starts.
    Schedule configurable via TASKIQ_TRIP_REMINDER_CRON environment variable.
    """
    logger.info("Starting trip reminder task")
    
    try:
        with Session(engine) as session:
            notification_service = NotificationService()
            
            # Get trips starting in 24 hours
            tomorrow = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=1)
            tomorrow_start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
            tomorrow_end = tomorrow.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            # Query trips starting tomorrow
            statement = select(Trip).where(
                Trip.start_date >= tomorrow_start,
                Trip.start_date <= tomorrow_end
            )
            trips = session.exec(statement).all()
            
            logger.info(f"Found {len(trips)} trips starting tomorrow")
            
            # Send reminders for each trip
            for trip in trips:
                # Get all registrations for this trip
                registration_statement = select(TripRegistration).where(
                    TripRegistration.trip_id == trip.id,
                    TripRegistration.status == "confirmed"
                )
                registrations = session.exec(registration_statement).all()
                
                for registration in registrations:
                    try:
                        # Send notification via NotificationService
                        trip_name = get_name(trip)
                        await notification_service.send_trip_reminder(
                            user=registration.user,
                            trip_name=trip_name,
                            start_date=trip.start_date.strftime("%Y-%m-%d %H:%M"),
                            trip_details={
                                "duration": f"{(trip.end_date - trip.start_date).days} days",
                                "description": get_description(trip)
                            }
                        )
                        logger.info(f"Sent trip reminder to user {registration.user_id} for trip {trip.id}")
                    except Exception as e:
                        logger.error(f"Failed to send trip reminder to user {registration.user_id}: {e}")
            
            logger.info("Trip reminder task completed")
    
    except Exception as e:
        logger.error(f"Trip reminder task failed: {e}")
        raise


@broker.task(schedule=[{"cron": settings.TASKIQ_REVIEW_REMINDER_CRON}])
async def send_review_reminders():
    """
    Send review reminders to users 1 day after their trip ends.
    Schedule configurable via TASKIQ_REVIEW_REMINDER_CRON environment variable.
    """
    logger.info("Starting review reminder task")
    
    try:
        with Session(engine) as session:
            # Get trips that ended yesterday
            yesterday = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
            yesterday_start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
            yesterday_end = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            # Query trips that ended yesterday
            statement = select(Trip).where(
                Trip.end_date >= yesterday_start,
                Trip.end_date <= yesterday_end
            )
            trips = session.exec(statement).all()
            
            logger.info(f"Found {len(trips)} trips that ended yesterday")
            
            # Send review reminders for each trip
            for trip in trips:
                # Get all confirmed registrations for this trip
                registration_statement = select(TripRegistration).where(
                    TripRegistration.trip_id == trip.id,
                    TripRegistration.status == "confirmed"
                )
                registrations = session.exec(registration_statement).all()
                
                for registration in registrations:
                    try:
                        # Check if user already left a review
                        from app.models.links import TripRating
                        review_statement = select(TripRating).where(
                            TripRating.trip_id == trip.id,
                            TripRating.user_id == registration.user_id
                        )
                        existing_review = session.exec(review_statement).first()
                        
                        if not existing_review:
                            # Send review reminder via SMS/Email
                            trip_name = get_name(trip)
                            message = (
                                f"Hi {registration.user.name}! We hope you enjoyed your trip '{trip_name}'. "
                                f"Please take a moment to share your experience and leave a review. "
                                f"Your feedback helps other travelers!"
                            )
                            
                            # Send SMS if phone verified
                            if registration.user.is_phone_verified and registration.user.phone:
                                from app.services.sms import sms_service
                                await sms_service.send_sms(
                                    to_phone=registration.user.phone,
                                    message=message
                                )
                                logger.info(f"Sent SMS review reminder to {registration.user.phone}")
                            
                            # Send Email if email verified
                            if registration.user.is_email_verified and registration.user.email:
                                from app.services.email import email_service
                                await email_service.send_email(
                                    to_email=registration.user.email,
                                    subject=f"Share your experience - {trip_name}",
                                    html_content=f"""
                                    <html>
                                        <body>
                                            <h2>How was your trip?</h2>
                                            <p>Hi {registration.user.name}!</p>
                                            <p>We hope you enjoyed your trip '{trip_name}'.</p>
                                            <p>Please take a moment to share your experience and leave a review. Your feedback helps other travelers!</p>
                                            <p>Thank you,<br>Safe Algo Tourism Team</p>
                                        </body>
                                    </html>
                                    """
                                )
                                logger.info(f"Sent email review reminder to {registration.user.email}")
                            
                            logger.info(f"Sent review reminder to user {registration.user_id} for trip {trip.id}")
                    
                    except Exception as e:
                        logger.error(f"Failed to send review reminder to user {registration.user_id}: {e}")
            
            logger.info("Review reminder task completed")
    
    except Exception as e:
        logger.error(f"Review reminder task failed: {e}")
        raise


@broker.task(schedule=[{"cron": "* * * * *"}])  # Every minute
async def cancel_expired_spot_reservations():
    """
    Cancel registrations whose 15-minute spot reservation window has expired
    without payment being completed.

    For each expired registration we also attempt to void any INITIATED payment
    via Moyasar so the user cannot complete the transaction on Moyasar's side
    after the spot has been released.  Void failures are logged but do not
    prevent the registration from being cancelled.
    """
    logger.info("Checking for expired spot reservations")
    try:
        from app.models.payment import Payment, PaymentStatus
        from app.services.moyasar import payment_service

        with Session(engine) as session:
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            statement = select(TripRegistration).where(
                TripRegistration.status == "pending_payment",
                TripRegistration.spot_reserved_until != None,
                TripRegistration.spot_reserved_until <= now,
            )
            expired = session.exec(statement).all()
            logger.info(f"Found {len(expired)} expired spot reservations")

            for reg in expired:
                # Void any INITIATED payment so Moyasar also blocks completion
                initiated_payments = session.exec(
                    select(Payment).where(
                        Payment.registration_id == reg.id,
                        Payment.status == PaymentStatus.INITIATED,
                        Payment.moyasar_payment_id != None,
                    )
                ).all()

                for payment in initiated_payments:
                    try:
                        await payment_service.void_payment(payment.moyasar_payment_id)
                        payment.status = PaymentStatus.FAILED
                        payment.updated_at = now
                        session.add(payment)
                        logger.info(
                            f"Voided Moyasar payment {payment.moyasar_payment_id} "
                            f"for expired registration {reg.id}"
                        )
                    except Exception as void_err:
                        # Void may fail if the payment was never authorised on Moyasar's
                        # side (e.g. user never reached 3DS).  Mark it failed locally.
                        payment.status = PaymentStatus.FAILED
                        payment.updated_at = now
                        session.add(payment)
                        logger.warning(
                            f"Could not void Moyasar payment {payment.moyasar_payment_id}: "
                            f"{void_err} — marked FAILED locally"
                        )

                reg.status = "cancelled"
                reg.updated_at = now
                session.add(reg)

            session.commit()
    except Exception as e:
        logger.error(f"cancel_expired_spot_reservations failed: {e}")
        raise


