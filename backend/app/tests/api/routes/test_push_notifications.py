"""
Unit tests for push notification infrastructure:
  - POST /users/me/push-token  (upsert)
  - DELETE /users/me/push-token
  - FCMService template rendering and send logic
  - NotificationService push integration (mocked FCM)
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models.user import UserRole
from app.models.source import RequestSource
from app.models.user_push_token import UserPushToken
from app.tests.utils.user import user_authentication_headers


# ──────────────────────────────────────────────────────────────────────────────
# Push token endpoint tests
# ──────────────────────────────────────────────────────────────────────────────

def test_upsert_push_token_creates_new(client: TestClient, session: Session) -> None:
    """POST /users/me/push-token creates a token row for the user."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    resp = client.post(
        f"{settings.API_V1_STR}/users/me/push-token",
        headers=headers,
        json={"token": "ExponentPushToken[abc123]", "platform": "android"},
    )
    assert resp.status_code == 204

    rows = list(session.exec(
        select(UserPushToken).where(UserPushToken.user_id == user.id)
    ).all())
    assert len(rows) == 1
    assert rows[0].token == "ExponentPushToken[abc123]"
    assert rows[0].platform == "android"


def test_upsert_push_token_updates_existing(client: TestClient, session: Session) -> None:
    """Second POST with same platform overwrites the token, not creates a duplicate."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    client.post(
        f"{settings.API_V1_STR}/users/me/push-token",
        headers=headers,
        json={"token": "old-token", "platform": "android"},
    )
    resp = client.post(
        f"{settings.API_V1_STR}/users/me/push-token",
        headers=headers,
        json={"token": "new-token", "platform": "android"},
    )
    assert resp.status_code == 204

    rows = list(session.exec(
        select(UserPushToken).where(UserPushToken.user_id == user.id)
    ).all())
    assert len(rows) == 1
    assert rows[0].token == "new-token"


def test_upsert_push_token_separate_platforms(client: TestClient, session: Session) -> None:
    """Android and iOS tokens are stored as separate rows."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    client.post(
        f"{settings.API_V1_STR}/users/me/push-token",
        headers=headers,
        json={"token": "android-token", "platform": "android"},
    )
    client.post(
        f"{settings.API_V1_STR}/users/me/push-token",
        headers=headers,
        json={"token": "ios-token", "platform": "ios"},
    )

    rows = list(session.exec(
        select(UserPushToken).where(UserPushToken.user_id == user.id)
    ).all())
    assert len(rows) == 2
    platforms = {r.platform for r in rows}
    assert platforms == {"android", "ios"}


def test_upsert_push_token_missing_token_field(client: TestClient, session: Session) -> None:
    """Empty token string returns 400."""
    _, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    resp = client.post(
        f"{settings.API_V1_STR}/users/me/push-token",
        headers=headers,
        json={"token": "", "platform": "android"},
    )
    assert resp.status_code == 400


def test_upsert_push_token_requires_auth(client: TestClient, session: Session) -> None:
    """Unauthenticated request returns 401."""
    resp = client.post(
        f"{settings.API_V1_STR}/users/me/push-token",
        json={"token": "some-token", "platform": "android"},
    )
    assert resp.status_code == 401


