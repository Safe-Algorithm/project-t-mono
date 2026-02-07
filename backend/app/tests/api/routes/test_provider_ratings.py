"""
Unit tests for provider reviews and ratings API
"""

import uuid
from datetime import datetime, timedelta, date
from decimal import Decimal
import io
from unittest.mock import patch, AsyncMock

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models.user import UserRole, User
from app.models.source import RequestSource
from app.models.trip import Trip
from app.models.trip_package import TripPackage
from app.models.trip_registration import TripRegistration
from app.models.provider import Provider
from app.models.provider_rating import ProviderRating
from app.tests.utils.user import user_authentication_headers, create_random_user
from app.tests.utils.trip import create_random_trip


def _create_completed_trip_with_provider(session: Session, user: User, provider: Provider):
    """
    Helper: create a trip owned by `provider` that has ended,
    with a confirmed registration for `user`.
    """
    trip = Trip(
        name_en="Completed Trip",
        description_en="A trip that already ended",
        start_date=datetime.utcnow() - timedelta(days=10),
        end_date=datetime.utcnow() - timedelta(days=2),
        max_participants=20,
        provider_id=provider.id,
        is_active=True,
    )
    session.add(trip)
    session.commit()
    session.refresh(trip)

    package = TripPackage(
        trip_id=trip.id,
        name_en="Standard",
        description_en="Standard package",
        price=Decimal("500.00"),
        is_active=True,
    )
    session.add(package)
    session.commit()

    registration = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        total_participants=1,
        total_amount=Decimal("500.00"),
        status="confirmed",
    )
    session.add(registration)
    session.commit()

    return trip


# ===== Create Rating =====


def test_create_provider_rating_success(client: TestClient, session: Session):
    """Test successful provider rating creation"""
    # Create a mobile app user
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    # Create a provider with a completed trip for this user
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider

    _create_completed_trip_with_provider(session, user, provider)

    response = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 5, "comment": "Excellent provider!"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["rating"] == 5
    assert data["comment"] == "Excellent provider!"
    assert data["user_id"] == str(user.id)
    assert data["provider_id"] == str(provider.id)
    assert data["user_name"] == user.name
    assert "created_at" in data
    assert "updated_at" in data


def test_create_provider_rating_without_comment(client: TestClient, session: Session):
    """Test creating a rating without a comment"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider
    _create_completed_trip_with_provider(session, user, provider)

    response = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 4},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["rating"] == 4
    assert data["comment"] is None


def test_create_provider_rating_no_completed_trip(client: TestClient, session: Session):
    """Test that users cannot rate a provider without completing a trip"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider

    # No completed trip — just try to rate
    response = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 3, "comment": "Never been on their trip"},
    )

    assert response.status_code == 400
    assert "completed" in response.json()["detail"].lower()


def test_create_provider_rating_trip_not_ended(client: TestClient, session: Session):
    """Test that users cannot rate if their trip hasn't ended yet"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider

    # Create a future trip with confirmed registration
    trip = Trip(
        name_en="Future Trip",
        description_en="A trip that hasn't ended",
        start_date=datetime.utcnow() + timedelta(days=5),
        end_date=datetime.utcnow() + timedelta(days=10),
        max_participants=20,
        provider_id=provider.id,
        is_active=True,
    )
    session.add(trip)
    session.commit()
    session.refresh(trip)

    package = TripPackage(
        trip_id=trip.id, name_en="Pkg", description_en="Pkg", price=Decimal("100"), is_active=True
    )
    session.add(package)
    session.commit()

    registration = TripRegistration(
        trip_id=trip.id, user_id=user.id, total_participants=1,
        total_amount=Decimal("100"), status="confirmed",
    )
    session.add(registration)
    session.commit()

    response = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 5},
    )

    assert response.status_code == 400
    assert "completed" in response.json()["detail"].lower()


def test_create_provider_rating_duplicate(client: TestClient, session: Session):
    """Test that users cannot rate the same provider twice"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider
    _create_completed_trip_with_provider(session, user, provider)

    # First rating
    response = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 5},
    )
    assert response.status_code == 200

    # Second rating — should fail
    response = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 3},
    )
    assert response.status_code == 400
    assert "already" in response.json()["detail"].lower()


def test_create_provider_rating_invalid_rating(client: TestClient, session: Session):
    """Test that rating must be between 1 and 5"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider
    _create_completed_trip_with_provider(session, user, provider)

    # Rating too high
    response = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 6},
    )
    assert response.status_code == 422

    # Rating too low
    response = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 0},
    )
    assert response.status_code == 422


def test_create_provider_rating_provider_not_found(client: TestClient, session: Session):
    """Test rating a non-existent provider"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    response = client.post(
        f"{settings.API_V1_STR}/providers/{uuid.uuid4()}/ratings",
        headers=headers,
        json={"rating": 5},
    )
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


