"""
Notification Service

Handles sending notifications via SMS and/or email based on user's verified contact methods.
Routes notifications intelligently based on what the user has verified.
"""

from typing import Optional
from sqlmodel import Session

from app.models.user import User
from app.services.email import email_service
from app.services.sms import sms_service


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
                    booking_reference=booking_reference
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
                    trip_details=trip_details
                )
                results["email_sent"] = True
                results["methods_used"].append("email")
            except Exception as e:
                print(f"Failed to send email: {e}")
        
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
                    start_date=start_date
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
                    trip_details=trip_details
                )
                results["email_sent"] = True
                results["methods_used"].append("email")
            except Exception as e:
                print(f"Failed to send email: {e}")
        
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
                message = (
                    f"Payment confirmed! Amount: {amount}\n"
                    f"Trip: {trip_name}\n"
                    f"Reference: {payment_reference}\n\n"
                    f"Thank you for choosing Safe Algo!"
                )
                await sms_service.send_sms(user.phone, message)
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
                    payment_reference=payment_reference
                )
                results["email_sent"] = True
                results["methods_used"].append("email")
            except Exception as e:
                print(f"Failed to send email: {e}")
        
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
                message = f"Booking cancelled: {trip_name}\nReference: {booking_reference}"
                if refund_amount:
                    message += f"\nRefund: {refund_amount}"
                message += "\n\nSafe Algo Tourism"
                await sms_service.send_sms(user.phone, message)
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
                    refund_amount=refund_amount
                )
                results["email_sent"] = True
                results["methods_used"].append("email")
            except Exception as e:
                print(f"Failed to send email: {e}")
        
        return results


# Singleton instance
notification_service = NotificationService()
