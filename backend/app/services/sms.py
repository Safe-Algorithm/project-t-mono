"""
Twilio SMS Service

Provides SMS sending functionality using Twilio API.
"""

from typing import Optional
import httpx
from app.core.config import settings


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
        use_messaging_service: bool = True
    ) -> dict:
        """
        Send an SMS message.
        
        Args:
            to_phone: Recipient phone number (E.164 format, e.g., +966501234567)
            message: Message content (max 1600 characters)
            use_messaging_service: Use messaging service SID instead of from number
            
        Returns:
            dict with message SID and status
        """
        if not to_phone.startswith('+'):
            raise ValueError("Phone number must be in E.164 format (e.g., +966501234567)")
        
        if len(message) > 1600:
            raise ValueError("Message exceeds maximum length of 1600 characters")
        
        # Prepare request data
        data = {
            "To": to_phone,
            "Body": message
        }
        
        # Use messaging service or direct phone number
        if use_messaging_service and self.messaging_service_sid:
            data["MessagingServiceSid"] = self.messaging_service_sid
        else:
            data["From"] = self.phone_number
        
        # Send SMS via Twilio API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.api_url,
                auth=(self.account_sid, self.auth_token),
                data=data,
                timeout=30.0
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
            "error_message": result.get("error_message")
        }
    
    async def send_otp(self, to_phone: str, otp_code: str) -> dict:
        """
        Send an OTP verification code via SMS.
        
        Args:
            to_phone: Recipient phone number (E.164 format)
            otp_code: OTP code (usually 6 digits)
            
        Returns:
            dict with message SID and status
        """
        message = f"Your Safe Algo verification code is: {otp_code}\n\nThis code will expire in 5 minutes."
        return await self.send_sms(to_phone, message)
    
    async def send_trip_reminder(
        self,
        to_phone: str,
        trip_name: str,
        start_date: str
    ) -> dict:
        """
        Send a trip reminder SMS.
        
        Args:
            to_phone: Recipient phone number
            trip_name: Name of the trip
            start_date: Trip start date
            
        Returns:
            dict with message SID and status
        """
        message = (
            f"Reminder: Your trip '{trip_name}' starts on {start_date}.\n\n"
            f"Safe travels with Safe Algo!"
        )
        return await self.send_sms(to_phone, message)
    
    async def send_booking_confirmation(
        self,
        to_phone: str,
        trip_name: str,
        booking_reference: str
    ) -> dict:
        """
        Send a booking confirmation SMS.
        
        Args:
            to_phone: Recipient phone number
            trip_name: Name of the trip
            booking_reference: Booking reference number
            
        Returns:
            dict with message SID and status
        """
        message = (
            f"Booking confirmed! Trip: {trip_name}\n"
            f"Reference: {booking_reference}\n\n"
            f"Thank you for choosing Safe Algo!"
        )
        return await self.send_sms(to_phone, message)
    
    async def get_message_status(self, message_sid: str) -> dict:
        """
        Get the status of a sent message.
        
        Args:
            message_sid: Twilio message SID
            
        Returns:
            dict with message status information
        """
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages/{message_sid}.json"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                auth=(self.account_sid, self.auth_token),
                timeout=30.0
            )
            response.raise_for_status()
        
        return response.json()


# Singleton instance
sms_service = TwilioSMSService()
