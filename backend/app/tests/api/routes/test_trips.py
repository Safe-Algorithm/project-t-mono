from fastapi.testclient import TestClient
from sqlmodel import Session
from freezegun import freeze_time
from app.core.config import settings
from app.models.user import UserRole
from app.models.source import RequestSource
from app.models.trip_field import TripFieldType
from app.models.trip_package import TripPackage
from app.models.trip_registration import TripRegistration, TripRegistrationParticipant
from app.tests.utils.user import user_authentication_headers
from app.tests.utils.trip import create_random_trip
from app.schemas.trip import TripCreate
from app.schemas.trip_registration import TripRegistrationCreate, TripParticipantCreate
from app import crud
import datetime
import uuid
from io import BytesIO
from unittest.mock import patch, MagicMock, AsyncMock

def test_create_trip(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    data = {
        "name_en": "Test Trip",
            "name_ar": "Test Trip AR",
        "description_en": "Test Description",
            "description_ar": "Test Description AR",
        "start_date": str(datetime.datetime.utcnow()),
        "end_date": str(datetime.datetime.utcnow() + datetime.timedelta(days=1)),
        "max_participants": 10
    }
    response = client.post(f"{settings.API_V1_STR}/trips", headers=headers, json=data)
    assert response.status_code == 200
    created_trip = response.json()
    assert created_trip["name_en"] == data["name_en"]

def test_read_trips(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Provider",
        description_en="A trip created for a specific provider",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=20
    )
    crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    response = client.get(f"{settings.API_V1_STR}/trips", headers=headers)
    assert response.status_code == 200
    trips = response.json()
    assert len(trips) > 0

def test_read_trip(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Reading",
        description_en="A trip created for reading test",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=5
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create a package for the trip (required for trip to be readable)
    package_data = {
        "name_en": "Standard Package",
            "name_ar": "Standard Package AR",
        "description_en": "Basic trip package",
            "description_ar": "Basic trip package AR",
        "price": 150.0
    }
    package_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data
    )
    assert package_response.status_code == 200
    
    response = client.get(f"{settings.API_V1_STR}/trips/{trip.id}", headers=headers)
    assert response.status_code == 200
    content = response.json()
    assert content["name_en"] == trip.name_en
    assert len(content["packages"]) == 1
    assert content["packages"][0]["name_en"] == "Standard Package"


def test_read_trip_without_packages_fails(client: TestClient, session: Session) -> None:
    """Test that reading a trip without packages returns 400 error"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip Without Packages",
        description_en="A trip without packages should fail",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=5
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Try to read trip without packages - should fail
    response = client.get(f"{settings.API_V1_STR}/trips/{trip.id}", headers=headers)
    assert response.status_code == 400
    content = response.json()
    assert "must have at least one package" in content["detail"]


def test_update_trip(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip to Update",
        description_en="A trip to be updated",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=15
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    data = {"name_en": "Updated Test Trip",
            "name_ar": "Updated Test Trip AR"}
    response = client.put(f"{settings.API_V1_STR}/trips/{trip.id}", headers=headers, json=data)
    assert response.status_code == 200
    content = response.json()
    assert content["name_en"] == data["name_en"]

def test_delete_trip(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip to Delete",
        description_en="A trip to be deleted",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    response = client.delete(f"{settings.API_V1_STR}/trips/{trip.id}", headers=headers)
    assert response.status_code == 200
    # Check that the trip was deleted
    response = client.get(f"{settings.API_V1_STR}/trips/{trip.id}", headers=headers)
    assert response.status_code == 404


# Note: Trip required fields tests removed - fields are now managed at package level
# See package required fields tests below for field management functionality


# Tests for Trip Packages
def test_create_trip_package(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Package",
        description_en="A trip to test packages",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    package_data = {
        "name_en": "Standard Package",
            "name_ar": "Standard Package AR",
        "description_en": "Basic package with accommodation",
            "description_ar": "Basic package with accommodation AR",
        "price": 150.0
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data
    )
    assert response.status_code == 200
    package = response.json()
    assert package["name_en"] == package_data["name_en"]
    assert float(package["price"]) == package_data["price"]


def test_get_trip_packages(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Getting Packages",
        description_en="A trip to test getting packages",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create a package first
    package_data = {
        "name_en": "Premium Package",
            "name_ar": "Premium Package AR",
        "description_en": "Premium package with extras",
            "description_ar": "Premium package with extras AR",
        "price": 250.0
    }
    client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data
    )
    
    # Get packages
    response = client.get(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers
    )
    assert response.status_code == 200
    packages = response.json()
    assert len(packages) >= 1
    assert packages[0]["name_en"] == package_data["name_en"]


def test_update_trip_package(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Package Update",
        description_en="A trip to test package updates",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create a package first
    package_data = {
        "name_en": "Basic Package",
            "name_ar": "Basic Package AR",
        "description_en": "Basic package",
            "description_ar": "Basic package AR",
        "price": 100.0
    }
    create_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data
    )
    package_id = create_response.json()["id"]
    
    # Update the package
    update_data = {
        "name_en": "Updated Basic Package",
            "name_ar": "Updated Basic Package AR",
        "price": 120.0
    }
    response = client.put(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages/{package_id}",
        headers=headers,
        json=update_data
    )
    assert response.status_code == 200
    updated_package = response.json()
    assert updated_package["name_en"] == update_data["name_en"]
    assert float(updated_package["price"]) == update_data["price"]


# Tests for Trip Registration
@patch('app.services.email.email_service.send_booking_confirmation_email')
def test_register_for_trip_single_participant(mock_email, client: TestClient, session: Session) -> None:
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Registration",
        description_en="A trip to test registration",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create a package for the trip
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.schemas.trip_package import TripPackageCreate
    package_in = TripPackageCreate(
        name_en="Standard Package",
        description_en="Standard trip package",
        price=100.0,
        is_active=True
    )
    package = TripPackageModel(trip_id=trip.id, **package_in.model_dump())
    session.add(package)
    session.commit()
    session.refresh(package)
    
    # Create mobile app user for registration
    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    # Register for the trip with a single participant
    registration_data = {
        "total_participants": 1,
        "total_amount": 100.0,
        "status": "pending",
        "participants": [
            {
                "package_id": str(package.id),
                "name": "John Doe",
                "email": "john@example.com",
                "phone": "+1234567890"
            }
        ]
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=mobile_headers,
        json=registration_data
    )
    assert response.status_code == 200
    registration = response.json()
    assert registration["total_participants"] == 1
    assert float(registration["total_amount"]) == 100.0


@patch('app.services.email.email_service.send_booking_confirmation_email')
def test_register_for_trip_multiple_participants(mock_email, client: TestClient, session: Session) -> None:
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Multi Registration",
        description_en="A trip to test multi-participant registration",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create a package for the trip
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.schemas.trip_package import TripPackageCreate
    package_in = TripPackageCreate(
        name_en="Standard Package",
        description_en="Standard trip package",
        price=100.0,
        is_active=True
    )
    package = TripPackageModel(trip_id=trip.id, **package_in.model_dump())
    session.add(package)
    session.commit()
    session.refresh(package)
    
    # Create mobile app user for registration
    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    # Register for the trip with multiple participants (each with their own package)
    registration_data = {
        "total_participants": 2,
        "total_amount": 200.0,
        "status": "pending",
        "participants": [
            {
                "package_id": str(package.id),
                "name": "John Doe",
                "email": "john@example.com",
                "phone": "+1234567890"
            },
            {
                "package_id": str(package.id),  # Each participant can choose their own package
                "name": "Jane Doe",
                "email": "jane@example.com",
                "phone": "+0987654321"
            }
        ]
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=mobile_headers,
        json=registration_data
    )
    assert response.status_code == 200
    registration = response.json()
    assert registration["total_participants"] == 2
    assert float(registration["total_amount"]) == 200.0


def test_register_for_trip_with_required_fields_validation(client: TestClient, session: Session) -> None:
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Required Fields Validation",
        description_en="A trip to test required fields validation",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create mobile app user for registration
    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    # Create a package with required fields
    package_data = {
        "name_en": "Standard Package",
            "name_ar": "Standard Package AR",
        "price": 100.0,
        "description_en": "Standard trip package",
            "description_ar": "Standard trip package AR",
        "required_fields": ["name", "phone", "email"]
    }
    package_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=provider_headers,
        json=package_data
    )
    package_id = package_response.json()["id"]
    
    # Try to register without providing required fields
    registration_data = {
        "total_participants": 1,
        "total_amount": 100.0,
        "status": "pending",
        "participants": [
            {
                "package_id": package_id,
                "name": "John Doe"
                # Missing phone and email which are required
            }
        ]
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=mobile_headers,
        json=registration_data
    )
    assert response.status_code == 400
    assert "Required field" in response.json()["detail"]


# Tests for Trip Package Required Fields
def test_create_trip_package_with_required_fields(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Package with Required Fields",
        description_en="A trip to test packages with required fields",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    package_data = {
        "name_en": "Adult Package",
            "name_ar": "Adult Package AR",
        "description_en": "Package for adults with phone requirement",
            "description_ar": "Package for adults with phone requirement AR",
        "price": 150.0,
        "required_fields": ["phone", "email"]  # name and date_of_birth are automatically added
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data
    )
    assert response.status_code == 200
    package = response.json()
    assert package["name_en"] == package_data["name_en"]
    # Check that mandatory fields are always included
    expected_fields = set(["name", "date_of_birth"] + package_data["required_fields"])
    assert set(package["required_fields"]) == expected_fields


def test_update_trip_package_required_fields(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Package Update with Required Fields",
        description_en="A trip to test package required fields updates",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create a package with initial required fields
    package_data = {
        "name_en": "Basic Package",
            "name_ar": "Basic Package AR",
        "description_en": "Basic package",
            "description_ar": "Basic package AR",
        "price": 100.0,
        "required_fields": ["phone"]  # name and date_of_birth are automatically added
    }
    create_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data
    )
    package_id = create_response.json()["id"]
    
    # Update the package with different required fields
    update_data = {
        "name_en": "Updated Basic Package",
            "name_ar": "Updated Basic Package AR",
        "required_fields": ["phone", "email"]  # name and date_of_birth are automatically added
    }
    response = client.put(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages/{package_id}",
        headers=headers,
        json=update_data
    )
    assert response.status_code == 200
    updated_package = response.json()
    assert updated_package["name_en"] == update_data["name_en"]
    # Check that mandatory fields are always included
    expected_fields = set(["name", "date_of_birth"] + update_data["required_fields"])
    assert set(updated_package["required_fields"]) == expected_fields


def test_set_package_required_fields(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Package Required Fields",
        description_en="A trip to test setting package required fields",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create a package first
    package_data = {
        "name_en": "Test Package",
            "name_ar": "Test Package AR",
        "description_en": "Test package",
            "description_ar": "Test package AR",
        "price": 100.0
    }
    create_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data
    )
    package_id = create_response.json()["id"]
    
    # Set required fields for the package
    field_types = ["phone", "email"]  # name and date_of_birth are automatically added
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages/{package_id}/required-fields",
        headers=headers,
        json=field_types
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Required fields updated successfully"


def test_get_package_required_fields(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Getting Package Required Fields",
        description_en="A trip to test getting package required fields",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create a package first
    package_data = {
        "name_en": "Test Package",
            "name_ar": "Test Package AR",
        "description_en": "Test package",
            "description_ar": "Test package AR",
        "price": 100.0
    }
    create_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data
    )
    package_id = create_response.json()["id"]
    
    # Set required fields first
    field_types = ["phone"]  # name and date_of_birth are automatically added
    client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages/{package_id}/required-fields",
        headers=headers,
        json=field_types
    )
    
    # Get required fields
    response = client.get(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages/{package_id}/required-fields",
        headers=headers
    )
    assert response.status_code == 200
    response_data = response.json()
    fields = response_data["required_fields"]
    assert len(fields) == 3  # phone + mandatory name and date_of_birth
    field_types_returned = [field["field_type"] for field in fields]
    assert "name" in field_types_returned
    assert "date_of_birth" in field_types_returned
    assert "phone" in field_types_returned


@patch('app.services.email.email_service.send_booking_confirmation_email')
def test_register_for_trip_with_package_specific_required_fields(mock_email, client: TestClient, session: Session) -> None:
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Package-Specific Required Fields",
        description_en="A trip to test package-specific required fields validation",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create two packages with different required fields
    adult_package_data = {
        "name_en": "Adult Package",
            "name_ar": "Adult Package AR",
        "description_en": "Package for adults",
            "description_ar": "Package for adults AR",
        "price": 150.0,
        "required_fields": ["phone", "email", "id_iqama_number"]  # name and date_of_birth are automatically added
    }
    adult_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=provider_headers,
        json=adult_package_data
    )
    adult_package_id = adult_response.json()["id"]
    
    child_package_data = {
        "name_en": "Child Package",
            "name_ar": "Child Package AR",
        "description_en": "Package for children",
            "description_ar": "Package for children AR",
        "price": 100.0,
        "required_fields": []  # Only mandatory name and date_of_birth for children
    }
    child_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=provider_headers,
        json=child_package_data
    )
    child_package_id = child_response.json()["id"]
    
    # Create mobile app user for registration
    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    # Register with different participants having different package requirements
    registration_data = {
        "total_participants": 2,
        "total_amount": 250.0,
        "status": "pending",
        "participants": [
            {
                "package_id": adult_package_id,
                "name": "John Doe",
                "date_of_birth": "1990-01-01",  # Mandatory field
                "phone": "+1234567890",
                "email": "john@example.com",
                "id_iqama_number": "123456789"
            },
            {
                "package_id": child_package_id,
                "name": "Jane Doe",
                "date_of_birth": "2015-05-15"
                # No phone/email required for child package
            }
        ]
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=mobile_headers,
        json=registration_data
    )
    assert response.status_code == 200
    registration = response.json()
    assert registration["total_participants"] == 2


def test_register_for_trip_missing_package_required_fields(client: TestClient, session: Session) -> None:
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Missing Package Required Fields",
        description_en="A trip to test missing package required fields validation",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create package with required fields
    package_data = {
        "name_en": "Strict Package",
            "name_ar": "Strict Package AR",
        "description_en": "Package with strict requirements",
            "description_ar": "Package with strict requirements AR",
        "price": 150.0,
        "required_fields": ["phone", "email"]  # name and date_of_birth are automatically added
    }
    package_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=provider_headers,
        json=package_data
    )
    package_id = package_response.json()["id"]
    
    # Create mobile app user for registration
    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    # Try to register without providing all required fields
    registration_data = {
        "total_participants": 1,
        "total_amount": 150.0,
        "status": "pending",
        "participants": [
            {
                "package_id": package_id,
                "name": "John Doe",
                "date_of_birth": "1990-01-01"
                # Missing phone and email which are required for this package
            }
        ]
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=mobile_headers,
        json=registration_data
    )
    assert response.status_code == 400
    assert "Required field" in response.json()["detail"]
    assert "Strict Package" in response.json()["detail"]


@patch('app.services.email.email_service.send_booking_confirmation_email')
def test_get_trip_registrations(mock_email, client: TestClient, session: Session) -> None:
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Getting Registrations",
        description_en="A trip to test getting registrations",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create mobile app user and register
    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    registration_data = {
        "total_participants": 1,
        "total_amount": 100.0,
        "participants": [
            {
                "name": "John Doe",
                "phone": "+1234567890",
                "email": "john@example.com"
            }
        ]
    }
    client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=mobile_headers,
        json=registration_data
    )
    
    # Get registrations as provider
    response = client.get(
        f"{settings.API_V1_STR}/trips/{trip.id}/registrations",
        headers=provider_headers
    )
    assert response.status_code == 200
    registrations = response.json()
    assert len(registrations) >= 1
    assert registrations[0]["total_participants"] == 1


def test_get_available_package_fields(client: TestClient, session: Session):
    """Test getting available field types with metadata for package creation (provider endpoint)."""
    # Create a provider user for authentication
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    response = client.get(f"{settings.API_V1_STR}/trips/available-fields", headers=provider_headers)
    assert response.status_code == 200
    
    data = response.json()
    assert "fields" in data
    available_fields = data["fields"]
    assert isinstance(available_fields, list)
    assert len(available_fields) > 0
    
    # Check that expected field types are present
    expected_field_names = [
        "id_iqama_number",
        "passport_number", 
        "name",
        "phone",
        "email",
        "address",
        "city",
        "country",
        "date_of_birth",
        "gender",
        "disability",
        "medical_conditions",
        "allergies"
    ]
    
    field_names = [field["field_name"] for field in available_fields]
    for expected_field in expected_field_names:
        assert expected_field in field_names
    
    # Validate field metadata structure
    for field in available_fields:
        assert "field_name" in field
        assert "display_name" in field
        assert "ui_type" in field
        assert "required" in field
        assert isinstance(field["required"], bool)
        
        # Check specific field types
        if field["field_name"] == "name":
            assert field["ui_type"] == "text"
            assert field["display_name"] == "Full Name"
            assert field["required"] == True
        elif field["field_name"] == "email":
            assert field["ui_type"] == "email"
            assert field["display_name"] == "Email Address"
        elif field["field_name"] == "date_of_birth":
            assert field["ui_type"] == "date"
            assert field["display_name"] == "Date of Birth"
        elif field["field_name"] == "gender":
            assert field["ui_type"] == "select"
            assert "options" in field
            assert len(field["options"]) == 3  # male, female, prefer_not_to_say
        elif field["field_name"] == "medical_conditions":
            assert field["ui_type"] == "textarea"


def test_get_available_package_fields_includes_arabic(client: TestClient, session: Session):
    """Test that provider available-fields endpoint returns Arabic translations."""
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    response = client.get(f"{settings.API_V1_STR}/trips/available-fields", headers=provider_headers)
    assert response.status_code == 200
    
    fields_by_name = {f["field_name"]: f for f in response.json()["fields"]}
    
    # display_name_ar should be present
    assert fields_by_name["name"]["display_name_ar"] == "الاسم الكامل"
    assert fields_by_name["gender"]["display_name_ar"] == "الجنس"
    assert fields_by_name["date_of_birth"]["display_name_ar"] == "تاريخ الميلاد"
    
    # gender options should have label_ar
    gender_options = {o["value"]: o for o in fields_by_name["gender"]["options"]}
    assert gender_options["male"]["label_ar"] == "ذكر"
    assert gender_options["female"]["label_ar"] == "أنثى"
    assert gender_options["prefer_not_to_say"]["label_ar"] == "أفضل عدم الإفصاح"
    
    # disability options should have label_ar
    disability_options = {o["value"]: o for o in fields_by_name["disability"]["options"]}
    assert disability_options["none"]["label_ar"] == "لا يوجد"
    assert disability_options["mobility"]["label_ar"] == "إعاقة حركية"


def test_public_field_metadata_english(client: TestClient, session: Session):
    """Test public field-metadata endpoint returns English labels by default."""
    response = client.get(
        f"{settings.API_V1_STR}/public-trips/field-metadata",
        headers={"Accept-Language": "en"},
    )
    assert response.status_code == 200
    
    data = response.json()
    assert "fields" in data
    fields_by_name = {f["field_name"]: f for f in data["fields"]}
    
    # All 13 field types present
    assert len(fields_by_name) == 13
    
    # English display names
    assert fields_by_name["name"]["display_name"] == "Full Name"
    assert fields_by_name["gender"]["display_name"] == "Gender"
    assert fields_by_name["date_of_birth"]["display_name"] == "Date of Birth"
    assert fields_by_name["disability"]["display_name"] == "Disability"
    
    # Gender options in English
    gender_options = {o["value"]: o for o in fields_by_name["gender"]["options"]}
    assert gender_options["male"]["label"] == "Male"
    assert gender_options["female"]["label"] == "Female"
    assert gender_options["prefer_not_to_say"]["label"] == "Prefer not to say"
    
    # ui_type correctness
    assert fields_by_name["date_of_birth"]["ui_type"] == "date"
    assert fields_by_name["gender"]["ui_type"] == "select"
    assert fields_by_name["address"]["ui_type"] == "textarea"
    assert fields_by_name["email"]["ui_type"] == "email"
    assert fields_by_name["phone"]["ui_type"] == "phone"


def test_public_field_metadata_arabic(client: TestClient, session: Session):
    """Test public field-metadata endpoint returns Arabic labels when Accept-Language: ar."""
    response = client.get(
        f"{settings.API_V1_STR}/public-trips/field-metadata",
        headers={"Accept-Language": "ar"},
    )
    assert response.status_code == 200
    
    fields_by_name = {f["field_name"]: f for f in response.json()["fields"]}
    
    # Arabic display names returned as display_name
    assert fields_by_name["name"]["display_name"] == "الاسم الكامل"
    assert fields_by_name["gender"]["display_name"] == "الجنس"
    assert fields_by_name["date_of_birth"]["display_name"] == "تاريخ الميلاد"
    assert fields_by_name["disability"]["display_name"] == "الإعاقة"
    assert fields_by_name["phone"]["display_name"] == "رقم الهاتف"
    
    # Gender option labels in Arabic
    gender_options = {o["value"]: o for o in fields_by_name["gender"]["options"]}
    assert gender_options["male"]["label"] == "ذكر"
    assert gender_options["female"]["label"] == "أنثى"
    assert gender_options["prefer_not_to_say"]["label"] == "أفضل عدم الإفصاح"
    
    # Disability option labels in Arabic
    disability_options = {o["value"]: o for o in fields_by_name["disability"]["options"]}
    assert disability_options["none"]["label"] == "لا يوجد"
    assert disability_options["mobility"]["label"] == "إعاقة حركية"
    
    # Raw Arabic fields still present for reference
    assert fields_by_name["name"]["display_name_ar"] == "الاسم الكامل"


def test_public_field_metadata_no_auth_required(client: TestClient, session: Session):
    """Test that public field-metadata endpoint requires no authentication."""
    response = client.get(f"{settings.API_V1_STR}/public-trips/field-metadata")
    assert response.status_code == 200
    assert "fields" in response.json()


def test_public_field_metadata_defaults_to_english(client: TestClient, session: Session):
    """Test that public field-metadata defaults to English when no Accept-Language header."""
    response = client.get(f"{settings.API_V1_STR}/public-trips/field-metadata")
    fields_by_name = {f["field_name"]: f for f in response.json()["fields"]}
    assert fields_by_name["name"]["display_name"] == "Full Name"
    assert fields_by_name["gender"]["options"][0]["label"] == "Male"


# Tests for registration user tracking features
@patch('app.services.email.email_service.send_booking_confirmation_email')
def test_register_for_trip_with_registration_user_tracking(mock_email, client: TestClient, session: Session) -> None:
    """Test that registration_user_id is automatically set and is_registration_user works correctly."""
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Registration User Tracking",
        description_en="A trip to test registration user tracking",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create package
    package_data = {
        "name_en": "Test Package",
            "name_ar": "Test Package AR",
        "description_en": "Test package",
            "description_ar": "Test package AR",
        "price": 100.0,
        "required_fields": []
    }
    package_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=provider_headers,
        json=package_data
    )
    package_id = package_response.json()["id"]
    
    # Create mobile app user for registration
    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    # Register with the user marking themselves as the registration user
    registration_data = {
        "total_participants": 2,
        "total_amount": 200.0,
        "status": "pending",
        "participants": [
            {
                "package_id": package_id,
                "name": "John Doe",
                "date_of_birth": "1990-01-01",
                "is_registration_user": True  # This participant is the user making the registration
            },
            {
                "package_id": package_id,
                "name": "Jane Doe",
                "date_of_birth": "1992-05-15",
                "is_registration_user": False  # This is someone else
            }
        ]
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=mobile_headers,
        json=registration_data
    )
    assert response.status_code == 200
    registration = response.json()
    
    # Verify registration was created correctly
    assert registration["total_participants"] == 2
    assert registration["user_id"] == str(mobile_user.id)
    
    # Verify participants have correct registration_user_id and is_registration_user values
    participants = registration["participants"]
    assert len(participants) == 2
    
    for participant in participants:
        # All participants should have registration_user_id set to the mobile user's ID
        assert participant["registration_user_id"] == str(mobile_user.id)
        
        # Check is_registration_user flag
        if participant["name"] == "John Doe":
            assert participant["is_registration_user"] == True
        else:
            assert participant["is_registration_user"] == False


def test_register_for_trip_multiple_registration_users_fails(client: TestClient, session: Session) -> None:
    """Test that only one participant can be marked as registration user."""
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Multiple Registration Users",
        description_en="A trip to test multiple registration users validation",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create package
    package_data = {
        "name_en": "Test Package",
            "name_ar": "Test Package AR",
        "description_en": "Test package",
            "description_ar": "Test package AR",
        "price": 100.0,
        "required_fields": []
    }
    package_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=provider_headers,
        json=package_data
    )
    package_id = package_response.json()["id"]
    
    # Create mobile app user for registration
    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    # Try to register with multiple participants marked as registration user
    registration_data = {
        "total_participants": 2,
        "total_amount": 200.0,
        "status": "pending",
        "participants": [
            {
                "package_id": package_id,
                "name": "John Doe",
                "date_of_birth": "1990-01-01",
                "is_registration_user": True  # First registration user
            },
            {
                "package_id": package_id,
                "name": "Jane Doe",
                "date_of_birth": "1992-05-15",
                "is_registration_user": True  # Second registration user - should fail
            }
        ]
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=mobile_headers,
        json=registration_data
    )
    assert response.status_code == 400
    assert "Only one participant can be marked as the registration user" in response.json()["detail"]


@patch('app.services.email.email_service.send_booking_confirmation_email')
def test_register_for_trip_no_registration_user_allowed(mock_email, client: TestClient, session: Session) -> None:
    """Test that registration can succeed with no participant marked as registration user."""
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for No Registration User",
        description_en="A trip to test no registration user scenario",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create package
    package_data = {
        "name_en": "Test Package",
            "name_ar": "Test Package AR",
        "description_en": "Test package",
            "description_ar": "Test package AR",
        "price": 100.0,
        "required_fields": []
    }
    package_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=provider_headers,
        json=package_data
    )
    package_id = package_response.json()["id"]
    
    # Create mobile app user for registration
    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    # Register with no participant marked as registration user (registering for others only)
    registration_data = {
        "total_participants": 2,
        "total_amount": 200.0,
        "status": "pending",
        "participants": [
            {
                "package_id": package_id,
                "name": "John Doe",
                "date_of_birth": "1990-01-01",
                "is_registration_user": False
            },
            {
                "package_id": package_id,
                "name": "Jane Doe",
                "date_of_birth": "1992-05-15",
                "is_registration_user": False
            }
        ]
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=mobile_headers,
        json=registration_data
    )
    assert response.status_code == 200
    registration = response.json()
    
    # Verify all participants have registration_user_id set but none are marked as registration user
    participants = registration["participants"]
    for participant in participants:
        assert participant["registration_user_id"] == str(mobile_user.id)
        assert participant["is_registration_user"] == False


def test_mandatory_fields_always_included_in_packages(client: TestClient, session: Session) -> None:
    """Test that name and date_of_birth are always included as required fields."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Mandatory Fields",
        description_en="A trip to test mandatory required fields",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create package with no required fields specified
    package_data = {
        "name_en": "Basic Package",
            "name_ar": "Basic Package AR",
        "description_en": "Package with no explicit required fields",
            "description_ar": "Package with no explicit required fields AR",
        "price": 100.0
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data
    )
    assert response.status_code == 200
    package = response.json()
    
    # Verify mandatory fields are automatically included
    required_fields = set(package["required_fields"])
    assert "name" in required_fields
    assert "date_of_birth" in required_fields
    assert len(required_fields) == 2  # Only the mandatory fields
    
    # Create another package with some fields specified
    package_data_2 = {
        "name_en": "Advanced Package",
            "name_ar": "Advanced Package AR",
        "description_en": "Package with additional required fields",
            "description_ar": "Package with additional required fields AR",
        "price": 150.0,
        "required_fields": ["phone", "email"]
    }
    response_2 = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data_2
    )
    assert response_2.status_code == 200
    package_2 = response_2.json()
    
    # Verify mandatory fields are included along with specified fields
    required_fields_2 = set(package_2["required_fields"])
    assert "name" in required_fields_2
    assert "date_of_birth" in required_fields_2
    assert "phone" in required_fields_2
    assert "email" in required_fields_2
    assert len(required_fields_2) == 4  # Mandatory + specified fields


