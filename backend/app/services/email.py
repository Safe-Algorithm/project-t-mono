"""
SendGrid Email Service

Provides bilingual (English / Arabic) email sending via SendGrid API.
All public methods accept an optional `language` parameter ("en" | "ar").
"""

from typing import Optional
import httpx
from app.core.config import settings


def _is_ar(language: str) -> bool:
    return (language or "en").lower().startswith("ar")


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
        verification_url: str,
        language: str = "en",
    ) -> dict:
        """Send email verification email in the user's preferred language (en or ar)."""
        verify_link = f"{verification_url}?token={verification_token}"
        ar = _is_ar(language)

        if ar:
            subject = "تحقق من بريدك الإلكتروني - رحلة"
            html_content = f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Tahoma,Arial,sans-serif;line-height:1.8;color:#333;direction:rtl;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#4F46E5;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .button{{display:inline-block;padding:12px 30px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:8px;margin:20px 0;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>تحقق من بريدك الإلكتروني</h1></div>
    <div class="content">
      <p>مرحباً {to_name}،</p>
      <p>شكراً لتسجيلك في رحلة! يرجى تأكيد عنوان بريدك الإلكتروني بالنقر على الزر أدناه:</p>
      <p style="text-align:center;"><a href="{verify_link}" class="button">تأكيد البريد الإلكتروني</a></p>
      <p>أو انسخ هذا الرابط في متصفحك:</p>
      <p style="word-break:break-all;color:#666;">{verify_link}</p>
      <p>ينتهي صلاحية هذا الرابط خلال 24 ساعة.</p>
      <p>إذا لم تقم بإنشاء حساب، يمكنك تجاهل هذا البريد.</p>
    </div>
    <div class="footer"><p>&copy; 2026 رحلة. جميع الحقوق محفوظة.</p></div>
  </div>
</body></html>"""
            text_content = f"""مرحباً {to_name}،

شكراً لتسجيلك في رحلة! يرجى تأكيد بريدك الإلكتروني عبر هذا الرابط:
{verify_link}

ينتهي صلاحية الرابط خلال 24 ساعة.
© 2026 رحلة. جميع الحقوق محفوظة."""
        else:
            subject = "Verify Your Email - Rihla"
            html_content = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#4F46E5;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .button{{display:inline-block;padding:12px 30px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:8px;margin:20px 0;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Verify Your Email</h1></div>
    <div class="content">
      <p>Hello {to_name},</p>
      <p>Thank you for registering with Rihla! Please verify your email address by clicking the button below:</p>
      <p style="text-align:center;"><a href="{verify_link}" class="button">Verify Email Address</a></p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break:break-all;color:#666;">{verify_link}</p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create an account, please ignore this email.</p>
    </div>
    <div class="footer"><p>&copy; 2026 Rihla. All rights reserved.</p></div>
  </div>
</body></html>"""
            text_content = f"""Hello {to_name},

Thank you for registering with Rihla! Please verify your email:
{verify_link}

This link expires in 24 hours.
© 2026 Rihla. All rights reserved."""

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            to_name=to_name,
        )
    
    async def send_password_reset_email(
        self,
        to_email: str,
        to_name: str,
        reset_token: str,
        reset_url: str,
        language: str = "en",
    ) -> dict:
        """Send password reset email in the user's preferred language (en or ar)."""
        reset_link = f"{reset_url}?token={reset_token}"
        ar = _is_ar(language)

        if ar:
            subject = "إعادة تعيين كلمة المرور - رحلة"
            html_content = f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Tahoma,Arial,sans-serif;line-height:1.8;color:#333;direction:rtl;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#EF4444;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .button{{display:inline-block;padding:12px 30px;background:#EF4444;color:#fff;text-decoration:none;border-radius:8px;margin:20px 0;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>إعادة تعيين كلمة المرور</h1></div>
    <div class="content">
      <p>مرحباً {to_name}،</p>
      <p>تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بك. انقر على الزر أدناه لإنشاء كلمة مرور جديدة:</p>
      <p style="text-align:center;"><a href="{reset_link}" class="button">إعادة تعيين كلمة المرور</a></p>
      <p>أو انسخ هذا الرابط في متصفحك:</p>
      <p style="word-break:break-all;color:#666;">{reset_link}</p>
      <p>ينتهي صلاحية هذا الرابط خلال ساعة واحدة.</p>
      <p>إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد.</p>
    </div>
    <div class="footer"><p>&copy; 2026 رحلة. جميع الحقوق محفوظة.</p></div>
  </div>
