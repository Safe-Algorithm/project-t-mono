import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models.user import User
from app.models.trip import Trip
from app.models.provider import Provider
from app.models.trip_package import TripPackage


@pytest.fixture
def test_provider(session: Session) -> Provider:
    """Create a test provider."""
    provider = Provider(
        company_name="Test Provider",
        company_email="provider@test.com",
        company_phone="+1234567890"
    )
    session.add(provider)
    session.commit()
    session.refresh(provider)
    return provider


@pytest.fixture
def test_trip(session: Session, test_provider: Provider) -> Trip:
    """Create a test trip."""
    trip = Trip(
        name="Test Trip",
        description="A test trip",
        start_date=datetime.utcnow() + timedelta(days=30),
        end_date=datetime.utcnow() + timedelta(days=35),
        max_participants=10,
        provider_id=test_provider.id
    )
    session.add(trip)
    session.commit()
    session.refresh(trip)
    
    # Add a package
    package = TripPackage(
        trip_id=trip.id,
        name="Standard Package",
        description="Standard package",
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
        name="Test Trip 2",
        description="Another test trip",
        start_date=datetime.utcnow() + timedelta(days=40),
        end_date=datetime.utcnow() + timedelta(days=45),
        max_participants=10,
        provider_id=test_provider.id
    )
    session.add(trip)
    session.commit()
    session.refresh(trip)
    
    # Add a package
    package = TripPackage(
        trip_id=trip.id,
        name="Standard Package",
        description="Standard package",
        price=1500.0,
        currency="SAR"
    )
    session.add(package)
    session.commit()
    
    return trip


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


# ==================== LIKES TESTS ====================