# ============================================
# Trip Search and Filtering Tests
# ============================================

def test_search_trips_by_name(client: TestClient, session: Session) -> None:
    """Test searching trips by name"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create trips with different names
    trip1 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Dubai Adventure Tour",
        description_en="Explore Dubai",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=15),
            max_participants=20
        ),
        provider=user.provider
    )
    
    trip2 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Riyadh Cultural Experience",
        description_en="Discover Riyadh",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=20),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=25),
            max_participants=15
        ),
        provider=user.provider
    )
    
    # Search for "Dubai"
    response = client.get(
        f"{settings.API_V1_STR}/trips?search=Dubai",
        headers=headers
    )
    assert response.status_code == 200
    trips = response.json()
    assert len(trips) >= 1
    assert any(t["name_en"] == "Dubai Adventure Tour" for t in trips)
    assert not any(t["name_en"] == "Riyadh Cultural Experience" for t in trips)


def test_filter_trips_by_date_range(client: TestClient, session: Session) -> None:
    """Test filtering trips by start date range"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    now = datetime.datetime.utcnow()
    
    # Create trips with different start dates
    trip1 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Early Trip",
        description_en="Starts soon",
        start_date=now + datetime.timedelta(days=5),
            end_date=now + datetime.timedelta(days=10),
            max_participants=10
        ),
        provider=user.provider
    )
    
    trip2 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Late Trip",
        description_en="Starts later",
        start_date=now + datetime.timedelta(days=30),
            end_date=now + datetime.timedelta(days=35),
            max_participants=10
        ),
        provider=user.provider
    )
    
    # Filter for trips starting within next 15 days
    start_date_from = now.isoformat()
    start_date_to = (now + datetime.timedelta(days=15)).isoformat()
    
    response = client.get(
        f"{settings.API_V1_STR}/trips?start_date_from={start_date_from}&start_date_to={start_date_to}",
        headers=headers
    )
    assert response.status_code == 200
    trips = response.json()
    assert any(t["name_en"] == "Early Trip" for t in trips)
    assert not any(t["name_en"] == "Late Trip" for t in trips)


