"""Tests for trip sharing endpoints."""

import datetime
import uuid
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models.user import UserRole
from app.tests.utils.user import user_authentication_headers
from app.schemas.trip import TripCreate
from app import crud
from app.core.config import settings


# ── Helpers ───────────────────────────────────────────────────────────────────

def _create_trip(
    session: Session,
    provider,
    *,
    name_en="Share Test Trip",
    name_ar=None,
    description_en="A trip to share",
    description_ar=None,
    with_image=False,
):
    trip_in = TripCreate(
        name_en=name_en,
        name_ar=name_ar,
        description_en=description_en,
        description_ar=description_ar,
        start_date=datetime.datetime(2030, 6, 1),
        end_date=datetime.datetime(2030, 6, 3),
        max_participants=20,
        images=["https://example.com/trip.jpg"] if with_image else [],
    )
    return crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider)


def _get_token(client: TestClient, trip_id) -> str:
    resp = client.get(f"{settings.API_V1_STR}/trips/{trip_id}/share")
    assert resp.status_code == 200
    return resp.json()["share_token"]


# ── 1. Generate share link ────────────────────────────────────────────────────

def test_get_share_link_creates_token(client: TestClient, session: Session):
    """Returns share_token, share_url, view_count=0, and created_at."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)

    response = client.get(f"{settings.API_V1_STR}/trips/{trip.id}/share")
    assert response.status_code == 200
    data = response.json()
    assert "share_token" in data
    assert "share_url" in data
    assert "created_at" in data
    assert data["view_count"] == 0


def test_share_token_present_in_url(client: TestClient, session: Session):
    """The share_token must appear in the share_url."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)

    data = client.get(f"{settings.API_V1_STR}/trips/{trip.id}/share").json()
    assert data["share_token"] in data["share_url"]


def test_share_url_points_to_share_endpoint(client: TestClient, session: Session):
    """share_url must contain /api/v1/share/."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)

    data = client.get(f"{settings.API_V1_STR}/trips/{trip.id}/share").json()
    assert f"{settings.API_V1_STR}/share/" in data["share_url"]


def test_share_url_includes_arabic_lang_query(client: TestClient, session: Session):
    """Arabic share requests should generate share URLs with lang=ar."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)

    data = client.get(f"{settings.API_V1_STR}/trips/{trip.id}/share?lang=ar").json()
    assert "lang=ar" in data["share_url"]


def test_share_token_is_nonempty_string(client: TestClient, session: Session):
    """Token must be a non-empty string."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)

    token = _get_token(client, trip.id)
    assert isinstance(token, str)
    assert len(token) > 0


def test_get_share_link_idempotent(client: TestClient, session: Session):
    """Calling the endpoint multiple times returns the same token."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)

    t1 = _get_token(client, trip.id)
    t2 = _get_token(client, trip.id)
    t3 = _get_token(client, trip.id)
    assert t1 == t2 == t3


def test_get_share_link_no_auth_required(client: TestClient, session: Session):
    """The generate-share endpoint requires no authentication."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)

    # Call without any Authorization header
    response = client.get(f"{settings.API_V1_STR}/trips/{trip.id}/share")
    assert response.status_code == 200


def test_share_nonexistent_trip_returns_404(client: TestClient, session: Session):
    """Requesting a share link for a non-existent trip returns 404."""
    response = client.get(f"{settings.API_V1_STR}/trips/{uuid.uuid4()}/share")
    assert response.status_code == 404


# ── 2. HTML preview page ──────────────────────────────────────────────────────

def test_share_preview_returns_html_content_type(client: TestClient, session: Session):
    """Preview endpoint returns text/html."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)
    token = _get_token(client, trip.id)

    response = client.get(f"{settings.API_V1_STR}/share/{token}")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_share_preview_og_tags_present(client: TestClient, session: Session):
    """Preview page contains all required Open Graph meta tags."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)
    token = _get_token(client, trip.id)

    body = client.get(f"{settings.API_V1_STR}/share/{token}").text
    assert 'property="og:title"' in body
    assert 'property="og:description"' in body
    assert 'property="og:url"' in body
    assert 'property="og:type"' in body


def test_share_preview_twitter_card_present(client: TestClient, session: Session):
    """Preview page contains Twitter Card meta tags."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)
    token = _get_token(client, trip.id)

    body = client.get(f"{settings.API_V1_STR}/share/{token}").text
    assert 'name="twitter:card"' in body
    assert 'name="twitter:title"' in body
    assert 'name="twitter:description"' in body


def test_share_preview_contains_trip_title(client: TestClient, session: Session):
    """Preview page body contains the trip name."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider, name_en="Madinah Discovery Trip")
    token = _get_token(client, trip.id)

    body = client.get(f"{settings.API_V1_STR}/share/{token}").text
    assert "Madinah Discovery Trip" in body


def test_share_preview_localizes_arabic_content(client: TestClient, session: Session):
    """Arabic share previews should render Arabic title, description, and page metadata."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(
        session,
        user.provider,
        name_en="Desert Journey",
        name_ar="رحلة الصحراء",
        description_en="An English description",
        description_ar="وصف عربي للرحلة",
    )
    token = _get_token(client, trip.id)

    body = client.get(f"{settings.API_V1_STR}/share/{token}?lang=ar").text
    assert 'lang="ar"' in body
    assert 'dir="rtl"' in body
    assert "رحلة الصحراء" in body
    assert "وصف عربي للرحلة" in body
    assert "افتح في تطبيق رحلة" in body
    assert "مقاعد" in body