</body></html>"""
            text_content = f"""مرحباً {to_name}،

تلقينا طلباً لإعادة تعيين كلمة المرور.

انقر على هذا الرابط لإنشاء كلمة مرور جديدة:
{reset_link}

ينتهي صلاحية الرابط خلال ساعة واحدة.
© 2026 رحلة. جميع الحقوق محفوظة."""
        else:
            subject = "Reset Your Password - Rihla"
            html_content = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#EF4444;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .button{{display:inline-block;padding:12px 30px;background:#EF4444;color:#fff;text-decoration:none;border-radius:8px;margin:20px 0;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Reset Your Password</h1></div>
    <div class="content">
      <p>Hello {to_name},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <p style="text-align:center;"><a href="{reset_link}" class="button">Reset Password</a></p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break:break-all;color:#666;">{reset_link}</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request a password reset, please ignore this email.</p>
    </div>
    <div class="footer"><p>&copy; 2026 Rihla. All rights reserved.</p></div>
  </div>
</body></html>"""
            text_content = f"""Hello {to_name},

We received a request to reset your password.

Click this link to create a new password:
{reset_link}

This link expires in 1 hour.
© 2026 Rihla. All rights reserved."""

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            to_name=to_name,
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
        ar = _is_ar(language)

        if ar:
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
        invitation_url: str,
        language: str = "en",
    ) -> dict:
        """Send team invitation email in the recipient's preferred language (en or ar).
        invitation_url already contains the token — no need to append it."""
        accept_link = invitation_url
        ar = _is_ar(language)

        if ar:
            subject = f"دعوة للانضمام إلى فريق {company_name}"
            html_content = f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Tahoma,Arial,sans-serif;line-height:1.8;color:#333;direction:rtl;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#7C3AED;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .button{{display:inline-block;padding:12px 30px;background:#7C3AED;color:#fff;text-decoration:none;border-radius:8px;margin:20px 0;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>دعوة للانضمام إلى الفريق</h1></div>
    <div class="content">
      <p>مرحباً {to_name}،</p>
      <p>قام <strong>{inviter_name}</strong> بدعوتك للانضمام إلى فريق <strong>{company_name}</strong> على منصة رحلة!</p>
      <p>انقر على الزر أدناه لقبول الدعوة وإعداد حسابك:</p>
      <p style="text-align:center;"><a href="{accept_link}" class="button">قبول الدعوة</a></p>
      <p>أو انسخ هذا الرابط في متصفحك:</p>
      <p style="word-break:break-all;color:#666;">{accept_link}</p>
      <p>تنتهي صلاحية هذه الدعوة خلال 7 أيام.</p>
      <p>إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد.</p>
    </div>
    <div class="footer"><p>&copy; 2026 رحلة. جميع الحقوق محفوظة.</p></div>
  </div>
</body></html>"""
            text_content = f"""مرحباً {to_name}،

قام {inviter_name} بدعوتك للانضمام إلى فريق {company_name} على منصة رحلة!

انقر على هذا الرابط لقبول الدعوة:
{accept_link}