def test_filter_trips_by_price_range(client: TestClient, session: Session) -> None:
    """Test filtering trips by package price range"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create trip with cheap package
    trip1 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Budget Trip",
        description_en="Affordable option",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=15),
            max_participants=20
        ),
        provider=user.provider
    )
    
    # Create cheap package
    package1 = TripPackage(
        trip_id=trip1.id,
        name_en="Economy Package",
        description_en="Budget friendly",
        price=100.0,
        is_active=True
    )
    session.add(package1)
    session.commit()
    
    # Create trip with expensive package
    trip2 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Luxury Trip",
        description_en="Premium experience",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=20),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=25),
            max_participants=10
        ),
        provider=user.provider
    )
    
    # Create expensive package
    package2 = TripPackage(
        trip_id=trip2.id,
        name_en="VIP Package",
        description_en="Luxury experience",
        price=1000.0,
        is_active=True
    )
    session.add(package2)
    session.commit()
    
    # Filter for trips with price between 50 and 500
    response = client.get(
        f"{settings.API_V1_STR}/trips?min_price=50&max_price=500",
        headers=headers
    )
    assert response.status_code == 200
    trips = response.json()
    trip_names = [t["name_en"] for t in trips]
    assert "Budget Trip" in trip_names
    assert "Luxury Trip" not in trip_names


def test_filter_trips_by_participants(client: TestClient, session: Session) -> None:
    """Test filtering trips by max_participants"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create trip with small capacity
    trip1 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Small Group Trip",
        description_en="Intimate experience",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=15),
            max_participants=5
        ),
        provider=user.provider
    )
    
    # Create trip with large capacity
    trip2 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Large Group Trip",
        description_en="Big adventure",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=20),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=25),
            max_participants=50
        ),
        provider=user.provider
    )
    
    # Filter for trips with max_participants >= 10
    response = client.get(
        f"{settings.API_V1_STR}/trips?min_participants=10",
        headers=headers
    )
    assert response.status_code == 200
    trips = response.json()
    trip_names = [t["name_en"] for t in trips]
    assert "Small Group Trip" not in trip_names
    assert "Large Group Trip" in trip_names


