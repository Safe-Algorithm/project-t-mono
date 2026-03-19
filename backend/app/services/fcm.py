"""
FCM Push Notification Service

Sends push notifications to mobile users via Firebase Cloud Messaging (HTTP v1 API).
Requires FIREBASE_SERVICE_ACCOUNT_JSON env var (path to service account JSON file)
or FIREBASE_SERVICE_ACCOUNT_JSON_CONTENT env var (the JSON content as a string).

Notification content is localized using user.preferred_language ("en" | "ar").
"""

import json
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Bilingual notification templates keyed by event type
_TEMPLATES: dict[str, dict[str, dict[str, str]]] = {
    "booking_confirmed": {
        "en": {
            "title": "Booking Confirmed ✅",
            "body": "Your booking for {trip_name} is confirmed. Reference: {reference}",
        },
        "ar": {
            "title": "تم تأكيد الحجز ✅",
            "body": "تم تأكيد حجزك لرحلة {trip_name}. رقم المرجع: {reference}",
        },
    },
    "payment_confirmed": {
        "en": {
            "title": "Payment Successful 💳",
            "body": "Your payment of {amount} SAR for {trip_name} has been received.",
        },
        "ar": {
            "title": "تمت عملية الدفع بنجاح 💳",
            "body": "تم استلام دفعتك بقيمة {amount} ريال لرحلة {trip_name}.",
        },
    },
    "booking_cancelled": {
        "en": {
            "title": "Booking Cancelled",
            "body": "Your booking for {trip_name} has been cancelled.",
        },
        "ar": {
            "title": "تم إلغاء الحجز",
            "body": "تم إلغاء حجزك لرحلة {trip_name}.",
        },
    },
    "trip_update": {
        "en": {
            "title": "Trip Update 📢",
            "body": "{trip_name}: {message}",
        },
        "ar": {
            "title": "تحديث رحلة 📢",
            "body": "{trip_name}: {message}",
        },
    },
}


def _get_access_token() -> Optional[str]:
    """
    Obtain a short-lived OAuth2 access token for the FCM v1 API using
    a service account. Returns None if credentials are not configured
    (so the app still starts up and tests pass without Firebase creds).
    """
    import os

    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request as GoogleAuthRequest
    except ImportError:
        logger.warning("google-auth not installed; FCM push notifications disabled.")
        return None

    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    sa_content = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON_CONTENT")

    if sa_content:
        info = json.loads(sa_content)
    elif sa_path:
        with open(sa_path) as f:
            info = json.load(f)
    else:
        logger.debug("No Firebase credentials configured; FCM disabled.")
        return None

    credentials = service_account.Credentials.from_service_account_info(
        info,
        scopes=["https://www.googleapis.com/auth/firebase.messaging"],
    )
    credentials.refresh(GoogleAuthRequest())
    return credentials.token


def _render(template: dict[str, str], **kwargs: str) -> dict[str, str]:
    return {
        "title": template["title"].format(**kwargs),
        "body": template["body"].format(**kwargs),
    }


class FCMService:
    """Thin wrapper around the FCM HTTP v1 API."""

    async def send_to_token(
        self,
        *,
        fcm_token: str,
        title: str,
        body: str,
        data: Optional[dict[str, str]] = None,
        project_id: Optional[str] = None,
    ) -> bool:
        """
        Send a push notification to a single FCM token.
        Returns True on success, False on failure (non-raising).
        """
        import os

        pid = project_id or os.getenv("FIREBASE_PROJECT_ID")
        if not pid:
            logger.debug("FIREBASE_PROJECT_ID not set; skipping FCM send.")
            return False

        access_token = _get_access_token()
        if not access_token:
            return False

        url = f"https://fcm.googleapis.com/v1/projects/{pid}/messages:send"
        payload: dict = {
            "message": {
                "token": fcm_token,
                "notification": {"title": title, "body": body},
            }
        }
        if data:
            payload["message"]["data"] = data

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    url,
                    json=payload,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
            if resp.status_code == 200:
                return True
            logger.warning("FCM send failed (%s): %s", resp.status_code, resp.text)
            return False
        except Exception as exc:
            logger.warning("FCM send exception: %s", exc)
            return False

    # ── Convenience methods (localized) ──────────────────────────────────────

    async def notify_booking_confirmed(
        self,
        fcm_token: str,
        trip_name: str,
        reference: str,
        lang: str = "en",
        registration_id: Optional[str] = None,
    ) -> bool:
        tmpl = _TEMPLATES["booking_confirmed"].get(lang, _TEMPLATES["booking_confirmed"]["en"])
        content = _render(tmpl, trip_name=trip_name, reference=reference)
        data = {"registrationId": registration_id} if registration_id else {}
        return await self.send_to_token(title=content["title"], body=content["body"], fcm_token=fcm_token, data=data)

    async def notify_payment_confirmed(
        self,
        fcm_token: str,
        trip_name: str,
        amount: str,
        lang: str = "en",
        registration_id: Optional[str] = None,
    ) -> bool:
        tmpl = _TEMPLATES["payment_confirmed"].get(lang, _TEMPLATES["payment_confirmed"]["en"])
        content = _render(tmpl, trip_name=trip_name, amount=amount)
        data = {"registrationId": registration_id} if registration_id else {}
        return await self.send_to_token(title=content["title"], body=content["body"], fcm_token=fcm_token, data=data)

    async def notify_booking_cancelled(
        self,
        fcm_token: str,
        trip_name: str,
        lang: str = "en",
        registration_id: Optional[str] = None,
    ) -> bool:
        tmpl = _TEMPLATES["booking_cancelled"].get(lang, _TEMPLATES["booking_cancelled"]["en"])
        content = _render(tmpl, trip_name=trip_name)
        data = {"registrationId": registration_id} if registration_id else {}
        return await self.send_to_token(title=content["title"], body=content["body"], fcm_token=fcm_token, data=data)

    async def notify_trip_update(
        self,
        fcm_token: str,
        trip_name: str,
        message: str,
        lang: str = "en",
        trip_id: Optional[str] = None,
        registration_id: Optional[str] = None,
    ) -> bool:
        tmpl = _TEMPLATES["trip_update"].get(lang, _TEMPLATES["trip_update"]["en"])
        content = _render(tmpl, trip_name=trip_name, message=message)
        data: dict[str, str] = {}
        if trip_id:
            data["tripId"] = trip_id
        if registration_id:
            data["registrationId"] = registration_id
        return await self.send_to_token(title=content["title"], body=content["body"], fcm_token=fcm_token, data=data)


fcm_service = FCMService()