def test_share_preview_contains_deep_link_scheme(client: TestClient, session: Session):
    """Preview page JS contains the configured deep-link scheme."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)
    token = _get_token(client, trip.id)

    body = client.get(f"{settings.API_V1_STR}/share/{token}").text
    assert f"{settings.APP_DEEP_LINK_SCHEME}://trip/" in body


def test_share_preview_deep_link_contains_trip_id(client: TestClient, session: Session):
    """The deep-link in the preview page contains the correct trip UUID."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)
    token = _get_token(client, trip.id)

    body = client.get(f"{settings.API_V1_STR}/share/{token}").text
    assert str(trip.id) in body


def test_share_preview_og_image_when_trip_has_image(client: TestClient, session: Session):
    """When the trip has images, the og:image tag is present."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider, with_image=True)
    token = _get_token(client, trip.id)

    body = client.get(f"{settings.API_V1_STR}/share/{token}").text
    assert 'property="og:image"' in body
    assert "https://example.com/trip.jpg" in body


def test_share_preview_no_og_image_when_trip_has_no_image(client: TestClient, session: Session):
    """When the trip has no images, og:image is NOT present."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider, with_image=False)
    token = _get_token(client, trip.id)

    body = client.get(f"{settings.API_V1_STR}/share/{token}").text
    assert 'property="og:image"' not in body


def test_share_preview_no_auth_required(client: TestClient, session: Session):
    """The HTML preview endpoint requires no authentication."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)
    token = _get_token(client, trip.id)

    response = client.get(f"{settings.API_V1_STR}/share/{token}")
    assert response.status_code == 200


def test_share_preview_increments_view_count(client: TestClient, session: Session):
    """Each visit to the preview page increments view_count by 1."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)
    token = _get_token(client, trip.id)

    client.get(f"{settings.API_V1_STR}/share/{token}")
    client.get(f"{settings.API_V1_STR}/share/{token}")
    client.get(f"{settings.API_V1_STR}/share/{token}")

    data = client.get(f"{settings.API_V1_STR}/trips/{trip.id}/share").json()
    assert data["view_count"] == 3


def test_share_preview_invalid_token_returns_404(client: TestClient, session: Session):
    """Invalid token returns 404."""
    response = client.get(f"{settings.API_V1_STR}/share/totally-invalid-token-xyz")
    assert response.status_code == 404


# ── 3. JSON data endpoint ─────────────────────────────────────────────────────

def test_share_data_returns_trip_json(client: TestClient, session: Session):
    """The /data endpoint returns the full trip JSON."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)
    token = _get_token(client, trip.id)

    data = client.get(f"{settings.API_V1_STR}/share/{token}/data").json()
    assert data["id"] == str(trip.id)
    assert data["name_en"] == "Share Test Trip"
    assert data["description_en"] == "A trip to share"
    assert data["max_participants"] == 20


def test_share_data_no_auth_required(client: TestClient, session: Session):
    """The /data endpoint requires no authentication."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)
    token = _get_token(client, trip.id)

    response = client.get(f"{settings.API_V1_STR}/share/{token}/data")
    assert response.status_code == 200


def test_share_data_increments_view_count(client: TestClient, session: Session):
    """The /data endpoint also increments view_count."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)
    token = _get_token(client, trip.id)

    client.get(f"{settings.API_V1_STR}/share/{token}/data")
    client.get(f"{settings.API_V1_STR}/share/{token}/data")

    data = client.get(f"{settings.API_V1_STR}/trips/{trip.id}/share").json()
    assert data["view_count"] == 2


def test_share_data_and_preview_view_counts_accumulate(client: TestClient, session: Session):
    """View count accumulates across both preview and /data endpoint visits."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)
    token = _get_token(client, trip.id)

    client.get(f"{settings.API_V1_STR}/share/{token}")        # +1
    client.get(f"{settings.API_V1_STR}/share/{token}/data")   # +1

    data = client.get(f"{settings.API_V1_STR}/trips/{trip.id}/share").json()
    assert data["view_count"] == 2


def test_share_data_invalid_token_returns_404(client: TestClient, session: Session):
    """Invalid token on /data returns 404."""
    response = client.get(f"{settings.API_V1_STR}/share/totally-invalid-token-xyz/data")
    assert response.status_code == 404


# ── 4. Multiple trips have independent tokens ─────────────────────────────────

def test_different_trips_get_different_tokens(client: TestClient, session: Session):
    """Two different trips must receive different share tokens."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_a = _create_trip(session, user.provider, name_en="Trip A")
    trip_b = _create_trip(session, user.provider, name_en="Trip B")

    token_a = _get_token(client, trip_a.id)
    token_b = _get_token(client, trip_b.id)
    assert token_a != token_b


def test_token_resolves_to_correct_trip(client: TestClient, session: Session):
    """A token for trip A must not return trip B's data."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_a = _create_trip(session, user.provider, name_en="Trip Alpha")
    trip_b = _create_trip(session, user.provider, name_en="Trip Beta")

    token_a = _get_token(client, trip_a.id)

    data = client.get(f"{settings.API_V1_STR}/share/{token_a}/data").json()
    assert data["name_en"] == "Trip Alpha"
    assert data["id"] != str(trip_b.id)