def test_filter_trips_by_active_status(client: TestClient, session: Session) -> None:
    """Test filtering trips by is_active status"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create active trip
    trip1 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Active Trip",
        description_en="Currently available",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=15),
            max_participants=20
        ),
        provider=user.provider
    )
    trip1.is_active = True
    session.add(trip1)
    
    # Create inactive trip
    trip2 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Inactive Trip",
        description_en="Not available",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=20),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=25),
            max_participants=15
        ),
        provider=user.provider
    )
    trip2.is_active = False
    session.add(trip2)
    session.commit()
    
    # Filter for active trips only
    response = client.get(
        f"{settings.API_V1_STR}/trips?is_active=true",
        headers=headers
    )
    assert response.status_code == 200
    trips = response.json()
    trip_names = [t["name_en"] for t in trips]
    assert "Active Trip" in trip_names
    assert "Inactive Trip" not in trip_names


def test_combined_filters(client: TestClient, session: Session) -> None:
    """Test combining multiple filters"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    now = datetime.datetime.utcnow()
    
    # Create matching trip
    trip1 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Dubai Beach Adventure",
        description_en="Perfect match",
        start_date=now + datetime.timedelta(days=10),
            end_date=now + datetime.timedelta(days=15),
            max_participants=25
        ),
        provider=user.provider
    )
    package1 = TripPackage(
        trip_id=trip1.id,
        name_en="Standard Package",
        description_en="Good value",
        price=300.0,
        is_active=True
    )
    session.add(package1)
    session.commit()
    
    # Create non-matching trip (wrong name)
    trip2 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Riyadh City Tour",
        description_en="Different location",
        start_date=now + datetime.timedelta(days=10),
            end_date=now + datetime.timedelta(days=15),
            max_participants=25
        ),
        provider=user.provider
    )
    package2 = TripPackage(
        trip_id=trip2.id,
        name_en="Standard Package",
        description_en="Good value",
        price=100.0,
        is_active=True
    )
    session.add(package2)
    session.commit()
    
    # Apply multiple filters
    start_date_from = now.isoformat()
    start_date_to = (now + datetime.timedelta(days=20)).isoformat()
    
    response = client.get(
        f"{settings.API_V1_STR}/trips?search=Dubai&min_price=200&max_price=400&min_participants=20&start_date_from={start_date_from}&start_date_to={start_date_to}",
        headers=headers
    )
    assert response.status_code == 200
    trips = response.json()
    assert len(trips) >= 1
    assert any(t["name_en"] == "Dubai Beach Adventure" for t in trips)
    assert not any(t["name_en"] == "Riyadh City Tour" for t in trips)


