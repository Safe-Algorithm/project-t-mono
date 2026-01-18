"""
Unit tests for trip reviews and ratings API
"""

import uuid
from datetime import datetime, timedelta, date
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models.user import UserRole, User
from app.models.source import RequestSource
from app.models.trip import Trip
from app.models.trip_package import TripPackage
from app.models.trip_registration import TripRegistration, TripRegistrationParticipant
from app.models.links import TripRating
from app.tests.utils.user import user_authentication_headers
from app.tests.utils.trip import create_random_trip


def test_create_review_success(client: TestClient, session: Session):
    """Test successful review creation"""
    # Create user and trip
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    trip = create_random_trip(session)
    
    # Set trip end date to past
    trip.end_date = date.today() - timedelta(days=1)
    session.add(trip)
    
    # Create package
    package = TripPackage(
        trip_id=trip.id,
        name="Standard Package",
        description="Standard package",
        price=1000.00,
        is_active=True
    )
    session.add(package)
    session.commit()
    
    # Create confirmed registration
    registration = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        total_participants=1,
        total_amount=1000.00,
        status="confirmed"
    )
    session.add(registration)
    session.commit()
    
    # Create review
    review_data = {
        "rating": 5,
        "comment": "Amazing trip! Highly recommended."
    }
    
    response = client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers,
        json=review_data
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["rating"] == 5
    assert data["comment"] == "Amazing trip! Highly recommended."
    assert data["user_id"] == str(user.id)
    assert data["trip_id"] == str(trip.id)
    assert "created_at" in data


def test_create_review_trip_not_ended(client: TestClient, session: Session):
    """Test that users cannot review trips that haven't ended"""
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    trip = create_random_trip(session)
    
    # Set trip end date to future
    trip.end_date = date.today() + timedelta(days=10)
    session.add(trip)
    
    # Create package
    package = TripPackage(
        trip_id=trip.id,
        name="Standard Package",
        description="Standard package",
        price=1000.00,
        is_active=True
    )
    session.add(package)
    session.commit()
    
    # Create confirmed registration
    registration = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        total_participants=1,
        total_amount=1000.00,
        status="confirmed"
    )
    session.add(registration)
    session.commit()
    
    # Try to create review
    review_data = {
        "rating": 5,
        "comment": "Great trip!"
    }
    
    response = client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers,
        json=review_data
    )
    
    assert response.status_code == 400
    assert "Cannot review trip until it has ended" in response.json()["detail"]


def test_create_review_no_registration(client: TestClient, session: Session):
    """Test that users cannot review trips they haven't registered for"""
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    trip = create_random_trip(session)
    
    # Set trip end date to past
    trip.end_date = date.today() - timedelta(days=1)
    session.add(trip)
    session.commit()
    
    # Try to create review without registration
    review_data = {
        "rating": 5,
        "comment": "Great trip!"
    }
    
    response = client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers,
        json=review_data
    )
    
    assert response.status_code == 400
    assert "confirmed registration" in response.json()["detail"]


def test_create_review_pending_registration(client: TestClient, session: Session):
    """Test that users cannot review trips with pending registration"""
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    trip = create_random_trip(session)
    
    # Set trip end date to past
    trip.end_date = date.today() - timedelta(days=1)
    session.add(trip)
    
    # Create package
    package = TripPackage(
        trip_id=trip.id,
        name="Standard Package",
        description="Standard package",
        price=1000.00,
        is_active=True
    )
    session.add(package)
    session.commit()
    
    # Create pending registration
    registration = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        total_participants=1,
        total_amount=1000.00,
        status="pending"  # Not confirmed
    )
    session.add(registration)
    session.commit()
    
    # Try to create review
    review_data = {
        "rating": 5,
        "comment": "Great trip!"
    }
    
    response = client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers,
        json=review_data
    )
    
    assert response.status_code == 400
    assert "confirmed registration" in response.json()["detail"]


def test_create_review_duplicate(client: TestClient, session: Session):
    """Test that users cannot review the same trip twice"""
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    trip = create_random_trip(session)
    
    # Set trip end date to past
    trip.end_date = date.today() - timedelta(days=1)
    session.add(trip)
    
    # Create package
    package = TripPackage(
        trip_id=trip.id,
        name="Standard Package",
        description="Standard package",
        price=1000.00,
        is_active=True
    )
    session.add(package)
    session.commit()
    
    # Create confirmed registration
    registration = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        total_participants=1,
        total_amount=1000.00,
        status="confirmed"
    )
    session.add(registration)
    session.commit()
    
    # Create first review
    review_data = {
        "rating": 5,
        "comment": "Great trip!"
    }
    
    response = client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers,
        json=review_data
    )
    assert response.status_code == 200
    
    # Try to create second review
    response = client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers,
        json=review_data
    )
    
    assert response.status_code == 400
    assert "already reviewed" in response.json()["detail"]