def test_create_provider_rating_self_rate(client: TestClient, session: Session):
    """Test that a provider user cannot rate their own provider"""
    provider_user, headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider

    # Create a completed trip (provider rating themselves)
    _create_completed_trip_with_provider(session, provider_user, provider)

    response = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 5, "comment": "We are the best!"},
    )
    assert response.status_code == 400
    assert "own" in response.json()["detail"].lower()


def test_create_provider_rating_unauthenticated(client: TestClient, session: Session):
    """Test that unauthenticated users cannot rate"""
    response = client.post(
        f"{settings.API_V1_STR}/providers/{uuid.uuid4()}/ratings",
        json={"rating": 5},
    )
    assert response.status_code == 401


# ===== List Ratings =====


def test_list_provider_ratings(client: TestClient, session: Session):
    """Test listing ratings for a provider"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider
    _create_completed_trip_with_provider(session, user, provider)

    # Create a rating
    client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 4, "comment": "Good provider"},
    )

    # List ratings (public endpoint, no auth needed)
    response = client.get(f"{settings.API_V1_STR}/providers/{provider.id}/ratings")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["rating"] == 4
    assert data[0]["comment"] == "Good provider"
    assert data[0]["user_name"] == user.name


def test_list_provider_ratings_empty(client: TestClient, session: Session):
    """Test listing ratings for a provider with no ratings"""
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider

    response = client.get(f"{settings.API_V1_STR}/providers/{provider.id}/ratings")
    assert response.status_code == 200
    assert response.json() == []


# ===== Average Rating =====


def test_get_provider_average_rating(client: TestClient, session: Session):
    """Test getting average rating for a provider"""
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider

    # Create multiple users with completed trips and ratings
    for rating_val in [5, 4, 3]:
        u, h = user_authentication_headers(
            client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
        )
        _create_completed_trip_with_provider(session, u, provider)
        client.post(
            f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
            headers=h,
            json={"rating": rating_val},
        )

    response = client.get(f"{settings.API_V1_STR}/providers/{provider.id}/rating")
    assert response.status_code == 200
    data = response.json()
    assert data["provider_id"] == str(provider.id)
    assert data["average_rating"] == 4.0
    assert data["total_ratings"] == 3
    assert data["rating_distribution"]["5"] == 1
    assert data["rating_distribution"]["4"] == 1
    assert data["rating_distribution"]["3"] == 1
    assert data["rating_distribution"]["2"] == 0
    assert data["rating_distribution"]["1"] == 0


def test_get_provider_average_rating_no_ratings(client: TestClient, session: Session):
    """Test average rating when no ratings exist"""
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider

    response = client.get(f"{settings.API_V1_STR}/providers/{provider.id}/rating")
    assert response.status_code == 200
    data = response.json()
    assert data["average_rating"] == 0.0
    assert data["total_ratings"] == 0


# ===== Get My Rating =====


def test_get_my_provider_rating(client: TestClient, session: Session):
    """Test getting current user's rating for a provider"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider
    _create_completed_trip_with_provider(session, user, provider)

    # Create rating
    client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 5, "comment": "Top notch"},
    )

    response = client.get(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings/me",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["rating"] == 5
    assert data["comment"] == "Top notch"


def test_get_my_provider_rating_not_found(client: TestClient, session: Session):
    """Test getting my rating when I haven't rated the provider"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider

    response = client.get(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings/me",
        headers=headers,
    )
    assert response.status_code == 404


# ===== Update Rating =====


def test_update_provider_rating(client: TestClient, session: Session):
    """Test updating own provider rating"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider
    _create_completed_trip_with_provider(session, user, provider)

    # Create rating
    create_resp = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 3, "comment": "OK"},
    )
    rating_id = create_resp.json()["id"]

    # Update rating
    response = client.put(
        f"{settings.API_V1_STR}/providers/ratings/{rating_id}",
        headers=headers,
        json={"rating": 5, "comment": "Actually great!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["rating"] == 5
    assert data["comment"] == "Actually great!"


def test_update_provider_rating_unauthorized(client: TestClient, session: Session):
    """Test that users cannot update other users' ratings"""
    user1, headers1 = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    user2, headers2 = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider
    _create_completed_trip_with_provider(session, user1, provider)

    # User1 creates rating
    create_resp = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers1,
        json={"rating": 5},
    )
    rating_id = create_resp.json()["id"]

    # User2 tries to update it
    response = client.put(
        f"{settings.API_V1_STR}/providers/ratings/{rating_id}",
        headers=headers2,
        json={"rating": 1},
    )
    assert response.status_code == 403


def test_update_provider_rating_not_found(client: TestClient, session: Session):
    """Test updating a non-existent rating"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    response = client.put(
        f"{settings.API_V1_STR}/providers/ratings/{uuid.uuid4()}",
        headers=headers,
        json={"rating": 5},
    )
    assert response.status_code == 404


# ===== Delete Rating =====


def test_delete_provider_rating(client: TestClient, session: Session):
    """Test deleting own provider rating"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider
    _create_completed_trip_with_provider(session, user, provider)

    # Create rating
    create_resp = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 2, "comment": "Not great"},
    )
    rating_id = create_resp.json()["id"]

    # Delete rating
    response = client.delete(
        f"{settings.API_V1_STR}/providers/ratings/{rating_id}",
        headers=headers,
    )
    assert response.status_code == 204

    # Verify it's gone
    response = client.get(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings/me",
        headers=headers,
    )
    assert response.status_code == 404