def test_public_trip_search(client: TestClient, session: Session) -> None:
    """Test public trip search endpoint (for mobile app)"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create active trip
    trip1 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Public Adventure",
        description_en="Available to all",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=15),
            max_participants=30
        ),
        provider=user.provider
    )
    trip1.is_active = True
    session.add(trip1)
    
    # Create package
    package = TripPackage(
        trip_id=trip1.id,
        name_en="Standard Package",
        description_en="Good value",
        price=100.0,
        is_active=True
    )
    session.add(package)
    session.commit()
    
    # Test public endpoint (no auth required)
    response = client.get(f"{settings.API_V1_STR}/public-trips?search=Adventure")
    assert response.status_code == 200
    trips = response.json()
    assert len(trips) >= 1
    assert any(t["name_en"] == "Public Adventure" for t in trips)


def test_admin_trip_search_with_provider_filter(client: TestClient, session: Session) -> None:
    """Test admin can filter trips by provider"""
    # Create two different providers
    user1, headers1 = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    user2, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create trip for provider 1
    trip1 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Provider 1 Trip",
        description_en="First provider",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=15),
            max_participants=20
        ),
        provider=user1.provider
    )
    
    # Create trip for provider 2
    trip2 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Provider 2 Trip",
        description_en="Second provider",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=15),
            max_participants=20
        ),
        provider=user2.provider
    )
    
    # Create admin user
    admin_user, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    
    # Filter by provider 1
    response = client.get(
        f"{settings.API_V1_STR}/admin/trips?provider_id={user1.provider_id}",
        headers=admin_headers
    )
    assert response.status_code == 200
    trips = response.json()
    trip_names = [t["name_en"] for t in trips]
    assert "Provider 1 Trip" in trip_names
    assert "Provider 2 Trip" not in trip_names


def test_filter_trips_by_provider_name(client: TestClient, session: Session) -> None:
    """Test filtering trips by provider company name"""
    # Create two providers with different names
    user1, headers1 = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    # Update provider 1 name
    user1.provider.company_name = "Adventure Tours LLC"
    session.add(user1.provider)
    
    user2, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    # Update provider 2 name
    user2.provider.company_name = "Luxury Travel Co"
    session.add(user2.provider)
    session.commit()
    
    # Create trips for both providers
    trip1 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Desert Safari",
        description_en="Adventure in the desert",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=15),
            max_participants=20
        ),
        provider=user1.provider
    )
    
    trip2 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Beach Resort",
        description_en="Luxury beach experience",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=15),
            max_participants=15
        ),
        provider=user2.provider
    )
    
    # Create packages for both trips
    package1 = TripPackage(
        trip_id=trip1.id,
        name_en="Standard",
        description_en="Basic",
        price=100.0,
        is_active=True)
    package2 = TripPackage(
        trip_id=trip2.id,
        name_en="VIP",
        description_en="Luxury",
        price=200.0,
        is_active=True)
    session.add(package1)
    session.commit()
    session.add(package2)
    session.commit()
    
    # Search by provider name "Adventure"
    response = client.get(f"{settings.API_V1_STR}/public-trips?provider_name=Adventure")
    assert response.status_code == 200
    trips = response.json()
    trip_names = [t["name_en"] for t in trips]
    assert "Desert Safari" in trip_names
    assert "Beach Resort" not in trip_names


def test_filter_trips_by_rating(client: TestClient, session: Session) -> None:
    """Test filtering trips by minimum rating"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create two trips
    trip1 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Highly Rated Trip",
        description_en="Excellent reviews",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=15),
            max_participants=20
        ),
        provider=user.provider
    )
    
    trip2 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Poorly Rated Trip",
        description_en="Needs improvement",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=20),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=25),
            max_participants=15
        ),
        provider=user.provider
    )
    
    # Create packages
    package1 = TripPackage(
        trip_id=trip1.id,
        name_en="Standard",
        description_en="Basic",
        price=100.0,
        is_active=True)
    package2 = TripPackage(
        trip_id=trip2.id,
        name_en="Standard",
        description_en="Basic",
        price=100.0,
        is_active=True)
    session.add(package1)
    session.commit()
    session.add(package2)
    session.commit()
    
    # Create normal users for ratings
    from app.models.user import User as UserModel
    from app.models.links import TripRating
    
    rater1 = UserModel(
        email="rater1@example.com",
        name="Rater 1",
        phone="1234567890",
        hashed_password="hashed",
        source="mobile_app"
    )
    rater2 = UserModel(
        email="rater2@example.com",
        name="Rater 2",
        phone="1234567891",
        hashed_password="hashed",
        source="mobile_app"
    )
    session.add(rater1)
    session.add(rater2)
    session.commit()
    
    # Add high ratings to trip1 (average: 4.5)
    rating1 = TripRating(user_id=rater1.id, trip_id=trip1.id, rating=5, comment="Excellent!")
    rating2 = TripRating(user_id=rater2.id, trip_id=trip1.id, rating=4, comment="Great!")
    
    # Add low ratings to trip2 (average: 2.5)
    rating3 = TripRating(user_id=rater1.id, trip_id=trip2.id, rating=3, comment="Okay")
    rating4 = TripRating(user_id=rater2.id, trip_id=trip2.id, rating=2, comment="Not great")
    
    session.add_all([rating1, rating2, rating3, rating4])
    session.commit()
    
    # Filter for trips with min_rating >= 4.0
    response = client.get(f"{settings.API_V1_STR}/public-trips?min_rating=4.0")
    assert response.status_code == 200
    trips = response.json()
    trip_names = [t["name_en"] for t in trips]
    assert "Highly Rated Trip" in trip_names
    assert "Poorly Rated Trip" not in trip_names


def test_combined_filters_with_provider_and_rating(client: TestClient, session: Session) -> None:
    """Test combining provider name and rating filters"""
    # Create provider with specific name
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    user.provider.company_name = "Premium Adventures"
    session.add(user.provider)
    session.commit()
    
    # Create trip
    trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Premium Desert Tour",
        description_en="High quality desert experience",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=15),
            max_participants=20
        ),
        provider=user.provider
    )
    
    # Create package
    package = TripPackage(
        trip_id=trip.id,
        name_en="Deluxe",
        description_en="Premium",
        price=500.0,
        is_active=True)
    session.add(package)
    session.commit()
    
    # Add ratings
    from app.models.user import User as UserModel
    from app.models.links import TripRating
    
    rater = UserModel(
        email="rater@example.com",
        name="Rater",
        phone="9876543210",
        hashed_password="hashed",
        source="mobile_app"
    )
    session.add(rater)
    session.commit()
    
    rating = TripRating(user_id=rater.id, trip_id=trip.id, rating=5, comment="Amazing!")
    session.add(rating)
    session.commit()
    
    # Filter by provider name AND rating
    response = client.get(
        f"{settings.API_V1_STR}/public-trips?provider_name=Premium&min_rating=4.5&min_price=300&max_price=500"
    )
    assert response.status_code == 200
    trips = response.json()
    assert len(trips) >= 1
    assert any(t["name_en"] == "Premium Desert Tour" for t in trips)