تنتهي صلاحية الدعوة خلال 7 أيام.
© 2026 رحلة. جميع الحقوق محفوظة."""
        else:
            subject = f"Team Invitation from {company_name}"
            html_content = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#7C3AED;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .button{{display:inline-block;padding:12px 30px;background:#7C3AED;color:#fff;text-decoration:none;border-radius:8px;margin:20px 0;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Team Invitation</h1></div>
    <div class="content">
      <p>Hello {to_name},</p>
      <p><strong>{inviter_name}</strong> has invited you to join the team at <strong>{company_name}</strong> on Rihla!</p>
      <p>Click the button below to accept the invitation and set up your account:</p>
      <p style="text-align:center;"><a href="{accept_link}" class="button">Accept Invitation</a></p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break:break-all;color:#666;">{accept_link}</p>
      <p>This invitation will expire in 7 days.</p>
      <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
    </div>
    <div class="footer"><p>&copy; 2026 Rihla. All rights reserved.</p></div>
  </div>
</body></html>"""
            text_content = f"""Hello {to_name},

{inviter_name} has invited you to join the team at {company_name} on Rihla!

Click this link to accept the invitation and set up your account:
{accept_link}

This invitation will expire in 7 days.
© 2026 Rihla. All rights reserved."""

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            to_name=to_name,
        )

    async def send_otp_email(
        self,
        to_email: str,
        otp_code: str,
        to_name: Optional[str] = None,
        language: str = "en",
    ) -> dict:
        """Send OTP verification code email in the user's preferred language (en or ar)."""
        ar = _is_ar(language)
        greeting = f"مرحباً {to_name}،" if to_name else "مرحباً،"
        greeting_en = f"Hello {to_name}," if to_name else "Hello,"

        if ar:
            subject = "رمز التحقق - رحلة"
            html_content = f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Tahoma,Arial,sans-serif;line-height:1.8;color:#333;direction:rtl;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#0EA5E9;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .otp{{font-size:28px;font-weight:bold;text-align:center;letter-spacing:6px;color:#0EA5E9;padding:16px 20px;background:#fff;border-radius:8px;margin:20px 0;border:2px dashed #0EA5E9;word-break:keep-all;white-space:nowrap;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>رمز التحقق</h1></div>
    <div class="content">
      <p>{greeting}</p>
      <p>رمز التحقق الخاص بك هو:</p>
      <div class="otp">{otp_code}</div>
      <p>ينتهي صلاحية هذا الرمز خلال <strong>5 دقائق</strong>.</p>
      <p>إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا البريد.</p>
    </div>
    <div class="footer"><p>&copy; 2026 رحلة. جميع الحقوق محفوظة.</p></div>
  </div>
</body></html>"""
            text_content = f"""{greeting}

رمز التحقق الخاص بك هو: {otp_code}