def test_like_trip_success(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test successfully liking a trip."""
    response = client.post(
        f"/api/v1/trips/{test_trip.id}/like",
        headers=user_authentication_headers
    )
    
    assert response.status_code == 201
    assert response.json()["message"] == "Trip liked"
    
    # Verify by checking likes list
    likes_response = client.get("/api/v1/likes", headers=user_authentication_headers)
    assert likes_response.status_code == 200
    likes = likes_response.json()
    assert len(likes) == 1
    assert likes[0]["id"] == str(test_trip.id)


def test_like_trip_nonexistent(
    client: TestClient,
    user_authentication_headers: dict
):
    """Test liking a non-existent trip returns 404."""
    fake_trip_id = uuid.uuid4()
    response = client.post(
        f"/api/v1/trips/{fake_trip_id}/like",
        headers=user_authentication_headers
    )
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"


def test_like_trip_duplicate(
    client: TestClient,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test liking a trip twice returns 400."""
    # Like the trip first time
    response1 = client.post(
        f"/api/v1/trips/{test_trip.id}/like",
        headers=user_authentication_headers
    )
    assert response1.status_code == 201
    
    # Try to like again
    response2 = client.post(
        f"/api/v1/trips/{test_trip.id}/like",
        headers=user_authentication_headers
    )
    assert response2.status_code == 400
    assert response2.json()["detail"] == "Trip already liked"


def test_like_trip_requires_auth(client: TestClient, test_trip: Trip):
    """Test that liking a trip requires authentication."""
    response = client.post(f"/api/v1/trips/{test_trip.id}/like")
    assert response.status_code == 401


def test_unlike_trip_success(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test successfully unliking a trip."""
    # First like the trip
    add_response = client.post(
        f"/api/v1/trips/{test_trip.id}/like",
        headers=user_authentication_headers
    )
    assert add_response.status_code == 201
    
    # Unlike the trip
    response = client.delete(
        f"/api/v1/trips/{test_trip.id}/like",
        headers=user_authentication_headers
    )
    
    assert response.status_code == 200
    assert response.json()["message"] == "Trip unliked"
    
    # Verify by checking likes list is empty
    likes_response = client.get("/api/v1/likes", headers=user_authentication_headers)
    assert likes_response.status_code == 200
    assert likes_response.json() == []


def test_unlike_trip_not_liked(
    client: TestClient,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test unliking a trip that is not liked returns 404."""
    response = client.delete(
        f"/api/v1/trips/{test_trip.id}/like",
        headers=user_authentication_headers
    )
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not liked"


def test_unlike_trip_requires_auth(client: TestClient, test_trip: Trip):
    """Test that unliking a trip requires authentication."""
    response = client.delete(f"/api/v1/trips/{test_trip.id}/like")
    assert response.status_code == 401


def test_get_user_likes_empty(
    client: TestClient,
    user_authentication_headers: dict
):
    """Test getting likes when user has no likes."""
    response = client.get("/api/v1/likes", headers=user_authentication_headers)
    
    assert response.status_code == 200
    assert response.json() == []


def test_get_user_likes_single_trip(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test getting likes with a single trip."""
    # Like trip via API
    add_response = client.post(
        f"/api/v1/trips/{test_trip.id}/like",
        headers=user_authentication_headers
    )
    assert add_response.status_code == 201
    
    response = client.get("/api/v1/likes", headers=user_authentication_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(test_trip.id)
    assert data[0]["name"] == test_trip.name


def test_get_user_likes_multiple_trips(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    test_trip2: Trip,
    user_authentication_headers: dict
):
    """Test getting likes with multiple trips."""
    # Like trips via API (trip2 first, then trip1)
    client.post(
        f"/api/v1/trips/{test_trip2.id}/like",
        headers=user_authentication_headers
    )
    client.post(
        f"/api/v1/trips/{test_trip.id}/like",
        headers=user_authentication_headers
    )
    
    response = client.get("/api/v1/likes", headers=user_authentication_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # Should be ordered by most recently added (trip1, then trip2)
    assert data[0]["id"] == str(test_trip.id)
    assert data[1]["id"] == str(test_trip2.id)


def test_get_user_likes_user_isolation(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_user2: User,
    test_trip: Trip,
    test_trip2: Trip,
    user_authentication_headers: dict
):
    """Test that users only see their own likes."""
    # User 1 likes trip 1 via API
    client.post(
        f"/api/v1/trips/{test_trip.id}/like",
        headers=user_authentication_headers
    )
    
    # User 2 likes trip 2 directly in DB (simulating another user)
    from app.models.trip_like import TripLike
    like2 = TripLike(user_id=test_user2.id, trip_id=test_trip2.id)
    session.add(like2)
    session.commit()
    
    # User 1 should only see trip 1
    response = client.get("/api/v1/likes", headers=user_authentication_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(test_trip.id)


def test_get_user_likes_requires_auth(client: TestClient):
    """Test that getting likes requires authentication."""
    response = client.get("/api/v1/likes")
    assert response.status_code == 401


# ==================== BOOKMARKS TESTS ====================

def test_bookmark_trip_success(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test successfully bookmarking a trip."""
    response = client.post(
        f"/api/v1/trips/{test_trip.id}/bookmark",
        headers=user_authentication_headers
    )
    
    assert response.status_code == 201
    assert response.json()["message"] == "Trip bookmarked"
    
    # Verify by checking bookmarks list
    bookmarks_response = client.get("/api/v1/bookmarks", headers=user_authentication_headers)
    assert bookmarks_response.status_code == 200
    bookmarks = bookmarks_response.json()
    assert len(bookmarks) == 1
    assert bookmarks[0]["id"] == str(test_trip.id)


def test_bookmark_trip_nonexistent(
    client: TestClient,
    user_authentication_headers: dict
):
    """Test bookmarking a non-existent trip returns 404."""
    fake_trip_id = uuid.uuid4()
    response = client.post(
        f"/api/v1/trips/{fake_trip_id}/bookmark",
        headers=user_authentication_headers
    )
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"


def test_bookmark_trip_duplicate(
    client: TestClient,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test bookmarking a trip twice returns 400."""
    # Bookmark the trip first time
    response1 = client.post(
        f"/api/v1/trips/{test_trip.id}/bookmark",
        headers=user_authentication_headers
    )
    assert response1.status_code == 201
    
    # Try to bookmark again
    response2 = client.post(
        f"/api/v1/trips/{test_trip.id}/bookmark",
        headers=user_authentication_headers
    )
    assert response2.status_code == 400
    assert response2.json()["detail"] == "Trip already bookmarked"


def test_bookmark_trip_requires_auth(client: TestClient, test_trip: Trip):
    """Test that bookmarking a trip requires authentication."""
    response = client.post(f"/api/v1/trips/{test_trip.id}/bookmark")
    assert response.status_code == 401


def test_unbookmark_trip_success(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test successfully unbookmarking a trip."""
    # First bookmark the trip
    add_response = client.post(
        f"/api/v1/trips/{test_trip.id}/bookmark",
        headers=user_authentication_headers
    )
    assert add_response.status_code == 201
    
    # Unbookmark the trip
    response = client.delete(
        f"/api/v1/trips/{test_trip.id}/bookmark",
        headers=user_authentication_headers
    )
    
    assert response.status_code == 200
    assert response.json()["message"] == "Trip unbookmarked"
    
    # Verify by checking bookmarks list is empty
    bookmarks_response = client.get("/api/v1/bookmarks", headers=user_authentication_headers)
    assert bookmarks_response.status_code == 200
    assert bookmarks_response.json() == []


def test_unbookmark_trip_not_bookmarked(
    client: TestClient,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test unbookmarking a trip that is not bookmarked returns 404."""
    response = client.delete(
        f"/api/v1/trips/{test_trip.id}/bookmark",
        headers=user_authentication_headers
    )
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not bookmarked"


def test_unbookmark_trip_requires_auth(client: TestClient, test_trip: Trip):
    """Test that unbookmarking a trip requires authentication."""
    response = client.delete(f"/api/v1/trips/{test_trip.id}/bookmark")
    assert response.status_code == 401


def test_get_user_bookmarks_empty(
    client: TestClient,
    user_authentication_headers: dict
):
    """Test getting bookmarks when user has no bookmarks."""
    response = client.get("/api/v1/bookmarks", headers=user_authentication_headers)
    
    assert response.status_code == 200
    assert response.json() == []


def test_get_user_bookmarks_single_trip(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test getting bookmarks with a single trip."""
    # Bookmark trip via API
    add_response = client.post(
        f"/api/v1/trips/{test_trip.id}/bookmark",
        headers=user_authentication_headers
    )
    assert add_response.status_code == 201
    
    response = client.get("/api/v1/bookmarks", headers=user_authentication_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(test_trip.id)
    assert data[0]["name"] == test_trip.name


def test_get_user_bookmarks_multiple_trips(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    test_trip2: Trip,
    user_authentication_headers: dict
):
    """Test getting bookmarks with multiple trips."""
    # Bookmark trips via API (trip2 first, then trip1)
    client.post(
        f"/api/v1/trips/{test_trip2.id}/bookmark",
        headers=user_authentication_headers
    )
    client.post(
        f"/api/v1/trips/{test_trip.id}/bookmark",
        headers=user_authentication_headers
    )
    
    response = client.get("/api/v1/bookmarks", headers=user_authentication_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # Should be ordered by most recently added (trip1, then trip2)
    assert data[0]["id"] == str(test_trip.id)
    assert data[1]["id"] == str(test_trip2.id)


def test_get_user_bookmarks_user_isolation(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_user2: User,
    test_trip: Trip,
    test_trip2: Trip,
    user_authentication_headers: dict
):
    """Test that users only see their own bookmarks."""
    # User 1 bookmarks trip 1 via API
    client.post(
        f"/api/v1/trips/{test_trip.id}/bookmark",
        headers=user_authentication_headers
    )
    
    # User 2 bookmarks trip 2 directly in DB (simulating another user)
    from app.models.trip_bookmark import TripBookmark
    bookmark2 = TripBookmark(user_id=test_user2.id, trip_id=test_trip2.id)
    session.add(bookmark2)
    session.commit()
    
    # User 1 should only see trip 1
    response = client.get("/api/v1/bookmarks", headers=user_authentication_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(test_trip.id)


def test_get_user_bookmarks_requires_auth(client: TestClient):
    """Test that getting bookmarks requires authentication."""
    response = client.get("/api/v1/bookmarks")
    assert response.status_code == 401


# ==================== INDEPENDENCE TESTS ====================

def test_likes_and_bookmarks_are_independent(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    test_trip2: Trip,
    user_authentication_headers: dict
):
    """Test that likes and bookmarks are independent - user can like one trip and bookmark another."""
    # Like trip 1
    like_response = client.post(
        f"/api/v1/trips/{test_trip.id}/like",
        headers=user_authentication_headers
    )
    assert like_response.status_code == 201
    
    # Bookmark trip 2
    bookmark_response = client.post(
        f"/api/v1/trips/{test_trip2.id}/bookmark",
        headers=user_authentication_headers
    )
    assert bookmark_response.status_code == 201
    
    # Check likes - should only have trip 1
    likes_response = client.get("/api/v1/likes", headers=user_authentication_headers)
    likes = likes_response.json()
    assert len(likes) == 1
    assert likes[0]["id"] == str(test_trip.id)
    
    # Check bookmarks - should only have trip 2
    bookmarks_response = client.get("/api/v1/bookmarks", headers=user_authentication_headers)
    bookmarks = bookmarks_response.json()
    assert len(bookmarks) == 1
    assert bookmarks[0]["id"] == str(test_trip2.id)


def test_user_can_like_and_bookmark_same_trip(
    client: TestClient,
    session: Session,
    normal_user: User,
    test_trip: Trip,
    user_authentication_headers: dict
):
    """Test that a user can both like and bookmark the same trip."""
    # Like the trip
    like_response = client.post(
        f"/api/v1/trips/{test_trip.id}/like",
        headers=user_authentication_headers
    )
    assert like_response.status_code == 201
    
    # Bookmark the same trip
    bookmark_response = client.post(
        f"/api/v1/trips/{test_trip.id}/bookmark",
        headers=user_authentication_headers
    )
    assert bookmark_response.status_code == 201
    
    # Both lists should contain the trip
    likes_response = client.get("/api/v1/likes", headers=user_authentication_headers)
    likes = likes_response.json()
    assert len(likes) == 1
    assert likes[0]["id"] == str(test_trip.id)
    
    bookmarks_response = client.get("/api/v1/bookmarks", headers=user_authentication_headers)
    bookmarks = bookmarks_response.json()
    assert len(bookmarks) == 1
    assert bookmarks[0]["id"] == str(test_trip.id)