def test_upload_trip_images(client: TestClient, session: Session) -> None:
    """Test uploading images to a trip"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create a trip
    trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Test Trip for Images",
        description_en="Testing image upload",
        start_date=datetime.datetime.utcnow(),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
            max_participants=10
        ),
        provider=user.provider
    )
    
    # Mock the storage service
    with patch('app.services.storage.storage_service') as mock_storage:
        mock_storage.upload_file = AsyncMock(return_value={
            "downloadUrl": "https://example.com/image1.jpg",
            "fileId": "test-file-id"
        })
        
        # Create fake image files
        image1 = BytesIO(b"fake image content 1")
        image2 = BytesIO(b"fake image content 2")
        
        files = [
            ("files", ("test1.jpg", image1, "image/jpeg")),
            ("files", ("test2.jpg", image2, "image/jpeg"))
        ]
        
        response = client.post(
            f"{settings.API_V1_STR}/trips/{trip.id}/upload-images",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200
        content = response.json()
        assert "uploaded_urls" in content
        assert content["total_images"] == 2
        
        # Verify images were saved to database
        session.refresh(trip)
        assert trip.images is not None
        assert len(trip.images) == 2


def test_upload_trip_images_invalid_file_type(client: TestClient, session: Session) -> None:
    """Test uploading invalid file type to a trip"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create a trip
    trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Test Trip for Invalid Images",
        description_en="Testing invalid image upload",
        start_date=datetime.datetime.utcnow(),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
            max_participants=10
        ),
        provider=user.provider
    )
    
    # Create fake PDF file
    pdf_file = BytesIO(b"fake pdf content")
    files = [("files", ("test.pdf", pdf_file, "application/pdf"))]
    
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/upload-images",
        headers=headers,
        files=files
    )
    
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]


def test_upload_trip_images_file_too_large(client: TestClient, session: Session) -> None:
    """Test uploading file that exceeds size limit"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create a trip
    trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Test Trip for Large Images",
        description_en="Testing large image upload",
        start_date=datetime.datetime.utcnow(),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
            max_participants=10
        ),
        provider=user.provider
    )
    
    # Create fake large file (6MB)
    large_file = BytesIO(b"x" * (6 * 1024 * 1024))
    files = [("files", ("large.jpg", large_file, "image/jpeg"))]
    
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/upload-images",
        headers=headers,
        files=files
    )
    
    assert response.status_code == 400
    assert "too large" in response.json()["detail"]


def test_delete_trip_image(client: TestClient, session: Session) -> None:
    """Test deleting an image from a trip"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create a trip with images
    trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Test Trip for Image Deletion",
        description_en="Testing image deletion",
        start_date=datetime.datetime.utcnow(),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
            max_participants=10
        ),
        provider=user.provider
    )
    
    # Add images to trip
    trip.images = [
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg",
        "https://example.com/image3.jpg"
    ]
    session.add(trip)
    session.commit()
    
    # Delete one image
    response = client.delete(
        f"{settings.API_V1_STR}/trips/{trip.id}/images",
        headers=headers,
        params={"image_url": "https://example.com/image2.jpg"}
    )
    
    assert response.status_code == 200
    content = response.json()
    assert content["remaining_images"] == 2
    
    # Verify image was removed from database
    session.refresh(trip)
    assert len(trip.images) == 2
    assert "https://example.com/image2.jpg" not in trip.images
    assert "https://example.com/image1.jpg" in trip.images
    assert "https://example.com/image3.jpg" in trip.images


def test_delete_trip_image_not_found(client: TestClient, session: Session) -> None:
    """Test deleting a non-existent image from a trip"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create a trip with images
    trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Test Trip for Missing Image",
        description_en="Testing missing image deletion",
        start_date=datetime.datetime.utcnow(),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
            max_participants=10
        ),
        provider=user.provider
    )
    
    trip.images = ["https://example.com/image1.jpg"]
    session.add(trip)
    session.commit()
    
    # Try to delete non-existent image
    response = client.delete(
        f"{settings.API_V1_STR}/trips/{trip.id}/images",
        headers=headers,
        params={"image_url": "https://example.com/nonexistent.jpg"}
    )
    
    assert response.status_code == 404
    assert "Image not found" in response.json()["detail"]


def test_upload_trip_images_unauthorized(client: TestClient, session: Session) -> None:
    """Test that users cannot upload images to trips they don't own"""
    # Create first provider and trip
    user1, headers1 = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="User1's Trip",
        description_en="Testing unauthorized access",
        start_date=datetime.datetime.utcnow(),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
            max_participants=10
        ),
        provider=user1.provider
    )
    
    # Create second provider (will automatically create a new provider)
    user2, headers2 = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Try to upload images to user1's trip as user2
    image = BytesIO(b"fake image content")
    files = [("files", ("test.jpg", image, "image/jpeg"))]
    
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/upload-images",
        headers=headers2,
        files=files
    )
    
    assert response.status_code == 403
    assert "Not authorized" in response.json()["detail"]


def test_trip_read_includes_images(client: TestClient, session: Session) -> None:
    """Test that reading a trip includes the images field"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create trip with images
    trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
        name_en="Trip with Images",
        description_en="Testing image field in response",
        start_date=datetime.datetime.utcnow(),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
            max_participants=10
        ),
        provider=user.provider
    )
    
    trip.images = ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
    session.add(trip)
    session.commit()
    
    # Create package (required)
    package = TripPackage(
        trip_id=trip.id,
        name_en="Standard",
        description_en="Basic",
        price=100.0,
        is_active=True)
    session.add(package)
    session.commit()
    
    # Read trip
    response = client.get(f"{settings.API_V1_STR}/trips/{trip.id}", headers=headers)
    assert response.status_code == 200
    content = response.json()
    assert "images" in content
    assert len(content["images"]) == 2
    assert "https://example.com/image1.jpg" in content["images"]


# ──────────────────────────────────────────────────────────────────────────────
# Tests for registration guards (inactive trip, past trip, full trip)
# ──────────────────────────────────────────────────────────────────────────────

def _make_package(session, trip_id):
    """Helper: create a minimal active package for a trip."""
    from app.models.trip_package import TripPackage as TripPackageModel
    pkg = TripPackageModel(
        trip_id=trip_id,
        name_en="Standard",
        description_en="Basic",
        price=100.0,
        is_active=True,
    )
    session.add(pkg)
    session.commit()
    session.refresh(pkg)
    return pkg


def test_register_for_inactive_trip_is_blocked(client: TestClient, session: Session) -> None:
    """Registration must be rejected when the trip is inactive."""
    provider_user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Inactive Trip",
        description_en="desc",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10,
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    trip.is_active = False
    session.add(trip)
    session.commit()

    _make_package(session, trip.id)
    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)

    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=mobile_headers,
        json={"total_participants": 1, "total_amount": 100.0, "participants": [{"name": "Alice"}]},
    )
    assert response.status_code == 400
    assert "no longer available" in response.json()["detail"].lower()


def test_register_for_past_trip_is_blocked(client: TestClient, session: Session) -> None:
    """Registration must be rejected when the trip start date is in the past."""
    provider_user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Past Trip",
        description_en="desc",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10,
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    # Manually backdate the trip
    trip.start_date = datetime.datetime.utcnow() - datetime.timedelta(days=1)
    session.add(trip)
    session.commit()

    _make_package(session, trip.id)
    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)

    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=mobile_headers,
        json={"total_participants": 1, "total_amount": 100.0, "participants": [{"name": "Alice"}]},
    )
    assert response.status_code == 400
    assert "started or passed" in response.json()["detail"].lower()


@patch("app.services.email.email_service.send_booking_confirmation_email")
def test_register_for_full_trip_is_blocked(mock_email, client: TestClient, session: Session) -> None:
    """Registration must be rejected when the trip is at capacity."""
    provider_user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Full Trip",
        description_en="desc",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=1,
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    _make_package(session, trip.id)

    # First user fills the single spot
    user1, headers1 = user_authentication_headers(client, session, role=UserRole.NORMAL)
    r1 = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=headers1,
        json={"total_participants": 1, "total_amount": 100.0, "participants": [{"name": "Alice"}]},
    )
    assert r1.status_code == 200

    # Second user should be blocked
    user2, headers2 = user_authentication_headers(client, session, role=UserRole.NORMAL)
    r2 = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=headers2,
        json={"total_participants": 1, "total_amount": 100.0, "participants": [{"name": "Bob"}]},
    )
    assert r2.status_code == 400
    assert "spot" in r2.json()["detail"].lower()


@patch("app.services.email.email_service.send_booking_confirmation_email")
def test_register_respects_pending_payment_in_capacity_count(mock_email, client: TestClient, session: Session) -> None:
    """pending_payment registrations must count toward capacity, not just confirmed ones."""
    provider_user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Capacity Test Trip",
        description_en="desc",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=2,
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    _make_package(session, trip.id)

    # Fill both spots with pending_payment registrations
    for _ in range(2):
        u, h = user_authentication_headers(client, session, role=UserRole.NORMAL)
        client.post(
            f"{settings.API_V1_STR}/trips/{trip.id}/register",
            headers=h,
            json={"total_participants": 1, "total_amount": 100.0, "participants": [{"name": "X"}]},
        )

    # Third registration must be blocked even though none are confirmed
    u3, h3 = user_authentication_headers(client, session, role=UserRole.NORMAL)
    r = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=h3,
        json={"total_participants": 1, "total_amount": 100.0, "participants": [{"name": "Y"}]},
    )
    assert r.status_code == 400
    assert "spot" in r.json()["detail"].lower()


# ──────────────────────────────────────────────────────────────────────────────
# Tests for pending_payment status and spot_reserved_until on registration
# ──────────────────────────────────────────────────────────────────────────────

@patch("app.services.email.email_service.send_booking_confirmation_email")
def test_registration_creates_pending_payment_status(mock_email, client: TestClient, session: Session) -> None:
    """New registrations must have status=pending_payment, not pending or confirmed."""
    provider_user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Payment Status Trip",
        description_en="desc",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10,
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    _make_package(session, trip.id)

    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=mobile_headers,
        json={"total_participants": 1, "total_amount": 100.0, "participants": [{"name": "Alice"}]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "pending_payment"


@patch("app.services.email.email_service.send_booking_confirmation_email")
@freeze_time("2025-06-01 10:00:00")
def test_registration_sets_spot_reserved_until(mock_email, client: TestClient, session: Session) -> None:
    """spot_reserved_until must be exactly 15 minutes from the frozen registration time."""
    provider_user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Spot Reservation Trip",
        description_en="desc",
        start_date=datetime.datetime(2025, 7, 1),
        end_date=datetime.datetime(2025, 7, 2),
        max_participants=10,
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    _make_package(session, trip.id)

    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=mobile_headers,
        json={"total_participants": 1, "total_amount": 100.0, "participants": [{"name": "Alice"}]},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["spot_reserved_until"] is not None

    reserved_until = datetime.datetime.fromisoformat(data["spot_reserved_until"].replace("Z", ""))
    # Frozen at 10:00:00 — must be exactly 10:15:00
    expected = datetime.datetime(2025, 6, 1, 10, 15, 0)
    assert reserved_until == expected


# ──────────────────────────────────────────────────────────────────────────────
# Tests for GET /trips/registrations/{registration_id}
# ──────────────────────────────────────────────────────────────────────────────

@patch("app.services.email.email_service.send_booking_confirmation_email")
def test_get_my_registration_by_id(mock_email, client: TestClient, session: Session) -> None:
    """User can fetch their own registration by ID."""
    provider_user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Get Registration Trip",
        description_en="desc",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10,
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    _make_package(session, trip.id)

    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    reg_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=mobile_headers,
        json={"total_participants": 1, "total_amount": 100.0, "participants": [{"name": "Alice"}]},
    )
    assert reg_response.status_code == 200
    registration_id = reg_response.json()["id"]

    # Fetch by ID
    get_response = client.get(
        f"{settings.API_V1_STR}/trips/registrations/{registration_id}",
        headers=mobile_headers,
    )
    assert get_response.status_code == 200
    data = get_response.json()
    assert data["id"] == registration_id
    assert data["status"] == "pending_payment"
    assert data["total_participants"] == 1


@patch("app.services.email.email_service.send_booking_confirmation_email")
def test_get_registration_by_id_returns_404_for_unknown(mock_email, client: TestClient, session: Session) -> None:
    """Fetching a non-existent registration ID returns 404."""
    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    fake_id = str(uuid.uuid4())
    response = client.get(
        f"{settings.API_V1_STR}/trips/registrations/{fake_id}",
        headers=mobile_headers,
    )
    assert response.status_code == 404


@patch("app.services.email.email_service.send_booking_confirmation_email")
def test_get_registration_by_id_forbidden_for_other_user(mock_email, client: TestClient, session: Session) -> None:
    """A user must not be able to fetch another user's registration."""
    provider_user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Forbidden Registration Trip",
        description_en="desc",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10,
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    _make_package(session, trip.id)

    owner, owner_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    reg_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/register",
        headers=owner_headers,
        json={"total_participants": 1, "total_amount": 100.0, "participants": [{"name": "Alice"}]},
    )
    registration_id = reg_response.json()["id"]

    # Different user tries to access it
    other_user, other_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    response = client.get(
        f"{settings.API_V1_STR}/trips/registrations/{registration_id}",
        headers=other_headers,
    )
    assert response.status_code == 403