def test_create_review_invalid_rating(client: TestClient, session: Session):
    """Test that invalid ratings are rejected"""
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    trip = create_random_trip(session)
    
    # Set trip end date to past
    trip.end_date = date.today() - timedelta(days=1)
    session.add(trip)
    
    # Create package
    package = TripPackage(
        trip_id=trip.id,
        name="Standard Package",
        description="Standard package",
        price=1000.00,
        is_active=True
    )
    session.add(package)
    session.commit()
    
    # Create confirmed registration
    registration = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        total_participants=1,
        total_amount=1000.00,
        status="confirmed"
    )
    session.add(registration)
    session.commit()
    
    # Try to create review with rating > 5
    review_data = {
        "rating": 6,
        "comment": "Great trip!"
    }
    
    response = client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers,
        json=review_data
    )
    
    assert response.status_code == 422  # Validation error


def test_list_trip_reviews(client: TestClient, session: Session):
    """Test listing reviews for a trip"""
    # Create users and trip
    user1, headers1 = user_authentication_headers(client, session, role=UserRole.NORMAL)
    user2, headers2 = user_authentication_headers(client, session, role=UserRole.NORMAL)
    trip = create_random_trip(session)
    
    # Set trip end date to past
    trip.end_date = date.today() - timedelta(days=1)
    session.add(trip)
    
    # Create package
    package = TripPackage(
        trip_id=trip.id,
        name="Standard Package",
        description="Standard package",
        price=1000.00,
        is_active=True
    )
    session.add(package)
    session.commit()
    
    # Create registrations for both users
    for user in [user1, user2]:
        registration = TripRegistration(
            trip_id=trip.id,
            user_id=user.id,
            total_participants=1,
            total_amount=1000.00,
            status="confirmed"
        )
        session.add(registration)
    session.commit()
    
    # Create reviews
    client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers1,
        json={"rating": 5, "comment": "Excellent!"}
    )
    
    client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers2,
        json={"rating": 4, "comment": "Very good!"}
    )
    
    # List reviews (no auth required)
    response = client.get(f"{settings.API_V1_STR}/reviews/trips/{trip.id}")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["rating"] in [4, 5]
    assert data[1]["rating"] in [4, 5]


def test_get_trip_average_rating(client: TestClient, session: Session):
    """Test getting average rating for a trip"""
    # Create users and trip
    user1, headers1 = user_authentication_headers(client, session, role=UserRole.NORMAL)
    user2, headers2 = user_authentication_headers(client, session, role=UserRole.NORMAL)
    user3, headers3 = user_authentication_headers(client, session, role=UserRole.NORMAL)
    trip = create_random_trip(session)
    
    # Set trip end date to past
    trip.end_date = date.today() - timedelta(days=1)
    session.add(trip)
    
    # Create package
    package = TripPackage(
        trip_id=trip.id,
        name="Standard Package",
        description="Standard package",
        price=1000.00,
        is_active=True
    )
    session.add(package)
    session.commit()
    
    # Create registrations
    for user in [user1, user2, user3]:
        registration = TripRegistration(
            trip_id=trip.id,
            user_id=user.id,
            total_participants=1,
            total_amount=1000.00,
            status="confirmed"
        )
        session.add(registration)
    session.commit()
    
    # Create reviews: 5, 4, 3 (average = 4.0)
    client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers1,
        json={"rating": 5, "comment": "Excellent!"}
    )
    
    client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers2,
        json={"rating": 4, "comment": "Very good!"}
    )
    
    client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers3,
        json={"rating": 3, "comment": "Good!"}
    )
    
    # Get average rating (no auth required)
    response = client.get(f"{settings.API_V1_STR}/reviews/trips/{trip.id}/rating")
    
    assert response.status_code == 200
    data = response.json()
    assert data["average_rating"] == 4.0
    assert data["total_reviews"] == 3
    assert data["rating_distribution"]["5"] == 1
    assert data["rating_distribution"]["4"] == 1
    assert data["rating_distribution"]["3"] == 1


