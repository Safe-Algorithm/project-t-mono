"""
Twilio SMS Service

Provides bilingual (English / Arabic) SMS sending via Twilio API.
All public methods accept an optional `language` parameter ("en" | "ar").
"""

from typing import Optional
import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def _is_ar(language: str) -> bool:
    return (language or "en").lower().startswith("ar")


class TwilioSMSService:
    """Service for sending SMS messages via Twilio."""

    def __init__(self):
        self.account_sid = settings.TWILIO_ACCOUNT_SID
        self.auth_token = settings.TWILIO_AUTH_TOKEN
        self.phone_number = settings.TWILIO_PHONE_NUMBER
        self.messaging_service_sid = settings.TWILIO_MESSAGING_SERVICE_SID
        self.api_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"

    async def send_sms(
        self,
        to_phone: str,
        message: str,
        use_messaging_service: bool = True,
    ) -> dict:
        """Send a raw SMS message (E.164 phone, max 1600 chars)."""
        if not to_phone.startswith('+'):
            raise ValueError("Phone number must be in E.164 format (e.g., +966501234567)")

        if len(message) > 1600:
            raise ValueError("Message exceeds maximum length of 1600 characters")

        data = {"To": to_phone, "Body": message}

        if use_messaging_service and self.messaging_service_sid:
            data["MessagingServiceSid"] = self.messaging_service_sid
        else:
            data["From"] = self.phone_number

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.api_url,
                auth=(self.account_sid, self.auth_token),
                data=data,
                timeout=30.0,
            )
            response.raise_for_status()

        result = response.json()
        return {
            "message_sid": result.get("sid"),
            "status": result.get("status"),
            "to": result.get("to"),
            "from": result.get("from"),
            "date_created": result.get("date_created"),
            "error_code": result.get("error_code"),
            "error_message": result.get("error_message"),
        }

    async def send_otp(
        self,
        to_phone: str,
        otp_code: str,
        language: str = "en",
    ) -> dict:
        """Send an OTP verification code via SMS in the user's preferred language."""
        if _is_ar(language):
            message = (
                f"رمز التحقق الخاص بك في رحلة هو: {otp_code}\n\n"
                f"ينتهي صلاحية هذا الرمز خلال 5 دقائق."
            )
        else:
            message = (
                f"Your Rihla verification code is: {otp_code}\n\n"
                f"This code will expire in 5 minutes."
            )
        return await self.send_sms(to_phone, message)

    async def send_trip_reminder(
        self,
        to_phone: str,
        trip_name: str,
        start_date: str,
        language: str = "en",
    ) -> dict:
        """Send a trip reminder SMS in the user's preferred language."""
        if _is_ar(language):
            message = (
                f"تذكير: رحلتك '{trip_name}' ستبدأ في {start_date}.\n\n"
                f"رحلة سعيدة مع رحلة!"
            )
        else:
            message = (
                f"Reminder: Your trip '{trip_name}' starts on {start_date}.\n\n"
                f"Safe travels with Rihla!"
            )
        return await self.send_sms(to_phone, message)

    async def send_booking_confirmation(
        self,
        to_phone: str,
        trip_name: str,
        booking_reference: str,
        language: str = "en",
    ) -> dict:
        """Send a booking confirmation SMS in the user's preferred language."""
        if _is_ar(language):
            message = (
                f"تم تأكيد الحجز! الرحلة: {trip_name}\n"
                f"رقم الحجز: {booking_reference}\n\n"
                f"شكراً لاختيارك رحلة!"
            )
        else:
            message = (
                f"Booking confirmed! Trip: {trip_name}\n"
                f"Reference: {booking_reference}\n\n"
                f"Thank you for choosing Rihla!"
            )
        return await self.send_sms(to_phone, message)

    async def send_payment_confirmation(
        self,
        to_phone: str,
        trip_name: str,
        amount: str,
        payment_reference: str,
        language: str = "en",
    ) -> dict:
        """Send a payment confirmation SMS in the user's preferred language."""
        if _is_ar(language):
            message = (
                f"تم استلام دفعتك بنجاح!\n"
                f"الرحلة: {trip_name}\n"
                f"المبلغ: {amount}\n"
                f"رقم المرجع: {payment_reference}\n\n"
                f"شكراً لثقتك برحلة!"
            )
        else:
            message = (
                f"Payment received!\n"
                f"Trip: {trip_name}\n"
                f"Amount: {amount}\n"
                f"Reference: {payment_reference}\n\n"
                f"Thank you for choosing Rihla!"
            )
        return await self.send_sms(to_phone, message)

    async def send_cancellation_confirmation(
        self,
        to_phone: str,
        trip_name: str,
        booking_reference: str,
        refund_amount: Optional[str] = None,
        language: str = "en",
    ) -> dict:
        """Send a cancellation confirmation SMS in the user's preferred language."""
        if _is_ar(language):
            message = (
                f"تم إلغاء حجزك في رحلة '{trip_name}'.\n"
                f"رقم الحجز: {booking_reference}"
            )
            if refund_amount:
                message += f"\nمبلغ الاسترداد: {refund_amount}"
            message += "\n\nرحلة — نأمل أن نراك قريباً."
        else:
            message = (
                f"Your booking for '{trip_name}' has been cancelled.\n"
                f"Reference: {booking_reference}"
            )
            if refund_amount:
                message += f"\nRefund: {refund_amount}"
            message += "\n\nRihla — We hope to see you again soon."
        return await self.send_sms(to_phone, message)

    async def send_review_reminder(
        self,
        to_phone: str,
        trip_name: str,
        language: str = "en",
    ) -> dict:
        """Send a post-trip review reminder SMS in the user's preferred language."""
        if _is_ar(language):
            message = (
                f"كيف كانت رحلتك '{trip_name}'؟ 🌟\n\n"
                f"شاركنا تجربتك وساعد المسافرين الآخرين!\n"
                f"رحلة"
            )
        else:
            message = (
                f"How was your trip '{trip_name}'? 🌟\n\n"
                f"Share your experience and help other travelers!\n"
                f"Rihla"
            )
        return await self.send_sms(to_phone, message)

    async def get_message_status(self, message_sid: str) -> dict:
        """Get the status of a sent message."""
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages/{message_sid}.json"

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                auth=(self.account_sid, self.auth_token),
                timeout=30.0,
            )
            response.raise_for_status()

        return response.json()


# Singleton instance
sms_service = TwilioSMSService()
