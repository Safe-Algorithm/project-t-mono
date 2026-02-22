"""
SendGrid Email Service

Provides email sending functionality using SendGrid API.
"""

from typing import Optional, List
import httpx
from app.core.config import settings


class SendGridEmailService:
    """Service for sending emails via SendGrid."""
    
    def __init__(self):
        self.api_key = settings.SENDGRID_API_KEY
        self.from_email = settings.SENDGRID_FROM_EMAIL
        self.from_name = settings.SENDGRID_FROM_NAME
        self.api_url = "https://api.sendgrid.com/v3/mail/send"
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        to_name: Optional[str] = None
    ) -> dict:
        """
        Send an email via SendGrid.
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML email content
            text_content: Plain text email content (optional)
            to_name: Recipient name (optional)
            
        Returns:
            dict with message ID and status
        """
        # Prepare email payload
        payload = {
            "personalizations": [
                {
                    "to": [
                        {
                            "email": to_email,
                            **({"name": to_name} if to_name else {})
                        }
                    ],
                    "subject": subject
                }
            ],
            "from": {
                "email": self.from_email,
                "name": self.from_name
            },
            "content": [
                {
                    "type": "text/html",
                    "value": html_content
                }
            ]
        }
        
        # Add plain text version if provided
        if text_content:
            payload["content"].insert(0, {
                "type": "text/plain",
                "value": text_content
            })
        
        # Send email via SendGrid API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.api_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
        
        # SendGrid returns 202 Accepted with X-Message-Id header
        return {
            "message_id": response.headers.get("X-Message-Id"),
            "status_code": response.status_code
        }
    
    async def send_verification_email(
        self,
        to_email: str,
        to_name: str,
        verification_token: str,
        verification_url: str
    ) -> dict:
        """
        Send email verification email.
        
        Args:
            to_email: Recipient email address
            to_name: Recipient name
            verification_token: Verification token
            verification_url: Base verification URL
            
        Returns:
            dict with message ID and status
        """
        verify_link = f"{verification_url}?token={verification_token}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 30px; background-color: #f9fafb; }}
                .button {{ display: inline-block; padding: 12px 30px; background-color: #4F46E5; 
                          color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Verify Your Email</h1>
                </div>
                <div class="content">
                    <p>Hello {to_name},</p>
                    <p>Thank you for registering with Safe Algo Tourism! Please verify your email address by clicking the button below:</p>
                    <p style="text-align: center;">
                        <a href="{verify_link}" class="button">Verify Email Address</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #666;">{verify_link}</p>
                    <p>This link will expire in 24 hours.</p>
                    <p>If you didn't create an account, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2026 Safe Algo Tourism. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Hello {to_name},
        
        Thank you for registering with Safe Algo Tourism!
        
        Please verify your email address by clicking this link:
        {verify_link}
        
        This link will expire in 24 hours.
        
        If you didn't create an account, please ignore this email.
        
        © 2026 Safe Algo Tourism. All rights reserved.
        """
        
        return await self.send_email(
            to_email=to_email,
            subject="Verify Your Email - Safe Algo Tourism",
            html_content=html_content,
            text_content=text_content,
            to_name=to_name
        )
    
    async def send_password_reset_email(
        self,
        to_email: str,
        to_name: str,
        reset_token: str,
        reset_url: str
    ) -> dict:
        """
        Send password reset email.
        
        Args:
            to_email: Recipient email address
            to_name: Recipient name
            reset_token: Password reset token
            reset_url: Base reset URL
            
        Returns:
            dict with message ID and status
        """
        reset_link = f"{reset_url}?token={reset_token}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #EF4444; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 30px; background-color: #f9fafb; }}
                .button {{ display: inline-block; padding: 12px 30px; background-color: #EF4444; 
                          color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Reset Your Password</h1>
                </div>
                <div class="content">
                    <p>Hello {to_name},</p>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    <p style="text-align: center;">
                        <a href="{reset_link}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #666;">{reset_link}</p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request a password reset, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2026 Safe Algo Tourism. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Hello {to_name},
        
        We received a request to reset your password.
        
        Click this link to create a new password:
        {reset_link}
        
        This link will expire in 1 hour.
        
        If you didn't request a password reset, please ignore this email.
        
        © 2026 Safe Algo Tourism. All rights reserved.
        """
        
        return await self.send_email(
            to_email=to_email,
            subject="Reset Your Password - Safe Algo Tourism",
            html_content=html_content,
            text_content=text_content,
            to_name=to_name
        )
    
    async def send_booking_confirmation_email(
        self,
        to_email: str,
        to_name: str,
        trip_name: str,
        booking_reference: str,
        start_date: str,
        total_amount: str,
        language: str = "en",
    ) -> dict:
        """
        Send booking confirmation email in the user's preferred language (en or ar).
        """
        is_ar = language == "ar"

        if is_ar:
            subject = f"تم تأكيد الحجز - {trip_name}"
            html_content = f"""
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="utf-8"/>
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Arial, sans-serif; line-height: 1.8; color: #333; direction: rtl; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #10B981; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ padding: 30px; background-color: #f9fafb; }}
        .booking-details {{ background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }}
        .detail-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }}
        .detail-row:last-child {{ border-bottom: none; }}
        .footer {{ text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✓ تم تأكيد الحجز!</h1>
        </div>
        <div class="content">
            <p>مرحباً {to_name}،</p>
            <p>تم تأكيد حجزك بنجاح! يسعدنا انضمامك إلينا في هذه الرحلة.</p>
            <div class="booking-details">
                <h2>تفاصيل الحجز</h2>
                <div class="detail-row">
                    <strong>الرحلة:</strong>
                    <span>{trip_name}</span>
                </div>
                <div class="detail-row">
                    <strong>رقم الحجز:</strong>
                    <span style="font-family: monospace;">{booking_reference}</span>
                </div>
                <div class="detail-row">
                    <strong>تاريخ البدء:</strong>
                    <span>{start_date}</span>
                </div>
                <div class="detail-row">
                    <strong>المبلغ الإجمالي:</strong>
                    <span>{total_amount}</span>
                </div>
            </div>
            <p>ستتلقى تفاصيل إضافية عن رحلتك قريباً من تاريخ المغادرة.</p>
            <p>رحلة سعيدة! 🌟</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 رحلة. جميع الحقوق محفوظة.</p>
        </div>
    </div>
</body>
</html>"""
            text_content = f"""مرحباً {to_name}،

تم تأكيد حجزك بنجاح!

تفاصيل الحجز:
الرحلة: {trip_name}
رقم الحجز: {booking_reference}
تاريخ البدء: {start_date}
المبلغ الإجمالي: {total_amount}

ستتلقى تفاصيل إضافية عن رحلتك قريباً.

رحلة سعيدة!
© 2026 رحلة. جميع الحقوق محفوظة."""
        else:
            subject = f"Booking Confirmed - {trip_name}"
            html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #10B981; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ padding: 30px; background-color: #f9fafb; }}
        .booking-details {{ background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }}
        .detail-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }}
        .detail-row:last-child {{ border-bottom: none; }}
        .footer {{ text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✓ Booking Confirmed!</h1>
        </div>
        <div class="content">
            <p>Hello {to_name},</p>
            <p>Your booking has been confirmed! We're excited to have you join us.</p>
            <div class="booking-details">
                <h2>Booking Details</h2>
                <div class="detail-row">
                    <strong>Trip:</strong>
                    <span>{trip_name}</span>
                </div>
                <div class="detail-row">
                    <strong>Reference:</strong>
                    <span style="font-family: monospace;">{booking_reference}</span>
                </div>
                <div class="detail-row">
                    <strong>Start Date:</strong>
                    <span>{start_date}</span>
                </div>
                <div class="detail-row">
                    <strong>Total Amount:</strong>
                    <span>{total_amount}</span>
                </div>
            </div>
            <p>You will receive additional details about your trip closer to the departure date.</p>
            <p>Safe travels! 🌟</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 Rihla. All rights reserved.</p>
        </div>
    </div>
</body>
</html>"""
            text_content = f"""Hello {to_name},

Your booking has been confirmed! We're excited to have you join us.

BOOKING DETAILS
---------------
Trip: {trip_name}
Reference: {booking_reference}
Start Date: {start_date}
Total Amount: {total_amount}

You will receive additional details about your trip closer to the departure date.

Safe travels!
© 2026 Rihla. All rights reserved."""

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            to_name=to_name
        )
    
    async def send_team_invitation_email(
        self,
        to_email: str,
        to_name: str,
        inviter_name: str,
        company_name: str,
        invitation_token: str,
        invitation_url: str
    ) -> dict:
        """
        Send team invitation email.
        
        Args:
            to_email: Recipient email address
            to_name: Recipient name
            inviter_name: Name of person sending invitation
            company_name: Company/provider name
            invitation_token: Invitation acceptance token (for reference, not used in URL)
            invitation_url: Full invitation URL with token already included
            
        Returns:
            dict with message ID and status
        """
        # invitation_url already contains the token, no need to append it
        accept_link = invitation_url
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #7C3AED; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 30px; background-color: #f9fafb; }}
                .button {{ display: inline-block; padding: 12px 30px; background-color: #7C3AED; 
                          color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Team Invitation</h1>
                </div>
                <div class="content">
                    <p>Hello {to_name},</p>
                    <p><strong>{inviter_name}</strong> has invited you to join the team at <strong>{company_name}</strong> on Safe Algo Tourism!</p>
                    <p>Click the button below to accept the invitation and set up your account:</p>
                    <p style="text-align: center;">
                        <a href="{accept_link}" class="button">Accept Invitation</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #666;">{accept_link}</p>
                    <p>This invitation will expire in 7 days.</p>
                    <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2026 Safe Algo Tourism. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Hello {to_name},
        
        {inviter_name} has invited you to join the team at {company_name} on Safe Algo Tourism!
        
        Click this link to accept the invitation and set up your account:
        {accept_link}
        
        This invitation will expire in 7 days.
        
        If you weren't expecting this invitation, you can safely ignore this email.
        
        © 2026 Safe Algo Tourism. All rights reserved.
        """
        
        return await self.send_email(
            to_email=to_email,
            subject=f"Team Invitation from {company_name}",
            html_content=html_content,
            text_content=text_content,
            to_name=to_name
        )
    
    async def send_otp_email(
        self,
        to_email: str,
        otp_code: str,
        to_name: Optional[str] = None
    ) -> dict:
        """
        Send OTP verification code via email.
        
        Args:
            to_email: Recipient email address
            otp_code: 6-digit OTP code
            to_name: Recipient name (optional)
            
        Returns:
            dict with message ID and status
        """
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #4CAF50; color: white; padding: 20px; text-align: center; }}
                .content {{ background-color: #f9f9f9; padding: 30px; border-radius: 5px; margin-top: 20px; }}
                .otp-code {{ font-size: 32px; font-weight: bold; text-align: center; letter-spacing: 8px; color: #4CAF50; padding: 20px; background-color: #fff; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Safe Algo Tourism</h1>
                </div>
                <div class="content">
                    <h2>Email Verification</h2>
                    <p>{"Hello " + to_name + "," if to_name else "Hello,"}</p>
                    <p>Your verification code is:</p>
                    <div class="otp-code">{otp_code}</div>
                    <p>This code will expire in <strong>5 minutes</strong>.</p>
                    <p>If you didn't request this code, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2026 Safe Algo Tourism. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Safe Algo Tourism - Email Verification
        
        {"Hello " + to_name + "," if to_name else "Hello,"}
        
        Your verification code is: {otp_code}
        
        This code will expire in 5 minutes.
        
        If you didn't request this code, please ignore this email.
        
        © 2026 Safe Algo Tourism. All rights reserved.
        """
        
        return await self.send_email(
            to_email=to_email,
            subject="Your Verification Code",
            html_content=html_content,
            text_content=text_content,
            to_name=to_name
        )


# Singleton instance
email_service = SendGridEmailService()
