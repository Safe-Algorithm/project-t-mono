"""
Notification Service

Handles sending notifications via SMS, email, and FCM push based on user's verified
contact methods. Push notifications are localized using user.preferred_language.
"""

from typing import Optional
from sqlmodel import Session

from app.models.user import User
from app.services.email import email_service
from app.services.sms import sms_service
from app.services.fcm import fcm_service


def _get_push_tokens(user: User) -> list[str]:
    """Return all FCM tokens stored for this user."""
    try:
        return [pt.token for pt in (user.push_tokens or [])]
    except Exception:
        return []


class NotificationService:
    """
    Service for sending notifications to users via their verified contact methods.
    
    Routing Logic:
    - If only phone is verified: Send SMS only
    - If only email is verified: Send email only
    - If both are verified: Send both SMS and email
    - If neither is verified: Send to both (fallback for legacy users)
    """
    
    async def send_booking_confirmation(
        self,
        user: User,
        trip_name: str,
        booking_reference: str,
        trip_details: dict
    ) -> dict:
        """
        Send booking confirmation notification.
        
        Args:
            user: User object
            trip_name: Name of the trip
            booking_reference: Booking reference number
            trip_details: Dictionary with trip details (dates, price, etc.)
            
        Returns:
            dict with status of sent notifications
        """
        results = {
            "sms_sent": False,
            "email_sent": False,
            "methods_used": []
        }
        
        # Determine which methods to use
        send_sms = user.is_phone_verified or not user.is_email_verified
        send_email = user.is_email_verified or not user.is_phone_verified
        
        # Send SMS if phone is verified or email is not verified
        if send_sms and user.phone:
            try:
                await sms_service.send_booking_confirmation(
                    to_phone=user.phone,
                    trip_name=trip_name,
                    booking_reference=booking_reference,
                    language=getattr(user, "preferred_language", "en") or "en",
                )
                results["sms_sent"] = True
                results["methods_used"].append("sms")
            except Exception as e:
                print(f"Failed to send SMS: {e}")
        
        # Send email if email is verified or phone is not verified
        if send_email and user.email:
            try:
                await email_service.send_booking_confirmation_email(
                    to_email=user.email,
                    to_name=user.name,
                    trip_name=trip_name,
                    booking_reference=booking_reference,
                    start_date=trip_details.get("start_date", ""),
                    total_amount=trip_details.get("total_amount", ""),
                    language=getattr(user, "preferred_language", "en") or "en",
                )
                results["email_sent"] = True
                results["methods_used"].append("email")
            except Exception as e:
                print(f"Failed to send email: {e}")

        lang = getattr(user, "preferred_language", "en") or "en"
        registration_id = str(trip_details.get("registration_id", "")) or None
        for token in _get_push_tokens(user):
            try:
                await fcm_service.notify_booking_confirmed(
                    fcm_token=token,
                    trip_name=trip_name,
                    reference=booking_reference,
                    lang=lang,
                    registration_id=registration_id,
                )
                if "push" not in results["methods_used"]:
                    results["methods_used"].append("push")
            except Exception as e:
                print(f"Failed to send push: {e}")

        return results
    
    async def send_trip_reminder(
        self,
        user: User,
        trip_name: str,
        start_date: str,
        trip_details: dict
    ) -> dict:
        """
        Send trip reminder notification (1 day before trip).
        
        Args:
            user: User object
            trip_name: Name of the trip
            start_date: Trip start date (formatted string)
            trip_details: Dictionary with trip details
            
        Returns:
            dict with status of sent notifications
        """
        results = {
            "sms_sent": False,
            "email_sent": False,
            "methods_used": []
        }
        
        # Determine which methods to use
        send_sms = user.is_phone_verified or not user.is_email_verified
        send_email = user.is_email_verified or not user.is_phone_verified
        
        # Send SMS if phone is verified or email is not verified
        if send_sms and user.phone:
            try:
                await sms_service.send_trip_reminder(
                    to_phone=user.phone,
                    trip_name=trip_name,
                    start_date=start_date,
                    language=getattr(user, "preferred_language", "en") or "en",
                )
                results["sms_sent"] = True
                results["methods_used"].append("sms")
            except Exception as e:
                print(f"Failed to send SMS: {e}")
        
        # Send email if email is verified or phone is not verified
        if send_email and user.email:
            try:
                await email_service.send_trip_reminder_email(
                    to_email=user.email,
                    to_name=user.name,
                    trip_name=trip_name,
                    start_date=start_date,
                    trip_details=trip_details,
                    language=getattr(user, "preferred_language", "en") or "en",
                )
                results["email_sent"] = True
                results["methods_used"].append("email")
            except Exception as e:
                print(f"Failed to send email: {e}")

        lang = getattr(user, "preferred_language", "en") or "en"
        trip_id = str(trip_details.get("trip_id", "")) or None
        for token in _get_push_tokens(user):
            try:
                await fcm_service.notify_trip_update(
                    fcm_token=token,
                    trip_name=trip_name,
                    message=start_date,
                    lang=lang,
                    trip_id=trip_id,
                )
                if "push" not in results["methods_used"]:
                    results["methods_used"].append("push")
            except Exception as e:
                print(f"Failed to send push: {e}")

        return results
    
    async def send_payment_confirmation(
        self,
        user: User,
        trip_name: str,
        amount: str,
        payment_reference: str
    ) -> dict:
        """
        Send payment confirmation notification.
        
        Args:
            user: User object
            trip_name: Name of the trip
            amount: Payment amount (formatted string)
            payment_reference: Payment reference number
            
        Returns:
            dict with status of sent notifications
        """
        results = {
            "sms_sent": False,
            "email_sent": False,
            "methods_used": []
        }
        
        # Determine which methods to use
        send_sms = user.is_phone_verified or not user.is_email_verified
        send_email = user.is_email_verified or not user.is_phone_verified
        
        # Send SMS
        if send_sms and user.phone:
            try:
                await sms_service.send_payment_confirmation(
                    to_phone=user.phone,
                    trip_name=trip_name,
                    amount=amount,
                    payment_reference=payment_reference,
                    language=getattr(user, "preferred_language", "en") or "en",
                )
                results["sms_sent"] = True
                results["methods_used"].append("sms")
            except Exception as e:
                print(f"Failed to send SMS: {e}")
        
        # Send email
        if send_email and user.email:
            try:
                await email_service.send_payment_confirmation_email(
                    to_email=user.email,
                    to_name=user.name,
                    trip_name=trip_name,
                    amount=amount,
                    payment_reference=payment_reference,
                    language=getattr(user, "preferred_language", "en") or "en",
                )
                results["email_sent"] = True
                results["methods_used"].append("email")
            except Exception as e:
                print(f"Failed to send email: {e}")

        lang = getattr(user, "preferred_language", "en") or "en"
        for token in _get_push_tokens(user):
            try:
                await fcm_service.notify_payment_confirmed(
                    fcm_token=token,
                    trip_name=trip_name,
                    amount=amount,
                    lang=lang,
                )
                if "push" not in results["methods_used"]:
                    results["methods_used"].append("push")
            except Exception as e:
                print(f"Failed to send push: {e}")

        return results
    
    async def send_cancellation_confirmation(
        self,
        user: User,
        trip_name: str,
        booking_reference: str,
        refund_amount: Optional[str] = None
    ) -> dict:
        """
        Send cancellation confirmation notification.
        
        Args:
            user: User object
            trip_name: Name of the trip
            booking_reference: Booking reference number
            refund_amount: Refund amount if applicable
            
        Returns:
            dict with status of sent notifications
        """
        results = {
            "sms_sent": False,
            "email_sent": False,
            "methods_used": []
        }
        
        # Determine which methods to use
        send_sms = user.is_phone_verified or not user.is_email_verified
        send_email = user.is_email_verified or not user.is_phone_verified
        
        # Send SMS
        if send_sms and user.phone:
            try:
                await sms_service.send_cancellation_confirmation(
                    to_phone=user.phone,
                    trip_name=trip_name,
                    booking_reference=booking_reference,
                    refund_amount=refund_amount,
                    language=getattr(user, "preferred_language", "en") or "en",
                )
                results["sms_sent"] = True
                results["methods_used"].append("sms")
            except Exception as e:
                print(f"Failed to send SMS: {e}")
        
        # Send email
        if send_email and user.email:
            try:
                await email_service.send_cancellation_confirmation_email(
                    to_email=user.email,
                    to_name=user.name,
                    trip_name=trip_name,
                    booking_reference=booking_reference,
                    refund_amount=refund_amount,
                    language=getattr(user, "preferred_language", "en") or "en",
                )
                results["email_sent"] = True
                results["methods_used"].append("email")
            except Exception as e:
                print(f"Failed to send email: {e}")

        lang = getattr(user, "preferred_language", "en") or "en"
        for token in _get_push_tokens(user):
            try:
                await fcm_service.notify_booking_cancelled(
                    fcm_token=token,
                    trip_name=trip_name,
                    lang=lang,
                )
                if "push" not in results["methods_used"]:
                    results["methods_used"].append("push")
            except Exception as e:
                print(f"Failed to send push: {e}")

        return results


# Singleton instance
notification_service = NotificationService()