def test_delete_push_token(client: TestClient, session: Session) -> None:
    """DELETE /users/me/push-token removes the stored token."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    client.post(
        f"{settings.API_V1_STR}/users/me/push-token",
        headers=headers,
        json={"token": "token-to-delete", "platform": "android"},
    )

    resp = client.delete(
        f"{settings.API_V1_STR}/users/me/push-token?platform=android",
        headers=headers,
    )
    assert resp.status_code == 204

    rows = list(session.exec(
        select(UserPushToken).where(UserPushToken.user_id == user.id)
    ).all())
    assert len(rows) == 0


def test_delete_push_token_nonexistent_is_idempotent(client: TestClient, session: Session) -> None:
    """DELETE on a user with no token still returns 204."""
    _, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    resp = client.delete(
        f"{settings.API_V1_STR}/users/me/push-token?platform=android",
        headers=headers,
    )
    assert resp.status_code == 204


# ──────────────────────────────────────────────────────────────────────────────
# FCMService unit tests (no real HTTP calls)
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fcm_send_returns_false_without_credentials() -> None:
    """send_to_token returns False gracefully when no Firebase creds are set."""
    from app.services.fcm import FCMService
    svc = FCMService()
    result = await svc.send_to_token(
        fcm_token="test-token",
        title="Hello",
        body="World",
        project_id="fake-project",
    )
    assert result is False


@pytest.mark.asyncio
async def test_fcm_notify_booking_confirmed_english() -> None:
    """notify_booking_confirmed uses English template when lang='en'."""
    from app.services.fcm import FCMService
    svc = FCMService()
    sent: list[dict] = []

    async def fake_send(*, fcm_token, title, body, data=None, project_id=None):
        sent.append({"title": title, "body": body})
        return True

    svc.send_to_token = fake_send  # type: ignore[method-assign]

    await svc.notify_booking_confirmed(
        fcm_token="tok",
        trip_name="Safari Adventure",
        reference="BK-001",
        lang="en",
    )
    assert len(sent) == 1
    assert "Confirmed" in sent[0]["title"] or "confirmed" in sent[0]["title"].lower()
    assert "Safari Adventure" in sent[0]["body"]
    assert "BK-001" in sent[0]["body"]


@pytest.mark.asyncio
async def test_fcm_notify_booking_confirmed_arabic() -> None:
    """notify_booking_confirmed uses Arabic template when lang='ar'."""
    from app.services.fcm import FCMService
    svc = FCMService()
    sent: list[dict] = []

    async def fake_send(*, fcm_token, title, body, data=None, project_id=None):
        sent.append({"title": title, "body": body})
        return True

    svc.send_to_token = fake_send  # type: ignore[method-assign]

    await svc.notify_booking_confirmed(
        fcm_token="tok",
        trip_name="رحلة السفاري",
        reference="BK-002",
        lang="ar",
    )
    assert len(sent) == 1
    assert "تأكيد" in sent[0]["title"] or "تم" in sent[0]["title"]
    assert "رحلة السفاري" in sent[0]["body"]


@pytest.mark.asyncio
async def test_fcm_notify_trip_update_carries_data() -> None:
    """notify_trip_update passes tripId, registrationId, and tripUpdateId as data payload."""
    from app.services.fcm import FCMService
    svc = FCMService()
    sent: list[dict] = []

    async def fake_send(*, fcm_token, title, body, data=None, project_id=None):
        sent.append({"title": title, "body": body, "data": data})
        return True

    svc.send_to_token = fake_send  # type: ignore[method-assign]

    await svc.notify_trip_update(
        fcm_token="tok",
        trip_name="Mountain Trek",
        message="Bus leaves at 6am",
        lang="en",
        trip_id="trip-uuid-123",
        registration_id="reg-uuid-456",
        trip_update_id="upd-uuid-789",
    )
    assert sent[0]["data"]["tripId"] == "trip-uuid-123"
    assert sent[0]["data"]["registrationId"] == "reg-uuid-456"
    assert sent[0]["data"]["tripUpdateId"] == "upd-uuid-789"


# ──────────────────────────────────────────────────────────────────────────────
# New FCM template tests (awaiting_provider, processing, confirmed, cancelled)
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fcm_notify_awaiting_provider_english() -> None:
    """notify_awaiting_provider: English body mentions trip name; data has registrationId."""
    from app.services.fcm import FCMService
    svc = FCMService()
    sent: list[dict] = []

    async def fake_send(*, fcm_token, title, body, data=None, project_id=None):
        sent.append({"title": title, "body": body, "data": data})
        return True

    svc.send_to_token = fake_send  # type: ignore[method-assign]

    await svc.notify_awaiting_provider(
        fcm_token="tok", trip_name="Desert Safari", lang="en", registration_id="reg-1"
    )
    assert len(sent) == 1
    assert "Desert Safari" in sent[0]["body"]
    assert sent[0]["data"]["registrationId"] == "reg-1"


@pytest.mark.asyncio
async def test_fcm_notify_awaiting_provider_arabic() -> None:
    """notify_awaiting_provider: Arabic template used when lang='ar'."""
    from app.services.fcm import FCMService
    svc = FCMService()
    sent: list[dict] = []

    async def fake_send(*, fcm_token, title, body, data=None, project_id=None):
        sent.append({"title": title, "body": body, "data": data})
        return True

    svc.send_to_token = fake_send  # type: ignore[method-assign]

    await svc.notify_awaiting_provider(
        fcm_token="tok", trip_name="رحلة الصحراء", lang="ar", registration_id="reg-ar"
    )
    assert "رحلة الصحراء" in sent[0]["body"]
    assert "الدفع" in sent[0]["title"] or "دفع" in sent[0]["body"]


@pytest.mark.asyncio
async def test_fcm_notify_registration_processing_english() -> None:
    """notify_registration_processing: English body mentions trip name; data has registrationId."""
    from app.services.fcm import FCMService
    svc = FCMService()
    sent: list[dict] = []

    async def fake_send(*, fcm_token, title, body, data=None, project_id=None):
        sent.append({"title": title, "body": body, "data": data})
        return True

    svc.send_to_token = fake_send  # type: ignore[method-assign]

    await svc.notify_registration_processing(
        fcm_token="tok", trip_name="Japan Tour", lang="en", registration_id="reg-2"
    )
    assert "Japan Tour" in sent[0]["body"]
    assert sent[0]["data"]["registrationId"] == "reg-2"


@pytest.mark.asyncio
async def test_fcm_notify_registration_processing_arabic() -> None:
    """notify_registration_processing: Arabic template used when lang='ar'."""
    from app.services.fcm import FCMService
    svc = FCMService()
    sent: list[dict] = []

    async def fake_send(*, fcm_token, title, body, data=None, project_id=None):
        sent.append({"title": title, "body": body, "data": data})
        return True

    svc.send_to_token = fake_send  # type: ignore[method-assign]

    await svc.notify_registration_processing(
        fcm_token="tok", trip_name="جولة اليابان", lang="ar", registration_id="reg-2-ar"
    )
    assert "جولة اليابان" in sent[0]["body"]
    assert "ترتيب" in sent[0]["title"] or "بدأ" in sent[0]["title"]


@pytest.mark.asyncio
async def test_fcm_notify_registration_confirmed_english() -> None:
    """notify_registration_confirmed: English body says arrangements complete."""
    from app.services.fcm import FCMService
    svc = FCMService()
    sent: list[dict] = []

    async def fake_send(*, fcm_token, title, body, data=None, project_id=None):
        sent.append({"title": title, "body": body, "data": data})
        return True

    svc.send_to_token = fake_send  # type: ignore[method-assign]

    await svc.notify_registration_confirmed(
        fcm_token="tok", trip_name="Europe Trip", lang="en", registration_id="reg-3"
    )
    assert "Europe Trip" in sent[0]["body"]
    assert "complete" in sent[0]["body"].lower() or "set" in sent[0]["body"].lower()
    assert sent[0]["data"]["registrationId"] == "reg-3"


@pytest.mark.asyncio
async def test_fcm_notify_registration_confirmed_arabic() -> None:
    """notify_registration_confirmed: Arabic template used when lang='ar'."""
    from app.services.fcm import FCMService
    svc = FCMService()
    sent: list[dict] = []

    async def fake_send(*, fcm_token, title, body, data=None, project_id=None):
        sent.append({"title": title, "body": body, "data": data})
        return True

    svc.send_to_token = fake_send  # type: ignore[method-assign]

    await svc.notify_registration_confirmed(
        fcm_token="tok", trip_name="رحلة أوروبا", lang="ar", registration_id="reg-3-ar"
    )
    assert "رحلة أوروبا" in sent[0]["body"]
    assert "اكتمل" in sent[0]["body"] or "تأكيد" in sent[0]["title"]


@pytest.mark.asyncio
async def test_fcm_notify_trip_cancelled_by_provider_english() -> None:
    """notify_trip_cancelled_by_provider: English body mentions trip name and refund."""
    from app.services.fcm import FCMService
    svc = FCMService()
    sent: list[dict] = []

    async def fake_send(*, fcm_token, title, body, data=None, project_id=None):
        sent.append({"title": title, "body": body, "data": data})
        return True

    svc.send_to_token = fake_send  # type: ignore[method-assign]

    await svc.notify_trip_cancelled_by_provider(
        fcm_token="tok", trip_name="Nile Cruise", lang="en", registration_id="reg-4"
    )
    assert "Nile Cruise" in sent[0]["body"]
    assert "refund" in sent[0]["body"].lower()
    assert sent[0]["data"]["registrationId"] == "reg-4"


@pytest.mark.asyncio
async def test_fcm_notify_trip_cancelled_by_provider_arabic() -> None:
    """notify_trip_cancelled_by_provider: Arabic template used when lang='ar'."""
    from app.services.fcm import FCMService
    svc = FCMService()
    sent: list[dict] = []

    async def fake_send(*, fcm_token, title, body, data=None, project_id=None):
        sent.append({"title": title, "body": body, "data": data})
        return True

    svc.send_to_token = fake_send  # type: ignore[method-assign]

    await svc.notify_trip_cancelled_by_provider(
        fcm_token="tok", trip_name="رحلة النيل", lang="ar", registration_id="reg-4-ar"
    )
    assert "رحلة النيل" in sent[0]["body"]
    assert "إلغاء" in sent[0]["title"] or "ألغ" in sent[0]["body"]


@pytest.mark.asyncio
async def test_fcm_notify_booking_cancelled_with_refund_english() -> None:
    """notify_booking_cancelled_with_refund: English body includes trip name and refund amount."""
    from app.services.fcm import FCMService
    svc = FCMService()
    sent: list[dict] = []

    async def fake_send(*, fcm_token, title, body, data=None, project_id=None):
        sent.append({"title": title, "body": body, "data": data})
        return True

    svc.send_to_token = fake_send  # type: ignore[method-assign]

    await svc.notify_booking_cancelled_with_refund(
        fcm_token="tok", trip_name="Beach Retreat", refund_amount="750", lang="en", registration_id="reg-5"
    )
    assert "Beach Retreat" in sent[0]["body"]
    assert "750" in sent[0]["body"]
    assert "SAR" in sent[0]["body"]
    assert sent[0]["data"]["registrationId"] == "reg-5"


@pytest.mark.asyncio
async def test_fcm_notify_booking_cancelled_with_refund_arabic() -> None:
    """notify_booking_cancelled_with_refund: Arabic body includes trip name and refund amount in SAR."""
    from app.services.fcm import FCMService
    svc = FCMService()
    sent: list[dict] = []

    async def fake_send(*, fcm_token, title, body, data=None, project_id=None):
        sent.append({"title": title, "body": body, "data": data})
        return True

    svc.send_to_token = fake_send  # type: ignore[method-assign]

    await svc.notify_booking_cancelled_with_refund(
        fcm_token="tok", trip_name="شاطئ المالديف", refund_amount="500", lang="ar", registration_id="reg-5-ar"
    )
    assert "شاطئ المالديف" in sent[0]["body"]
    assert "500" in sent[0]["body"]
    assert "ريال" in sent[0]["body"]


@pytest.mark.asyncio
async def test_fcm_notify_payment_confirmed_arabic() -> None:
    """notify_payment_confirmed uses Arabic template when lang='ar'."""
    from app.services.fcm import FCMService
    svc = FCMService()
    sent: list[dict] = []

    async def fake_send(*, fcm_token, title, body, data=None, project_id=None):
        sent.append({"title": title, "body": body})
        return True

    svc.send_to_token = fake_send  # type: ignore[method-assign]

    await svc.notify_payment_confirmed(
        fcm_token="tok",
        trip_name="رحلة الجبل",
        amount="500",
        lang="ar",
    )
    assert "ريال" in sent[0]["body"]
    assert "رحلة الجبل" in sent[0]["body"]


# ──────────────────────────────────────────────────────────────────────────────
# NotificationService push integration tests
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_notification_service_sends_push_on_booking_confirmed(
    client: TestClient, session: Session
) -> None:
    """send_booking_confirmation fires FCM push when user has a push token."""
    from app.services.notification import notification_service
    from app.models.user_push_token import UserPushToken

    user, _ = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    # Give the user a push token
    session.add(UserPushToken(user_id=user.id, token="push-tok-123", platform="android"))
    session.commit()
    session.refresh(user)

    with patch("app.services.fcm.fcm_service.notify_booking_confirmed", new_callable=AsyncMock) as mock_push, \
         patch("app.services.sms.sms_service.send_booking_confirmation", new_callable=AsyncMock), \
         patch("app.services.email.email_service.send_booking_confirmation_email", new_callable=AsyncMock):

        await notification_service.send_booking_confirmation(
            user=user,
            trip_name="Test Trip",
            booking_reference="BK-TEST",
            trip_details={"start_date": "2026-05-01", "total_amount": "1000"},
        )

        mock_push.assert_called_once()
        call_kwargs = mock_push.call_args.kwargs
        assert call_kwargs["fcm_token"] == "push-tok-123"
        assert call_kwargs["trip_name"] == "Test Trip"
        assert call_kwargs["reference"] == "BK-TEST"


@pytest.mark.asyncio
async def test_notification_service_push_uses_user_language(
    client: TestClient, session: Session
) -> None:
    """Push notification uses user.preferred_language."""
    from app.services.notification import notification_service
    from app.models.user_push_token import UserPushToken

    user, _ = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    user.preferred_language = "ar"
    session.add(user)
    session.add(UserPushToken(user_id=user.id, token="ar-push-tok", platform="android"))
    session.commit()
    session.refresh(user)

    with patch("app.services.fcm.fcm_service.notify_booking_confirmed", new_callable=AsyncMock) as mock_push, \
         patch("app.services.sms.sms_service.send_booking_confirmation", new_callable=AsyncMock), \
         patch("app.services.email.email_service.send_booking_confirmation_email", new_callable=AsyncMock):

        await notification_service.send_booking_confirmation(
            user=user,
            trip_name="رحلة",
            booking_reference="BK-AR",
            trip_details={},
        )

        call_kwargs = mock_push.call_args.kwargs
        assert call_kwargs["lang"] == "ar"


@pytest.mark.asyncio
async def test_notification_service_no_push_without_token(
    client: TestClient, session: Session
) -> None:
    """send_booking_confirmation does NOT call FCM when user has no push token."""
    from app.services.notification import notification_service

    user, _ = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    with patch("app.services.fcm.fcm_service.notify_booking_confirmed", new_callable=AsyncMock) as mock_push, \
         patch("app.services.sms.sms_service.send_booking_confirmation", new_callable=AsyncMock), \
         patch("app.services.email.email_service.send_booking_confirmation_email", new_callable=AsyncMock):

        await notification_service.send_booking_confirmation(
            user=user,
            trip_name="Trip",
            booking_reference="BK-NOPUSH",
            trip_details={},
        )

        mock_push.assert_not_called()