# ──────────────────────────────────────────────────────────────────────────────
# Tests for registration_deadline, starting_city, is_international, destinations
# ──────────────────────────────────────────────────────────────────────────────

def _make_destination(session, type_="country", country_code="SA", slug="saudi-arabia",
                      name_en="Saudi Arabia", name_ar="السعودية", parent_id=None):
    """Helper: create a Destination row directly."""
    from app.models.destination import Destination, DestinationType
    dest = Destination(
        type=DestinationType.COUNTRY if type_ == "country" else DestinationType.CITY,
        country_code=country_code,
        slug=slug,
        full_slug=slug,
        name_en=name_en,
        name_ar=name_ar,
        timezone="Asia/Riyadh",
        currency_code="SAR",
        is_active=True,
        display_order=0,
        parent_id=parent_id,
    )
    session.add(dest)
    session.commit()
    session.refresh(dest)
    return dest


def _make_trip_destination(session, trip_id, destination_id):
    """Helper: link a destination to a trip."""
    from app.models.trip_destination import TripDestination
    td = TripDestination(trip_id=trip_id, destination_id=destination_id)
    session.add(td)
    session.commit()
    session.refresh(td)
    return td


def test_registration_deadline_must_be_before_start_date(client: TestClient, session: Session) -> None:
    """Creating a trip with registration_deadline after start_date must fail."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    start = datetime.datetime.utcnow() + datetime.timedelta(days=10)
    deadline_after = start + datetime.timedelta(days=1)
    data = {
        "name_en": "Bad Deadline Trip",
        "description_en": "desc",
        "start_date": start.isoformat(),
        "end_date": (start + datetime.timedelta(days=5)).isoformat(),
        "max_participants": 10,
        "registration_deadline": deadline_after.isoformat(),
    }
    response = client.post(f"{settings.API_V1_STR}/trips", headers=headers, json=data)
    assert response.status_code == 422


def test_registration_deadline_on_start_date_is_valid(client: TestClient, session: Session) -> None:
    """registration_deadline equal to start_date must be accepted."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    start = datetime.datetime.utcnow() + datetime.timedelta(days=10)
    data = {
        "name_en": "Same Day Deadline Trip",
        "description_en": "desc",
        "start_date": start.isoformat(),
        "end_date": (start + datetime.timedelta(days=5)).isoformat(),
        "max_participants": 10,
        "registration_deadline": start.isoformat(),
    }
    response = client.post(f"{settings.API_V1_STR}/trips", headers=headers, json=data)
    assert response.status_code == 200
    assert response.json()["registration_deadline"] is not None


def test_trip_read_includes_registration_deadline(client: TestClient, session: Session) -> None:
    """GET /trips/{id} must return registration_deadline in the response."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    start = datetime.datetime.utcnow() + datetime.timedelta(days=10)
    deadline = start - datetime.timedelta(days=2)
    trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Deadline Trip",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
            registration_deadline=deadline,
        ),
        provider=user.provider,
    )
    _make_package(session, trip.id)
    response = client.get(f"{settings.API_V1_STR}/trips/{trip.id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "registration_deadline" in data
    assert data["registration_deadline"] is not None


def test_trip_read_includes_is_international_and_starting_city(client: TestClient, session: Session) -> None:
    """GET /trips/{id} must return is_international and starting_city fields."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    country = _make_destination(session)
    city = _make_destination(
        session, type_="city", country_code="SA", slug="riyadh",
        name_en="Riyadh", name_ar="الرياض", parent_id=country.id,
    )
    start = datetime.datetime.utcnow() + datetime.timedelta(days=10)
    trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="City Trip",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
            starting_city_id=city.id,
        ),
        provider=user.provider,
    )
    _make_package(session, trip.id)
    response = client.get(f"{settings.API_V1_STR}/trips/{trip.id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "is_international" in data
    assert data["is_international"] is False
    assert "starting_city_id" in data
    assert data["starting_city_id"] == str(city.id)


def test_public_trip_response_includes_destinations(client: TestClient, session: Session) -> None:
    """GET /public-trips/{id} must return a destinations list."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    country = _make_destination(session, slug="sa-dest-pub", name_en="Saudi Arabia Pub")
    city = _make_destination(
        session, type_="city", country_code="SA", slug="jeddah-pub",
        name_en="Jeddah", name_ar="جدة", parent_id=country.id,
    )
    start = datetime.datetime.utcnow() + datetime.timedelta(days=10)
    trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Destinations Response Trip",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
        ),
        provider=user.provider,
    )
    trip.is_active = True
    session.add(trip)
    _make_trip_destination(session, trip.id, city.id)

    response = client.get(f"{settings.API_V1_STR}/public-trips/{trip.id}")
    assert response.status_code == 200
    data = response.json()
    assert "destinations" in data
    assert len(data["destinations"]) == 1
    assert data["destinations"][0]["name_en"] == "Jeddah"


def test_public_feed_excludes_past_trips(client: TestClient, session: Session) -> None:
    """GET /public-trips must not return trips whose start_date is in the past."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    start = datetime.datetime.utcnow() + datetime.timedelta(days=10)
    future_trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Future Only Trip",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
        ),
        provider=user.provider,
    )
    future_trip.is_active = True
    session.add(future_trip)

    past_trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Past Only Trip",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
        ),
        provider=user.provider,
    )
    past_trip.is_active = True
    past_trip.start_date = datetime.datetime.utcnow() - datetime.timedelta(days=1)
    session.add(past_trip)
    session.commit()

    response = client.get(f"{settings.API_V1_STR}/public-trips?search=Only+Trip")
    assert response.status_code == 200
    names = [t["name_en"] for t in response.json()]
    assert "Future Only Trip" in names
    assert "Past Only Trip" not in names