def test_update_review(client: TestClient, session: Session):
    """Test updating a review"""
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    trip = create_random_trip(session)
    
    # Set trip end date to past
    trip.end_date = date.today() - timedelta(days=1)
    session.add(trip)
    
    # Create package
    package = TripPackage(
        trip_id=trip.id,
        name="Standard Package",
        description="Standard package",
        price=1000.00,
        is_active=True
    )
    session.add(package)
    session.commit()
    
    # Create confirmed registration
    registration = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        total_participants=1,
        total_amount=1000.00,
        status="confirmed"
    )
    session.add(registration)
    session.commit()
    
    # Create review
    response = client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers,
        json={"rating": 3, "comment": "It was okay"}
    )
    assert response.status_code == 200
    review_id = response.json()["id"]
    
    # Update review
    update_data = {
        "rating": 5,
        "comment": "Actually, it was amazing!"
    }
    
    response = client.put(
        f"{settings.API_V1_STR}/reviews/{review_id}",
        headers=headers,
        json=update_data
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["rating"] == 5
    assert data["comment"] == "Actually, it was amazing!"


def test_update_review_not_owner(client: TestClient, session: Session):
    """Test that users cannot update other users' reviews"""
    user1, headers1 = user_authentication_headers(client, session, role=UserRole.NORMAL)
    user2, headers2 = user_authentication_headers(client, session, role=UserRole.NORMAL)
    trip = create_random_trip(session)
    
    # Set trip end date to past
    trip.end_date = date.today() - timedelta(days=1)
    session.add(trip)
    
    # Create package
    package = TripPackage(
        trip_id=trip.id,
        name="Standard Package",
        description="Standard package",
        price=1000.00,
        is_active=True
    )
    session.add(package)
    session.commit()
    
    # Create confirmed registration for user1
    registration = TripRegistration(
        trip_id=trip.id,
        user_id=user1.id,
        total_participants=1,
        total_amount=1000.00,
        status="confirmed"
    )
    session.add(registration)
    session.commit()
    
    # User1 creates review
    response = client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers1,
        json={"rating": 5, "comment": "Great!"}
    )
    assert response.status_code == 200
    review_id = response.json()["id"]
    
    # User2 tries to update user1's review
    response = client.put(
        f"{settings.API_V1_STR}/reviews/{review_id}",
        headers=headers2,
        json={"rating": 1, "comment": "Bad!"}
    )
    
    assert response.status_code == 403


def test_delete_review(client: TestClient, session: Session):
    """Test deleting a review"""
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    trip = create_random_trip(session)
    
    # Set trip end date to past
    trip.end_date = date.today() - timedelta(days=1)
    session.add(trip)
    
    # Create package
    package = TripPackage(
        trip_id=trip.id,
        name="Standard Package",
        description="Standard package",
        price=1000.00,
        is_active=True
    )
    session.add(package)
    session.commit()
    
    # Create confirmed registration
    registration = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        total_participants=1,
        total_amount=1000.00,
        status="confirmed"
    )
    session.add(registration)
    session.commit()
    
    # Create review
    response = client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip.id}",
        headers=headers,
        json={"rating": 5, "comment": "Great!"}
    )
    assert response.status_code == 200
    review_id = response.json()["id"]
    
    # Delete review
    response = client.delete(
        f"{settings.API_V1_STR}/reviews/{review_id}",
        headers=headers
    )
    
    assert response.status_code == 204
    
    # Verify review is deleted
    response = client.get(f"{settings.API_V1_STR}/reviews/trips/{trip.id}")
    assert response.status_code == 200
    assert len(response.json()) == 0


def test_get_my_reviews(client: TestClient, session: Session):
    """Test getting current user's reviews"""
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    # Create two trips
    trip1 = create_random_trip(session)
    trip2 = create_random_trip(session)
    
    for trip in [trip1, trip2]:
        # Set trip end date to past
        trip.end_date = date.today() - timedelta(days=1)
        session.add(trip)
        
        # Create package
        package = TripPackage(
            trip_id=trip.id,
            name="Standard Package",
            description="Standard package",
            price=1000.00,
            is_active=True
        )
        session.add(package)
        
        # Create confirmed registration
        registration = TripRegistration(
            trip_id=trip.id,
            user_id=user.id,
            total_participants=1,
            total_amount=1000.00,
            status="confirmed"
        )
        session.add(registration)
    
    session.commit()
    
    # Create reviews for both trips
    client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip1.id}",
        headers=headers,
        json={"rating": 5, "comment": "Trip 1 was great!"}
    )
    
    client.post(
        f"{settings.API_V1_STR}/reviews/trips/{trip2.id}",
        headers=headers,
        json={"rating": 4, "comment": "Trip 2 was good!"}
    )
    
    # Get my reviews
    response = client.get(
        f"{settings.API_V1_STR}/reviews/my-reviews",
        headers=headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert all(r["user_id"] == str(user.id) for r in data)
