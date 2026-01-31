"""Tests for trip extra fees API endpoints."""

import uuid
import datetime
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models.trip_amenity import TripExtraFee, TripAmenity
from app.models.user import UserRole
from app.tests.utils.user import user_authentication_headers
from app.schemas.trip import TripCreate
from app import crud
from app.core.config import settings


def test_create_extra_fee(client: TestClient, session: Session):
    """Test creating an extra fee for a trip."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create a trip
    trip_in = TripCreate(
        name="Test Trip",
        description="Test Description",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/extra-fees",
        json={
            "name_en": "Airport Tax",
            "name_ar": "ضريبة المطار",
            "description_en": "Mandatory airport departure tax",
            "description_ar": "ضريبة المغادرة من المطار الإلزامية",
            "amount": 150.00,
            "currency": "SAR",
            "is_mandatory": True
        },
        headers=headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name_en"] == "Airport Tax"
    assert data["name_ar"] == "ضريبة المطار"
    assert float(data["amount"]) == 150.00
    assert data["currency"] == "SAR"
    assert data["is_mandatory"] is True
    assert data["trip_id"] == str(trip.id)


def test_get_trip_extra_fees(client: TestClient, session: Session):
    """Test getting all extra fees for a trip (public endpoint)."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create a trip
    trip_in = TripCreate(
        name="Test Trip",
        description="Test Description",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create some extra fees
    fee1 = TripExtraFee(
        trip_id=trip.id,
        name_en="Airport Tax",
        name_ar="ضريبة المطار",
        amount=Decimal("150.00"),
        currency="SAR",
        is_mandatory=True
    )
    fee2 = TripExtraFee(
        trip_id=trip.id,
        name_en="Optional Tour",
        name_ar="جولة اختيارية",
        amount=Decimal("200.00"),
        currency="SAR",
        is_mandatory=False
    )
    session.add(fee1)
    session.add(fee2)
    session.commit()
    
    # Public endpoint - no auth required
    response = client.get(f"{settings.API_V1_STR}/trips/{trip.id}/extra-fees")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name_en"] == "Airport Tax"
    assert data[1]["name_en"] == "Optional Tour"


def test_update_extra_fee(client: TestClient, session: Session):
    """Test updating an extra fee."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create a trip
    trip_in = TripCreate(
        name="Test Trip",
        description="Test Description",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create an extra fee
    fee = TripExtraFee(
        trip_id=trip.id,
        name_en="Old Name",
        name_ar="اسم قديم",
        amount=Decimal("100.00"),
        currency="SAR",
        is_mandatory=True
    )
    session.add(fee)
    session.commit()
    session.refresh(fee)
    
    response = client.put(
        f"{settings.API_V1_STR}/trips/{trip.id}/extra-fees/{fee.id}",
        json={
            "name_en": "Updated Name",
            "name_ar": "اسم محدث",
            "amount": 150.00,
            "is_mandatory": False
        },
        headers=headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name_en"] == "Updated Name"
    assert data["name_ar"] == "اسم محدث"
    assert float(data["amount"]) == 150.00
    assert data["is_mandatory"] is False


def test_delete_extra_fee(client: TestClient, session: Session):
    """Test deleting an extra fee."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create a trip
    trip_in = TripCreate(
        name="Test Trip",
        description="Test Description",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create an extra fee
    fee = TripExtraFee(
        trip_id=trip.id,
        name_en="To Delete",
        name_ar="للحذف",
        amount=Decimal("100.00"),
        currency="SAR",
        is_mandatory=True
    )
    session.add(fee)
    session.commit()
    session.refresh(fee)
    
    response = client.delete(
        f"{settings.API_V1_STR}/trips/{trip.id}/extra-fees/{fee.id}",
        headers=headers
    )
    
    assert response.status_code == 200
    assert response.json()["message"] == "Extra fee deleted successfully"
    
    # Verify it's deleted
    deleted_fee = session.get(TripExtraFee, fee.id)
    assert deleted_fee is None


