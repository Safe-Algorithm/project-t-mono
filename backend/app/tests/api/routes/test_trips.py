from fastapi.testclient import TestClient
from sqlmodel import Session
from app.core.config import settings
from app.models.user import UserRole
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
    
    # Create a package for the trip (required for trip to be readable)
    package_data = {
        "name": "Standard Package",
        "description": "Basic trip package",
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
    assert content["name"] == trip.name
    assert len(content["packages"]) == 1
    assert content["packages"][0]["name"] == "Standard Package"


def test_read_trip_without_packages_fails(client: TestClient, session: Session) -> None:
    """Test that reading a trip without packages returns 400 error"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip Without Packages",
        description="A trip without packages should fail",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="No Package Location",
        price=200.0,
        max_participants=5
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Try to read trip without packages - should fail
    response = client.get(f"{settings.API_V1_STR}/trips/{trip.id}", headers=headers)
    assert response.status_code == 400
    content = response.json()
    assert "must have at least one package" in content["detail"]


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


# Tests for Trip Required Fields
def test_set_trip_required_fields(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Required Fields",
        description="A trip to test required fields",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Set required fields
    field_types = ["name", "phone", "email"]
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/required-fields",
        headers=headers,
        json=field_types
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Required fields updated successfully"


def test_get_trip_required_fields(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Getting Required Fields",
        description="A trip to test getting required fields",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Set required fields first
    field_types = ["name", "phone"]
    client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/required-fields",
        headers=headers,
        json=field_types
    )
    
    # Get required fields
    response = client.get(
        f"{settings.API_V1_STR}/trips/{trip.id}/required-fields",
        headers=headers
    )
    assert response.status_code == 200
    response_data = response.json()
    fields = response_data["required_fields"]
    assert len(fields) == 2
    field_types_returned = [field["field_type"] for field in fields]
    assert "name" in field_types_returned
    assert "phone" in field_types_returned


# Tests for Trip Packages
def test_create_trip_package(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Package",
        description="A trip to test packages",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    package_data = {
        "name": "Standard Package",
        "description": "Basic package with accommodation",
        "price": 150.0
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data
    )
    assert response.status_code == 200
    package = response.json()
    assert package["name"] == package_data["name"]
    assert float(package["price"]) == package_data["price"]


def test_get_trip_packages(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Getting Packages",
        description="A trip to test getting packages",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create a package first
    package_data = {
        "name": "Premium Package",
        "description": "Premium package with extras",
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
    assert packages[0]["name"] == package_data["name"]


def test_update_trip_package(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Package Update",
        description="A trip to test package updates",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create a package first
    package_data = {
        "name": "Basic Package",
        "description": "Basic package",
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
        "name": "Updated Basic Package",
        "price": 120.0
    }
    response = client.put(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages/{package_id}",
        headers=headers,
        json=update_data
    )
    assert response.status_code == 200
    updated_package = response.json()
    assert updated_package["name"] == update_data["name"]
    assert float(updated_package["price"]) == update_data["price"]


# Tests for Trip Registration
def test_register_for_trip_single_participant(client: TestClient, session: Session) -> None:
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Registration",
        description="A trip to test registration",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create a package for the trip
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.schemas.trip_package import TripPackageCreate
    package_in = TripPackageCreate(
        name="Standard Package",
        price=100.0,
        description="Standard trip package",
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


def test_register_for_trip_multiple_participants(client: TestClient, session: Session) -> None:
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Multi Registration",
        description="A trip to test multi-participant registration",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create a package for the trip
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.schemas.trip_package import TripPackageCreate
    package_in = TripPackageCreate(
        name="Standard Package",
        price=100.0,
        description="Standard trip package",
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
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Required Fields Validation",
        description="A trip to test required fields validation",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create mobile app user for registration
    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    # Create a package with required fields
    package_data = {
        "name": "Standard Package",
        "price": 100.0,
        "description": "Standard trip package",
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
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Package with Required Fields",
        description="A trip to test packages with required fields",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    package_data = {
        "name": "Adult Package",
        "description": "Package for adults with phone requirement",
        "price": 150.0,
        "required_fields": ["name", "phone", "email"]
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data
    )
    assert response.status_code == 200
    package = response.json()
    assert package["name"] == package_data["name"]
    assert set(package["required_fields"]) == set(package_data["required_fields"])


def test_update_trip_package_required_fields(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Package Update with Required Fields",
        description="A trip to test package required fields updates",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create a package with initial required fields
    package_data = {
        "name": "Basic Package",
        "description": "Basic package",
        "price": 100.0,
        "required_fields": ["name", "phone"]
    }
    create_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data
    )
    package_id = create_response.json()["id"]
    
    # Update the package with different required fields
    update_data = {
        "name": "Updated Basic Package",
        "required_fields": ["name", "phone", "email", "date_of_birth"]
    }
    response = client.put(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages/{package_id}",
        headers=headers,
        json=update_data
    )
    assert response.status_code == 200
    updated_package = response.json()
    assert updated_package["name"] == update_data["name"]
    assert set(updated_package["required_fields"]) == set(update_data["required_fields"])


def test_set_package_required_fields(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Package Required Fields",
        description="A trip to test setting package required fields",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create a package first
    package_data = {
        "name": "Test Package",
        "description": "Test package",
        "price": 100.0
    }
    create_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data
    )
    package_id = create_response.json()["id"]
    
    # Set required fields for the package
    field_types = ["name", "phone", "email"]
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages/{package_id}/required-fields",
        headers=headers,
        json=field_types
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Required fields updated successfully"


def test_get_package_required_fields(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Getting Package Required Fields",
        description="A trip to test getting package required fields",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)
    
    # Create a package first
    package_data = {
        "name": "Test Package",
        "description": "Test package",
        "price": 100.0
    }
    create_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=headers,
        json=package_data
    )
    package_id = create_response.json()["id"]
    
    # Set required fields first
    field_types = ["name", "phone"]
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
    assert len(fields) == 2
    field_types_returned = [field["field_type"] for field in fields]
    assert "name" in field_types_returned
    assert "phone" in field_types_returned


def test_register_for_trip_with_package_specific_required_fields(client: TestClient, session: Session) -> None:
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Package-Specific Required Fields",
        description="A trip to test package-specific required fields validation",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create two packages with different required fields
    adult_package_data = {
        "name": "Adult Package",
        "description": "Package for adults",
        "price": 150.0,
        "required_fields": ["name", "phone", "email", "id_iqama_number"]
    }
    adult_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=provider_headers,
        json=adult_package_data
    )
    adult_package_id = adult_response.json()["id"]
    
    child_package_data = {
        "name": "Child Package",
        "description": "Package for children",
        "price": 100.0,
        "required_fields": ["name", "date_of_birth"]  # Children don't need phone/email
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
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Missing Package Required Fields",
        description="A trip to test missing package required fields validation",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create package with required fields
    package_data = {
        "name": "Strict Package",
        "description": "Package with strict requirements",
        "price": 150.0,
        "required_fields": ["name", "phone", "email"]
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
                "name": "John Doe"
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


def test_get_trip_registrations(client: TestClient, session: Session) -> None:
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    trip_in = TripCreate(
        name="Test Trip for Getting Registrations",
        description="A trip to test getting registrations",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        location="Test Location",
        price=100.0,
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
    """Test getting available field types with metadata for package creation."""
    # Create a provider user for authentication
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_PROVIDER)
    
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