def test_public_feed_excludes_trips_with_expired_deadline(client: TestClient, session: Session) -> None:
    """GET /public-trips must exclude trips whose registration_deadline has passed."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    start = datetime.datetime.utcnow() + datetime.timedelta(days=10)

    open_trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Open Deadline Trip",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
            registration_deadline=start - datetime.timedelta(days=1),  # future deadline
        ),
        provider=user.provider,
    )
    open_trip.is_active = True
    session.add(open_trip)

    closed_trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Closed Deadline Trip",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
            registration_deadline=start - datetime.timedelta(days=1),
        ),
        provider=user.provider,
    )
    closed_trip.is_active = True
    # Backdate the deadline to the past
    closed_trip.registration_deadline = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    session.add(closed_trip)
    session.commit()

    response = client.get(f"{settings.API_V1_STR}/public-trips?search=Deadline+Trip")
    assert response.status_code == 200
    names = [t["name_en"] for t in response.json()]
    assert "Open Deadline Trip" in names
    assert "Closed Deadline Trip" not in names


def test_filter_public_trips_by_destination_ids_or_logic(client: TestClient, session: Session) -> None:
    """destination_ids filter uses OR: trips with ANY of the given destinations are returned."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)

    country = _make_destination(session, slug="sa-or-filter", name_en="Saudi Arabia OR")
    jeddah = _make_destination(
        session, type_="city", country_code="SA", slug="jeddah-or",
        name_en="Jeddah OR", name_ar="جدة", parent_id=country.id,
    )
    makkah = _make_destination(
        session, type_="city", country_code="SA", slug="makkah-or",
        name_en="Makkah OR", name_ar="مكة", parent_id=country.id,
    )
    riyadh = _make_destination(
        session, type_="city", country_code="SA", slug="riyadh-or",
        name_en="Riyadh OR", name_ar="الرياض", parent_id=country.id,
    )

    start = datetime.datetime.utcnow() + datetime.timedelta(days=10)

    # Trip A: goes to Jeddah
    trip_a = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Jeddah Trip OR",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
        ),
        provider=user.provider,
    )
    trip_a.is_active = True
    session.add(trip_a)
    _make_trip_destination(session, trip_a.id, jeddah.id)

    # Trip B: goes to Makkah
    trip_b = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Makkah Trip OR",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
        ),
        provider=user.provider,
    )
    trip_b.is_active = True
    session.add(trip_b)
    _make_trip_destination(session, trip_b.id, makkah.id)

    # Trip C: goes to Riyadh only (should NOT match)
    trip_c = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Riyadh Trip OR",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
        ),
        provider=user.provider,
    )
    trip_c.is_active = True
    session.add(trip_c)
    _make_trip_destination(session, trip_c.id, riyadh.id)
    session.commit()

    # Filter for Jeddah OR Makkah
    response = client.get(
        f"{settings.API_V1_STR}/public-trips"
        f"?destination_ids={jeddah.id}&destination_ids={makkah.id}"
        f"&search=Trip+OR"
    )
    assert response.status_code == 200
    names = [t["name_en"] for t in response.json()]
    assert "Jeddah Trip OR" in names
    assert "Makkah Trip OR" in names
    assert "Riyadh Trip OR" not in names


def test_filter_public_trips_single_destination(client: TestClient, session: Session) -> None:
    """single_destination=true returns only trips with exactly one destination."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)

    country = _make_destination(session, slug="sa-single", name_en="Saudi Arabia Single")
    city1 = _make_destination(
        session, type_="city", country_code="SA", slug="city1-single",
        name_en="City1 Single", name_ar="مدينة1", parent_id=country.id,
    )
    city2 = _make_destination(
        session, type_="city", country_code="SA", slug="city2-single",
        name_en="City2 Single", name_ar="مدينة2", parent_id=country.id,
    )

    start = datetime.datetime.utcnow() + datetime.timedelta(days=10)

    # Single-destination trip
    trip_single = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Single Dest Trip",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
        ),
        provider=user.provider,
    )
    trip_single.is_active = True
    session.add(trip_single)
    _make_trip_destination(session, trip_single.id, city1.id)

    # Multi-destination trip
    trip_multi = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Multi Dest Trip",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
        ),
        provider=user.provider,
    )
    trip_multi.is_active = True
    session.add(trip_multi)
    _make_trip_destination(session, trip_multi.id, city1.id)
    _make_trip_destination(session, trip_multi.id, city2.id)
    session.commit()

    # Filter single_destination=true
    response = client.get(
        f"{settings.API_V1_STR}/public-trips?single_destination=true&search=Dest+Trip"
    )
    assert response.status_code == 200
    names = [t["name_en"] for t in response.json()]
    assert "Single Dest Trip" in names
    assert "Multi Dest Trip" not in names

    # Filter single_destination=false (multiple)
    response2 = client.get(
        f"{settings.API_V1_STR}/public-trips?single_destination=false&search=Dest+Trip"
    )
    assert response2.status_code == 200
    names2 = [t["name_en"] for t in response2.json()]
    assert "Multi Dest Trip" in names2
    assert "Single Dest Trip" not in names2


def test_filter_public_trips_by_is_international(client: TestClient, session: Session) -> None:
    """is_international filter correctly separates domestic and international trips."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)

    start = datetime.datetime.utcnow() + datetime.timedelta(days=10)

    domestic_trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Domestic Intl Trip",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
        ),
        provider=user.provider,
    )
    domestic_trip.is_active = True
    domestic_trip.is_international = False
    session.add(domestic_trip)

    international_trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="International Intl Trip",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
        ),
        provider=user.provider,
    )
    international_trip.is_active = True
    international_trip.is_international = True
    session.add(international_trip)
    session.commit()

    # Filter domestic
    r_domestic = client.get(
        f"{settings.API_V1_STR}/public-trips?is_international=false&search=Intl+Trip"
    )
    assert r_domestic.status_code == 200
    names_d = [t["name_en"] for t in r_domestic.json()]
    assert "Domestic Intl Trip" in names_d
    assert "International Intl Trip" not in names_d

    # Filter international
    r_intl = client.get(
        f"{settings.API_V1_STR}/public-trips?is_international=true&search=Intl+Trip"
    )
    assert r_intl.status_code == 200
    names_i = [t["name_en"] for t in r_intl.json()]
    assert "International Intl Trip" in names_i
    assert "Domestic Intl Trip" not in names_i


def test_public_feed_ordered_newest_first(client: TestClient, session: Session) -> None:
    """GET /public-trips must return trips ordered by created_at descending."""
    user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    start = datetime.datetime.utcnow() + datetime.timedelta(days=10)

    trip_old = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Oldest Ordering Trip",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
        ),
        provider=user.provider,
    )
    trip_old.is_active = True
    trip_old.created_at = datetime.datetime.utcnow() - datetime.timedelta(hours=2)
    session.add(trip_old)

    trip_new = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Newest Ordering Trip",
            description_en="desc",
            start_date=start,
            end_date=start + datetime.timedelta(days=5),
            max_participants=10,
        ),
        provider=user.provider,
    )
    trip_new.is_active = True
    trip_new.created_at = datetime.datetime.utcnow()
    session.add(trip_new)
    session.commit()

    response = client.get(f"{settings.API_V1_STR}/public-trips?search=Ordering+Trip")
    assert response.status_code == 200
    trips = response.json()
    names = [t["name_en"] for t in trips]
    assert "Newest Ordering Trip" in names
    assert "Oldest Ordering Trip" in names
    # Newest must appear before oldest
    assert names.index("Newest Ordering Trip") < names.index("Oldest Ordering Trip")