def test_delete_provider_rating_unauthorized(client: TestClient, session: Session):
    """Test that users cannot delete other users' ratings"""
    user1, headers1 = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    user2, headers2 = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider
    _create_completed_trip_with_provider(session, user1, provider)

    # User1 creates rating
    create_resp = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers1,
        json={"rating": 5},
    )
    rating_id = create_resp.json()["id"]

    # User2 tries to delete it
    response = client.delete(
        f"{settings.API_V1_STR}/providers/ratings/{rating_id}",
        headers=headers2,
    )
    assert response.status_code == 403


def test_admin_delete_provider_rating(client: TestClient, session: Session):
    """Test that admin can delete any rating (moderation)"""
    user, user_headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider
    _create_completed_trip_with_provider(session, user, provider)

    # User creates rating
    create_resp = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=user_headers,
        json={"rating": 1, "comment": "Inappropriate content"},
    )
    rating_id = create_resp.json()["id"]

    # Admin deletes it
    admin, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )

    response = client.delete(
        f"{settings.API_V1_STR}/admin/providers/ratings/{rating_id}",
        headers=admin_headers,
    )
    assert response.status_code == 204


# ===== Image Upload =====


def test_upload_provider_rating_images(client: TestClient, session: Session):
    """Test uploading images to a provider rating"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider
    _create_completed_trip_with_provider(session, user, provider)

    # Create rating
    create_resp = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 5, "comment": "Great!"},
    )
    rating_id = create_resp.json()["id"]

    # Upload image
    mock_upload_result = {
        "fileId": "file123",
        "fileName": "test.jpg",
        "downloadUrl": "https://storage.example.com/test.jpg",
    }

    with patch("app.api.routes.provider_ratings.storage_service") as mock_storage:
        mock_storage.upload_file = AsyncMock(return_value=mock_upload_result)

        file_content = b"fake image content"
        response = client.post(
            f"{settings.API_V1_STR}/providers/ratings/{rating_id}/images",
            headers=headers,
            files=[("files", ("test.jpg", io.BytesIO(file_content), "image/jpeg"))],
        )

    assert response.status_code == 200
    data = response.json()
    assert len(data["images"]) == 1
    assert data["images"][0] == "https://storage.example.com/test.jpg"


def test_upload_provider_rating_images_max_limit(client: TestClient, session: Session):
    """Test that maximum 5 images are allowed"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider
    _create_completed_trip_with_provider(session, user, provider)

    # Create rating with 5 existing images
    rating = ProviderRating(
        user_id=user.id,
        provider_id=provider.id,
        rating=5,
        images=["img1.jpg", "img2.jpg", "img3.jpg", "img4.jpg", "img5.jpg"],
    )
    session.add(rating)
    session.commit()
    session.refresh(rating)

    # Try to upload one more
    file_content = b"fake image"
    response = client.post(
        f"{settings.API_V1_STR}/providers/ratings/{rating.id}/images",
        headers=headers,
        files=[("files", ("extra.jpg", io.BytesIO(file_content), "image/jpeg"))],
    )
    assert response.status_code == 400
    assert "maximum" in response.json()["detail"].lower()


def test_upload_provider_rating_images_invalid_type(client: TestClient, session: Session):
    """Test that only allowed image types are accepted"""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider
    _create_completed_trip_with_provider(session, user, provider)

    # Create rating
    create_resp = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers,
        json={"rating": 5},
    )
    rating_id = create_resp.json()["id"]

    file_content = b"fake pdf content"
    response = client.post(
        f"{settings.API_V1_STR}/providers/ratings/{rating_id}/images",
        headers=headers,
        files=[("files", ("doc.pdf", io.BytesIO(file_content), "application/pdf"))],
    )
    assert response.status_code == 400
    assert "invalid file type" in response.json()["detail"].lower()


def test_upload_provider_rating_images_not_owner(client: TestClient, session: Session):
    """Test that only the rating owner can upload images"""
    user1, headers1 = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    user2, headers2 = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    provider_user, _ = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    provider = provider_user.provider
    _create_completed_trip_with_provider(session, user1, provider)

    # User1 creates rating
    create_resp = client.post(
        f"{settings.API_V1_STR}/providers/{provider.id}/ratings",
        headers=headers1,
        json={"rating": 5},
    )
    rating_id = create_resp.json()["id"]

    # User2 tries to upload images
    file_content = b"fake image"
    response = client.post(
        f"{settings.API_V1_STR}/providers/ratings/{rating_id}/images",
        headers=headers2,
        files=[("files", ("test.jpg", io.BytesIO(file_content), "image/jpeg"))],
    )
    assert response.status_code == 403