ينتهي صلاحية هذا الرمز خلال 5 دقائق.
© 2026 رحلة. جميع الحقوق محفوظة."""
        else:
            subject = "Your Verification Code - Rihla"
            html_content = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#0EA5E9;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .otp{{font-size:28px;font-weight:bold;text-align:center;letter-spacing:6px;color:#0EA5E9;padding:16px 20px;background:#fff;border-radius:8px;margin:20px 0;border:2px dashed #0EA5E9;word-break:keep-all;white-space:nowrap;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Verification Code</h1></div>
    <div class="content">
      <p>{greeting_en}</p>
      <p>Your verification code is:</p>
      <div class="otp">{otp_code}</div>
      <p>This code will expire in <strong>5 minutes</strong>.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    </div>
    <div class="footer"><p>&copy; 2026 Rihla. All rights reserved.</p></div>
  </div>
</body></html>"""
            text_content = f"""{greeting_en}

Your verification code is: {otp_code}

This code expires in 5 minutes.
© 2026 Rihla. All rights reserved."""

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            to_name=to_name,
        )

    async def send_trip_reminder_email(
        self,
        to_email: str,
        to_name: str,
        trip_name: str,
        start_date: str,
        trip_details: Optional[dict] = None,
        language: str = "en",
    ) -> dict:
        """Send trip reminder email (1 day before trip) in the user's preferred language."""
        ar = _is_ar(language)
        details = trip_details or {}
        duration = details.get("duration", "")
        duration_line_ar = f"<div class='detail-row'><strong>المدة:</strong><span>{duration}</span></div>" if duration else ""
        duration_line_en = f"<div class='detail-row'><strong>Duration:</strong><span>{duration}</span></div>" if duration else ""

        if ar:
            subject = f"تذكير برحلتك غداً - {trip_name}"
            html_content = f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Tahoma,Arial,sans-serif;line-height:1.8;color:#333;direction:rtl;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#F97316;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .details{{background:#fff;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #e5e7eb;}}
  .detail-row{{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;}}
  .detail-row:last-child{{border-bottom:none;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🗺️ رحلتك غداً!</h1></div>
    <div class="content">
      <p>مرحباً {to_name}،</p>
      <p>تذكير بأن رحلتك <strong>{trip_name}</strong> ستبدأ غداً. نتمنى لك رحلة رائعة!</p>
      <div class="details">
        <h2>تفاصيل الرحلة</h2>
        <div class="detail-row"><strong>الرحلة:</strong><span>{trip_name}</span></div>
        <div class="detail-row"><strong>تاريخ البدء:</strong><span>{start_date}</span></div>
        {duration_line_ar}
      </div>
      <p>تأكد من تجهيز أمتعتك والوصول في الوقت المحدد.</p>
      <p>رحلة سعيدة! 🌟</p>
    </div>
    <div class="footer"><p>&copy; 2026 رحلة. جميع الحقوق محفوظة.</p></div>
  </div>
</body></html>"""
            text_content = f"""مرحباً {to_name}،

رحلتك {trip_name} ستبدأ غداً — {start_date}.

تأكد من تجهيز أمتعتك والوصول في الوقت المحدد.
رحلة سعيدة!
© 2026 رحلة. جميع الحقوق محفوظة."""
        else:
            subject = f"Your Trip Is Tomorrow - {trip_name}"
            html_content = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#F97316;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .details{{background:#fff;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #e5e7eb;}}
  .detail-row{{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;}}
  .detail-row:last-child{{border-bottom:none;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🗺️ Your Trip Is Tomorrow!</h1></div>
    <div class="content">
      <p>Hello {to_name},</p>
      <p>Just a reminder that your trip <strong>{trip_name}</strong> starts tomorrow. We hope you have an amazing experience!</p>
      <div class="details">
        <h2>Trip Details</h2>
        <div class="detail-row"><strong>Trip:</strong><span>{trip_name}</span></div>
        <div class="detail-row"><strong>Start Date:</strong><span>{start_date}</span></div>
        {duration_line_en}
      </div>
      <p>Make sure your bags are packed and you arrive on time.</p>
      <p>Safe travels! 🌟</p>
    </div>
    <div class="footer"><p>&copy; 2026 Rihla. All rights reserved.</p></div>
  </div>
</body></html>"""
            text_content = f"""Hello {to_name},

Your trip {trip_name} starts tomorrow — {start_date}.

Make sure your bags are packed and arrive on time.
Safe travels!
© 2026 Rihla. All rights reserved."""

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            to_name=to_name,
        )

    async def send_cancellation_confirmation_email(
        self,
        to_email: str,
        to_name: str,
        trip_name: str,
        booking_reference: str,
        refund_amount: Optional[str] = None,
        language: str = "en",
    ) -> dict:
        """Send booking cancellation confirmation email in the user's preferred language."""
        ar = _is_ar(language)
        refund_ar = f"<div class='detail-row'><strong>مبلغ الاسترداد:</strong><span>{refund_amount}</span></div>" if refund_amount else "<p>يرجى مراجعة سياسة الاسترداد للحصول على مزيد من التفاصيل.</p>"
        refund_en = f"<div class='detail-row'><strong>Refund Amount:</strong><span>{refund_amount}</span></div>" if refund_amount else "<p>Please refer to our refund policy for further details.</p>"

        if ar:
            subject = f"تم إلغاء الحجز - {trip_name}"
            html_content = f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Tahoma,Arial,sans-serif;line-height:1.8;color:#333;direction:rtl;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#6B7280;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .details{{background:#fff;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #e5e7eb;}}
  .detail-row{{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;}}
  .detail-row:last-child{{border-bottom:none;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>تم إلغاء الحجز</h1></div>
    <div class="content">
      <p>مرحباً {to_name}،</p>
      <p>نأسف لإعلامك بأنه تم إلغاء حجزك في رحلة <strong>{trip_name}</strong>.</p>
      <div class="details">
        <h2>تفاصيل الإلغاء</h2>
        <div class="detail-row"><strong>الرحلة:</strong><span>{trip_name}</span></div>
        <div class="detail-row"><strong>رقم الحجز:</strong><span style="font-family:monospace;">{booking_reference}</span></div>
        {refund_ar}
      </div>
      <p>إذا كان لديك أي استفسارات، لا تتردد في التواصل مع فريق الدعم.</p>
    </div>
    <div class="footer"><p>&copy; 2026 رحلة. جميع الحقوق محفوظة.</p></div>
  </div>
</body></html>"""
            text_content = f"""مرحباً {to_name}،

تم إلغاء حجزك في رحلة {trip_name}.
رقم الحجز: {booking_reference}
{"مبلغ الاسترداد: " + refund_amount if refund_amount else "يرجى مراجعة سياسة الاسترداد."}

© 2026 رحلة. جميع الحقوق محفوظة."""
        else:
            subject = f"Booking Cancelled - {trip_name}"
            html_content = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#6B7280;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .details{{background:#fff;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #e5e7eb;}}
  .detail-row{{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;}}
  .detail-row:last-child{{border-bottom:none;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Booking Cancelled</h1></div>
    <div class="content">
      <p>Hello {to_name},</p>
      <p>We're sorry to inform you that your booking for <strong>{trip_name}</strong> has been cancelled.</p>
      <div class="details">
        <h2>Cancellation Details</h2>
        <div class="detail-row"><strong>Trip:</strong><span>{trip_name}</span></div>
        <div class="detail-row"><strong>Reference:</strong><span style="font-family:monospace;">{booking_reference}</span></div>
        {refund_en}
      </div>
      <p>If you have any questions, please don't hesitate to contact our support team.</p>
    </div>
    <div class="footer"><p>&copy; 2026 Rihla. All rights reserved.</p></div>
  </div>
</body></html>"""
            text_content = f"""Hello {to_name},

Your booking for {trip_name} has been cancelled.
Reference: {booking_reference}
{"Refund: " + refund_amount if refund_amount else "Please refer to our refund policy for details."}

© 2026 Rihla. All rights reserved."""

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            to_name=to_name,
        )

    async def send_payment_confirmation_email(
        self,
        to_email: str,
        to_name: str,
        trip_name: str,
        amount: str,
        payment_reference: str,
        language: str = "en",
    ) -> dict:
        """Send payment confirmation email in the user's preferred language."""
        ar = _is_ar(language)

        if ar:
            subject = f"تم استلام الدفعة - {trip_name}"
            html_content = f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Tahoma,Arial,sans-serif;line-height:1.8;color:#333;direction:rtl;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#10B981;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .details{{background:#fff;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #e5e7eb;}}
  .detail-row{{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;}}
  .detail-row:last-child{{border-bottom:none;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>✓ تم استلام الدفعة</h1></div>
    <div class="content">
      <p>مرحباً {to_name}،</p>
      <p>تم استلام دفعتك بنجاح لرحلة <strong>{trip_name}</strong>.</p>
      <div class="details">
        <h2>تفاصيل الدفعة</h2>
        <div class="detail-row"><strong>الرحلة:</strong><span>{trip_name}</span></div>
        <div class="detail-row"><strong>المبلغ:</strong><span>{amount}</span></div>
        <div class="detail-row"><strong>رقم المرجع:</strong><span style="font-family:monospace;">{payment_reference}</span></div>
      </div>
      <p>شكراً لثقتك بنا!</p>
    </div>
    <div class="footer"><p>&copy; 2026 رحلة. جميع الحقوق محفوظة.</p></div>
  </div>
</body></html>"""
            text_content = f"""مرحباً {to_name}،

تم استلام دفعتك بنجاح.
الرحلة: {trip_name}
المبلغ: {amount}
رقم المرجع: {payment_reference}

شكراً لثقتك بنا!
© 2026 رحلة. جميع الحقوق محفوظة."""
        else:
            subject = f"Payment Received - {trip_name}"
            html_content = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#10B981;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .details{{background:#fff;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #e5e7eb;}}
  .detail-row{{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;}}
  .detail-row:last-child{{border-bottom:none;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>✓ Payment Received</h1></div>
    <div class="content">
      <p>Hello {to_name},</p>
      <p>Your payment for <strong>{trip_name}</strong> has been successfully received.</p>
      <div class="details">
        <h2>Payment Details</h2>
        <div class="detail-row"><strong>Trip:</strong><span>{trip_name}</span></div>
        <div class="detail-row"><strong>Amount:</strong><span>{amount}</span></div>
        <div class="detail-row"><strong>Reference:</strong><span style="font-family:monospace;">{payment_reference}</span></div>
      </div>
      <p>Thank you for choosing Rihla!</p>
    </div>
    <div class="footer"><p>&copy; 2026 Rihla. All rights reserved.</p></div>
  </div>
</body></html>"""
            text_content = f"""Hello {to_name},

Your payment for {trip_name} has been successfully received.
Amount: {amount}
Reference: {payment_reference}

Thank you for choosing Rihla!
© 2026 Rihla. All rights reserved."""

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            to_name=to_name,
        )

    async def send_review_reminder_email(
        self,
        to_email: str,
        to_name: str,
        trip_name: str,
        language: str = "en",
    ) -> dict:
        """Send post-trip review reminder email in the user's preferred language."""
        ar = _is_ar(language)

        if ar:
            subject = f"شاركنا تجربتك في رحلة {trip_name}"
            html_content = f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Tahoma,Arial,sans-serif;line-height:1.8;color:#333;direction:rtl;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#F59E0B;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .stars{{font-size:32px;text-align:center;margin:16px 0;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>كيف كانت رحلتك؟</h1></div>
    <div class="content">
      <p>مرحباً {to_name}،</p>
      <p>نأمل أنك استمتعت برحلة <strong>{trip_name}</strong>! 🌟</p>
      <p>رأيك يهمنا ويساعد المسافرين الآخرين. خصص لحظة لمشاركة تقييمك.</p>
      <div class="stars">⭐⭐⭐⭐⭐</div>
      <p>شكراً على اختيارك رحلة!</p>
    </div>
    <div class="footer"><p>&copy; 2026 رحلة. جميع الحقوق محفوظة.</p></div>
  </div>
</body></html>"""
            text_content = f"""مرحباً {to_name}،

نأمل أنك استمتعت برحلة {trip_name}!

رأيك يهمنا — خصص لحظة لمشاركة تقييمك.

شكراً على اختيارك رحلة!
© 2026 رحلة. جميع الحقوق محفوظة."""
        else:
            subject = f"Share Your Experience - {trip_name}"
            html_content = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/>
<style>
  body{{font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#F59E0B;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{padding:30px;background:#f9fafb;}}
  .stars{{font-size:32px;text-align:center;margin:16px 0;}}
  .footer{{text-align:center;padding:20px;color:#9ca3af;font-size:12px;}}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>How Was Your Trip?</h1></div>
    <div class="content">
      <p>Hello {to_name},</p>
      <p>We hope you enjoyed <strong>{trip_name}</strong>! 🌟</p>
      <p>Your feedback helps other travelers. Please take a moment to leave a review.</p>
      <div class="stars">⭐⭐⭐⭐⭐</div>
      <p>Thank you for choosing Rihla!</p>
    </div>
    <div class="footer"><p>&copy; 2026 Rihla. All rights reserved.</p></div>
  </div>
</body></html>"""
            text_content = f"""Hello {to_name},

We hope you enjoyed {trip_name}!

Your feedback helps other travelers — please take a moment to leave a review.

Thank you for choosing Rihla!
© 2026 Rihla. All rights reserved."""

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            to_name=to_name,
        )


# Singleton instance
email_service = SendGridEmailService()
