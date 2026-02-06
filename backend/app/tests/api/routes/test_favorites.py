import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models.user import User
from app.models.provider import Provider
from app.models.trip import Trip
from app.models.trip_package import TripPackage
from app.models.trip_favorite import TripFavorite
from sqlmodel import select


@pytest.fixture
def test_user(session: Session) -> User:
    """Create a test user."""
    user = User(
        email="testuser@example.com",
        name="Test User",
        phone="+1234567890",
        hashed_password="hashedpassword",
        source="mobile_app"
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture
def test_user2(session: Session) -> User:
    """Create a second test user."""
    user = User(
        email="testuser2@example.com",
        name="Test User 2",
        phone="+1234567891",
        hashed_password="hashedpassword",
        source="mobile_app"
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture
def test_provider(session: Session) -> Provider:
    """Create a test provider."""
    provider = Provider(
        company_name="Test Provider",
        company_email="provider@example.com",
        company_phone="+1234567892",
        is_approved=True
    )
    session.add(provider)
    session.commit()
    session.refresh(provider)
    return provider


@pytest.fixture
def test_trip(session: Session, test_provider: Provider) -> Trip:
    """Create a test trip."""
    trip = Trip(
        name_en="Test Trip",
        description_en="A test trip",
        start_date=datetime.utcnow() + timedelta(days=30),
        end_date=datetime.utcnow() + timedelta(days=35),
        max_participants=10,
        provider_id=test_provider.id
    )
    session.add(trip)
    session.commit()
    session.refresh(trip)
    
    # Add a package to satisfy trip validation
    package = TripPackage(
        trip_id=trip.id,
        name_en="Standard Package",
        description_en="Standard package",
        price=1000.0,
        currency="SAR"
    )
    session.add(package)
    session.commit()
    
    return trip


@pytest.fixture
def test_trip2(session: Session, test_provider: Provider) -> Trip:
    """Create a second test trip."""
    trip = Trip(
        name_en="Test Trip 2",
        description_en="Another test trip",
        start_date=datetime.utcnow() + timedelta(days=40),
        end_date=datetime.utcnow() + timedelta(days=45),
        max_participants=15,
        provider_id=test_provider.id
    )
    session.add(trip)
    session.commit()
    session.refresh(trip)
    
    # Add a package to satisfy trip validation
    package = TripPackage(
        trip_id=trip.id,
        name_en="Standard Package",
        description_en="Standard package",
        price=1000.0,
        currency="SAR"
    )
    session.add(package)
    session.commit()
    
    return trip


def test_add_trip_to_favorites_success(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test successfully adding a trip to favorites."""
    response = client.post(
        f"/api/v1/trips/{test_trip.id}/favorite",
        headers=user_authentication_headers
    )
    
    assert response.status_code == 201
    assert response.json()["message"] == "Trip added to favorites"
    
    # Verify by checking favorites list
    favorites_response = client.get("/api/v1/favorites", headers=user_authentication_headers)
    assert favorites_response.status_code == 200
    favorites = favorites_response.json()
    assert len(favorites) == 1
    assert favorites[0]["id"] == str(test_trip.id)


def test_add_trip_to_favorites_nonexistent_trip(
    client: TestClient,
    user_authentication_headers: dict
):
    """Test adding a non-existent trip to favorites returns 404."""
    fake_trip_id = uuid.uuid4()
    response = client.post(
        f"/api/v1/trips/{fake_trip_id}/favorite",
        headers=user_authentication_headers
    )
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"


def test_add_trip_to_favorites_duplicate(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test adding the same trip to favorites twice returns 400."""
    # Add trip to favorites first time
    response = client.post(
        f"/api/v1/trips/{test_trip.id}/favorite",
        headers=user_authentication_headers
    )
    assert response.status_code == 201
    
    # Try to add the same trip again
    response = client.post(
        f"/api/v1/trips/{test_trip.id}/favorite",
        headers=user_authentication_headers
    )
    
    assert response.status_code == 400
    assert response.json()["detail"] == "Trip already in favorites"


def test_add_trip_to_favorites_requires_auth(
    client: TestClient,
    test_trip: Trip
):
    """Test that adding to favorites requires authentication."""
    response = client.post(f"/api/v1/trips/{test_trip.id}/favorite")
    assert response.status_code == 401


def test_remove_trip_from_favorites_success(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test successfully removing a trip from favorites."""
    # First add the trip to favorites via API
    add_response = client.post(
        f"/api/v1/trips/{test_trip.id}/favorite",
        headers=user_authentication_headers
    )
    assert add_response.status_code == 201
    
    # Remove the trip from favorites
    response = client.delete(
        f"/api/v1/trips/{test_trip.id}/favorite",
        headers=user_authentication_headers
    )
    
    assert response.status_code == 200
    assert response.json()["message"] == "Trip removed from favorites"
    
    # Verify by checking favorites list is empty
    favorites_response = client.get("/api/v1/favorites", headers=user_authentication_headers)
    assert favorites_response.status_code == 200
    assert favorites_response.json() == []


def test_remove_trip_from_favorites_not_favorited(
    client: TestClient,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test removing a trip that is not in favorites returns 404."""
    response = client.delete(
        f"/api/v1/trips/{test_trip.id}/favorite",
        headers=user_authentication_headers
    )
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not in favorites"


def test_remove_trip_from_favorites_requires_auth(
    client: TestClient,
    test_trip: Trip
):
    """Test that removing from favorites requires authentication."""
    response = client.delete(f"/api/v1/trips/{test_trip.id}/favorite")
    assert response.status_code == 401


def test_get_user_favorites_empty(
    client: TestClient,
    user_authentication_headers: dict
):
    """Test getting favorites when user has no favorites."""
    response = client.get("/api/v1/favorites", headers=user_authentication_headers)
    
    assert response.status_code == 200
    assert response.json() == []


def test_get_user_favorites_single_trip(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test getting favorites with a single trip."""
    # Add trip to favorites via API
    add_response = client.post(
        f"/api/v1/trips/{test_trip.id}/favorite",
        headers=user_authentication_headers
    )
    assert add_response.status_code == 201
    
    response = client.get("/api/v1/favorites", headers=user_authentication_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(test_trip.id)
    assert data[0]["name_en"] == test_trip.name_en
    assert data[0]["description_en"] == test_trip.description_en


def test_get_user_favorites_multiple_trips(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    test_trip2: Trip,
    user_authentication_headers: dict
):
    """Test getting favorites with multiple trips."""
    # Add trips to favorites via API (trip2 first, then trip1)
    client.post(
        f"/api/v1/trips/{test_trip2.id}/favorite",
        headers=user_authentication_headers
    )
    client.post(
        f"/api/v1/trips/{test_trip.id}/favorite",
        headers=user_authentication_headers
    )
    
    response = client.get("/api/v1/favorites", headers=user_authentication_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # Should be ordered by most recently added (trip1, then trip2)
    assert data[0]["id"] == str(test_trip.id)
    assert data[1]["id"] == str(test_trip2.id)


def test_get_user_favorites_user_isolation(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_user2: User,
    test_trip: Trip,
    test_trip2: Trip,
    user_authentication_headers: dict
):
    """Test that users only see their own favorites."""
    # User 1 favorites trip 1 via API
    client.post(
        f"/api/v1/trips/{test_trip.id}/favorite",
        headers=user_authentication_headers
    )
    
    # User 2 favorites trip 2 directly in DB (simulating another user)
    favorite2 = TripFavorite(user_id=test_user2.id, trip_id=test_trip2.id)
    session.add(favorite2)
    session.commit()
    
    # User 1 should only see trip 1
    response = client.get("/api/v1/favorites", headers=user_authentication_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(test_trip.id)


def test_get_user_favorites_pagination(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_provider: Provider,
    user_authentication_headers: dict
):
    """Test pagination of favorites list."""
    # Create 5 trips and add them to favorites via API
    trips = []
    for i in range(5):
        trip = Trip(
            name=f"Test Trip {i}",
            description=f"Test trip {i}",
            start_date=datetime.utcnow() + timedelta(days=30 + i),
            end_date=datetime.utcnow() + timedelta(days=35 + i),
            max_participants=10,
            provider_id=test_provider.id
        )
        session.add(trip)
        session.commit()
        session.refresh(trip)
        
        # Add package
        package = TripPackage(
        trip_id=trip.id,
        name_en="Standard Package",
        description_en="Standard package",
        price=1000.0,
        currency="SAR"
        )
        session.add(package)
        session.commit()
        
        # Add to favorites via API
        client.post(
            f"/api/v1/trips/{trip.id}/favorite",
            headers=user_authentication_headers
        )
        trips.append(trip)
    
    # Test skip and limit
    response = client.get(
        "/api/v1/favorites?skip=1&limit=2",
        headers=user_authentication_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # Should skip the first (most recent) and return the next 2
    assert data[0]["id"] == str(trips[3].id)
    assert data[1]["id"] == str(trips[2].id)


def test_get_user_favorites_requires_auth(client: TestClient):
    """Test that getting favorites requires authentication."""
    response = client.get("/api/v1/favorites")
    assert response.status_code == 401
