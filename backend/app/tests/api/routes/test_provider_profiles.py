"""
Unit tests for public provider profiles API
"""

import uuid
from datetime import datetime, timedelta, date
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models.user import UserRole
from app.models.trip import Trip
from app.models.trip_package import TripPackage
from app.models.trip_registration import TripRegistration
from app.models.links import TripRating
from app.tests.utils.user import user_authentication_headers
from app.tests.utils.trip import create_random_trip
from app.tests.utils.provider import create_random_provider


def test_get_provider_profile_success(client: TestClient, session: Session):
    """Test successful provider profile retrieval"""
    # Create provider
    provider = create_random_provider(session)
    
    # Create some trips for this provider
    for i in range(3):
        trip = create_random_trip(session)
        trip.provider_id = provider.id
        trip.is_active = True
        session.add(trip)
    
    session.commit()
    
    # Get provider profile (no auth required)
    response = client.get(f"{settings.API_V1_STR}/provider-profiles/{provider.id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(provider.id)
    assert data["company_name"] == provider.company_name
    assert data["total_trips"] == 3
    assert data["active_trips"] == 3
    assert data["average_rating"] == 0.0  # No reviews yet
    assert data["total_reviews"] == 0


def test_get_provider_profile_with_reviews(client: TestClient, session: Session):
    """Test provider profile with reviews and ratings"""
    # Create provider
    provider = create_random_provider(session)
    
    # Create trips
    trip1 = create_random_trip(session)
    trip1.provider_id = provider.id
    trip1.is_active = True
    trip1.end_date = date.today() - timedelta(days=1)
    session.add(trip1)
    
    trip2 = create_random_trip(session)
    trip2.provider_id = provider.id
    trip2.is_active = True
    trip2.end_date = date.today() - timedelta(days=1)
    session.add(trip2)
    
    session.commit()
    
    # Create packages
    for trip in [trip1, trip2]:
        package = TripPackage(
        trip_id=trip.id,
        name_en="Standard Package",
        description_en="Standard package",
        price=1000.00,
            is_active=True
        )
        session.add(package)
    session.commit()
    
    # Create users and registrations
    user1, _ = user_authentication_headers(client, session, role=UserRole.NORMAL)
    user2, _ = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    for user in [user1, user2]:
        for trip in [trip1, trip2]:
            registration = TripRegistration(
                trip_id=trip.id,
                user_id=user.id,
                total_participants=1,
                total_amount=1000.00,
                status="confirmed"
            )
            session.add(registration)
    session.commit()
    
    # Create reviews: trip1 gets 5 and 4, trip2 gets 3 and 2
    # Average should be (5+4+3+2)/4 = 3.5
    TripRating(user_id=user1.id, trip_id=trip1.id, rating=5, comment="Excellent!")
    session.add(TripRating(user_id=user1.id, trip_id=trip1.id, rating=5, comment="Excellent!"))
    session.add(TripRating(user_id=user2.id, trip_id=trip1.id, rating=4, comment="Very good!"))
    session.add(TripRating(user_id=user1.id, trip_id=trip2.id, rating=3, comment="Good!"))
    session.add(TripRating(user_id=user2.id, trip_id=trip2.id, rating=2, comment="Okay!"))
    session.commit()
    
    # Get provider profile
    response = client.get(f"{settings.API_V1_STR}/provider-profiles/{provider.id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(provider.id)
    assert data["total_trips"] == 2
    assert data["active_trips"] == 2
    assert data["average_rating"] == 3.5
    assert data["total_reviews"] == 4


def test_get_provider_profile_with_inactive_trips(client: TestClient, session: Session):
    """Test provider profile correctly counts active vs total trips"""
    # Create provider
    provider = create_random_provider(session)
    
    # Create 5 trips: 3 active, 2 inactive
    for i in range(5):
        trip = create_random_trip(session)
        trip.provider_id = provider.id
        trip.is_active = i < 3  # First 3 are active
        session.add(trip)
    
    session.commit()
    
    # Get provider profile
    response = client.get(f"{settings.API_V1_STR}/provider-profiles/{provider.id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total_trips"] == 5
    assert data["active_trips"] == 3


def test_get_provider_profile_not_found(client: TestClient, session: Session):
    """Test provider profile returns 404 for non-existent provider"""
    fake_id = uuid.uuid4()
    
    response = client.get(f"{settings.API_V1_STR}/provider-profiles/{fake_id}")
    
    assert response.status_code == 404
    assert "Provider not found" in response.json()["detail"]


def test_get_provider_profile_no_trips(client: TestClient, session: Session):
    """Test provider profile with no trips"""
    # Create provider with no trips
    provider = create_random_provider(session)
    
    # Get provider profile
    response = client.get(f"{settings.API_V1_STR}/provider-profiles/{provider.id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(provider.id)
    assert data["total_trips"] == 0
    assert data["active_trips"] == 0
    assert data["average_rating"] == 0.0
    assert data["total_reviews"] == 0


def test_get_provider_profile_with_metadata(client: TestClient, session: Session):
    """Test provider profile includes company metadata"""
    # Create provider with metadata
    provider = create_random_provider(session)
    provider.company_metadata = {
        "logo": "https://example.com/logo.png",
        "description": "Best tours in Saudi Arabia",
        "website": "https://example.com"
    }
    session.add(provider)
    session.commit()
    
    # Get provider profile
    response = client.get(f"{settings.API_V1_STR}/provider-profiles/{provider.id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["company_metadata"]["logo"] == "https://example.com/logo.png"
    assert data["company_metadata"]["description"] == "Best tours in Saudi Arabia"
    assert data["company_metadata"]["website"] == "https://example.com"


def test_get_provider_profile_public_access(client: TestClient, session: Session):
    """Test provider profile is accessible without authentication"""
    # Create provider
    provider = create_random_provider(session)
    
    # Create a trip
    trip = create_random_trip(session)
    trip.provider_id = provider.id
    session.add(trip)
    session.commit()
    
    # Get provider profile without authentication
    response = client.get(f"{settings.API_V1_STR}/provider-profiles/{provider.id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(provider.id)
    assert data["total_trips"] == 1


def test_get_provider_profile_only_counts_own_reviews(client: TestClient, session: Session):
    """Test that provider profile only counts reviews for their own trips"""
    # Create two providers
    provider1 = create_random_provider(session)
    provider2 = create_random_provider(session)
    
    # Create trips for both providers
    trip1 = create_random_trip(session)
    trip1.provider_id = provider1.id
    trip1.end_date = date.today() - timedelta(days=1)
    session.add(trip1)
    
    trip2 = create_random_trip(session)
    trip2.provider_id = provider2.id
    trip2.end_date = date.today() - timedelta(days=1)
    session.add(trip2)
    
    session.commit()
    
    # Create packages
    for trip in [trip1, trip2]:
        package = TripPackage(
        trip_id=trip.id,
        name_en="Standard Package",
        description_en="Standard package",
        price=1000.00,
            is_active=True
        )
        session.add(package)
    session.commit()
    
    # Create user and registrations
    user, _ = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    for trip in [trip1, trip2]:
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
    session.add(TripRating(user_id=user.id, trip_id=trip1.id, rating=5, comment="Great!"))
    session.add(TripRating(user_id=user.id, trip_id=trip2.id, rating=3, comment="Okay!"))
    session.commit()
    
    # Get provider1 profile - should only have 1 review with rating 5
    response = client.get(f"{settings.API_V1_STR}/provider-profiles/{provider1.id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total_reviews"] == 1
    assert data["average_rating"] == 5.0
    
    # Get provider2 profile - should only have 1 review with rating 3
    response = client.get(f"{settings.API_V1_STR}/provider-profiles/{provider2.id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total_reviews"] == 1
    assert data["average_rating"] == 3.0
