from fastapi.testclient import TestClient
from sqlmodel import Session
from app.core.config import settings
from app.models.user import UserRole
from app.tests.utils.user import user_authentication_headers
from app.tests.utils.trip import create_random_trip
from app.schemas.trip import TripCreate
from app import crud
import datetime

def test_create_trip(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    data = {
        "name": "Test Trip",
        "description": "Test Description",
        "start_date": str(datetime.datetime.utcnow()),
        "end_date": str(datetime.datetime.utcnow() + datetime.timedelta(days=1)),
        "price": 100.0,
        "max_participants": 10,
        "location": "Test Location"
    }
    response = client.post(f"{settings.API_V1_STR}/trips", headers=headers, json=data)
    assert response.status_code == 200
    created_trip = response.json()
    assert created_trip["name"] == data["name"]

def test_read_trips(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Provider",
        description="A trip created for a specific provider",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Provider's Location",
        price=150.0,
        max_participants=20
    )
    crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    response = client.get(f"{settings.API_V1_STR}/trips", headers=headers)
    assert response.status_code == 200
    trips = response.json()
    assert len(trips) > 0

def test_read_trip(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip to Read",
        description="A trip to be read",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Readable Location",
        price=200.0,
        max_participants=5
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    response = client.get(f"{settings.API_V1_STR}/trips/{trip.id}", headers=headers)
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == trip.name

def test_update_trip(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip to Update",
        description="A trip to be updated",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Updatable Location",
        price=250.0,
        max_participants=15
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    data = {"name": "Updated Test Trip"}
    response = client.put(f"{settings.API_V1_STR}/trips/{trip.id}", headers=headers, json=data)
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == data["name"]

def test_delete_trip(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip to Delete",
        description="A trip to be deleted",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Deletable Location",
        price=300.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    response = client.delete(f"{settings.API_V1_STR}/trips/{trip.id}", headers=headers)
    assert response.status_code == 200
    # Check that the trip was deleted
    response = client.get(f"{settings.API_V1_STR}/trips/{trip.id}", headers=headers)
    assert response.status_code == 404
