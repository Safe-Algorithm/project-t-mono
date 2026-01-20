"""
Taskiq worker for scheduled tasks.

This module defines all scheduled tasks for the application including:
- Trip reminders (before trip starts)
- Review reminders (after trip ends)
- Payment reminders
- Booking confirmations
"""

import logging
from datetime import datetime, timedelta
from typing import List

from sqlmodel import Session, select

from app.core.taskiq_app import broker, scheduler
from app.core.config import settings
from app.core.db import engine
from app.models.trip import Trip
from app.models.booking import Booking
from app.services.notification import NotificationService

logger = logging.getLogger(__name__)


@broker.task(schedule=[{"cron": "0 9 * * *"}])  # Run daily at 9 AM
async def send_trip_reminders():
    """
    Send trip reminders to users 24 hours before their trip starts.
    Runs daily at 9 AM to check for trips starting tomorrow.
    """
    logger.info("Starting trip reminder task")
    
    try:
        with Session(engine) as session:
            notification_service = NotificationService()
            
            # Get trips starting in 24 hours
            tomorrow = datetime.utcnow() + timedelta(days=1)
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
                # Get all bookings for this trip
                booking_statement = select(Booking).where(
                    Booking.trip_id == trip.id,
                    Booking.status == "confirmed"
                )
                bookings = session.exec(booking_statement).all()
                
                for booking in bookings:
                    try:
                        await notification_service.send_trip_reminder(
                            user=booking.user,
                            trip=trip,
                            booking=booking
                        )
                        logger.info(f"Sent trip reminder to user {booking.user_id} for trip {trip.id}")
                    except Exception as e:
                        logger.error(f"Failed to send trip reminder to user {booking.user_id}: {e}")
            
            logger.info("Trip reminder task completed")
    
    except Exception as e:
        logger.error(f"Trip reminder task failed: {e}")
        raise


@broker.task(schedule=[{"cron": "0 10 * * *"}])  # Run daily at 10 AM
async def send_review_reminders():
    """
    Send review reminders to users 1 day after their trip ends.
    Runs daily at 10 AM to check for trips that ended yesterday.
    """
    logger.info("Starting review reminder task")
    
    try:
        with Session(engine) as session:
            notification_service = NotificationService()
            
            # Get trips that ended yesterday
            yesterday = datetime.utcnow() - timedelta(days=1)
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
                # Get all confirmed bookings for this trip
                booking_statement = select(Booking).where(
                    Booking.trip_id == trip.id,
                    Booking.status == "confirmed"
                )
                bookings = session.exec(booking_statement).all()
                
                for booking in bookings:
                    try:
                        # Check if user already left a review
                        from app.models.review import Review
                        review_statement = select(Review).where(
                            Review.trip_id == trip.id,
                            Review.user_id == booking.user_id
                        )
                        existing_review = session.exec(review_statement).first()
                        
                        if not existing_review:
                            # Send review reminder via SMS/Email
                            message = (
                                f"Hi {booking.user.name}! We hope you enjoyed your trip to {trip.destination}. "
                                f"Please take a moment to share your experience and leave a review. "
                                f"Your feedback helps other travelers!"
                            )
                            
                            if booking.user.is_phone_verified and booking.user.phone:
                                from app.services.sms import sms_service
                                await sms_service.send_sms(
                                    to_phone=booking.user.phone,
                                    message=message
                                )
                            
                            if booking.user.is_email_verified and booking.user.email:
                                from app.services.email import email_service
                                # TODO: Create dedicated review reminder email template
                                logger.info(f"Would send review reminder email to {booking.user.email}")
                            
                            logger.info(f"Sent review reminder to user {booking.user_id} for trip {trip.id}")
                    
                    except Exception as e:
                        logger.error(f"Failed to send review reminder to user {booking.user_id}: {e}")
            
            logger.info("Review reminder task completed")
    
    except Exception as e:
        logger.error(f"Review reminder task failed: {e}")
        raise


@broker.task(schedule=[{"cron": "0 */6 * * *"}])  # Run every 6 hours
async def send_payment_reminders():
    """
    Send payment reminders for pending bookings.
    Runs every 6 hours to remind users with pending payments.
    """
    logger.info("Starting payment reminder task")
    
    try:
        with Session(engine) as session:
            # Get bookings with pending payment older than 1 hour
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)
            
            statement = select(Booking).where(
                Booking.status == "pending",
                Booking.created_at <= one_hour_ago
            )
            pending_bookings = session.exec(statement).all()
            
            logger.info(f"Found {len(pending_bookings)} bookings with pending payment")
            
            for booking in pending_bookings:
                try:
                    # Send payment reminder
                    message = (
                        f"Hi {booking.user.name}! You have a pending booking for {booking.trip.destination}. "
                        f"Please complete your payment to confirm your reservation."
                    )
                    
                    if booking.user.is_phone_verified and booking.user.phone:
                        from app.services.sms import sms_service
                        await sms_service.send_sms(
                            to_phone=booking.user.phone,
                            message=message
                        )
                    
                    if booking.user.is_email_verified and booking.user.email:
                        from app.services.email import email_service
                        # TODO: Create dedicated payment reminder email template
                        logger.info(f"Would send payment reminder email to {booking.user.email}")
                    
                    logger.info(f"Sent payment reminder to user {booking.user_id} for booking {booking.id}")
                
                except Exception as e:
                    logger.error(f"Failed to send payment reminder to user {booking.user_id}: {e}")
            
            logger.info("Payment reminder task completed")
    
    except Exception as e:
        logger.error(f"Payment reminder task failed: {e}")
        raise
