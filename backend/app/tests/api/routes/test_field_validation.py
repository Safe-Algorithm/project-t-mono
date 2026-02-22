import datetime
from typing import Dict, Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models.field_validation import (
    ValidationType, 
    FieldValidator, 
    validate_field_value, 
    validate_validation_config,
    get_available_validations_for_field
)
from app.models.trip_field import TripFieldType
from app.models.user import UserRole
from app.schemas.trip import TripCreate
from app.tests.utils.user import user_authentication_headers
import app.crud as crud


def test_validate_min_age_success():
    """Test successful minimum age validation"""
    config = {"min_value": 18}
    # Person born in 2000 should be over 18
    errors = validate_field_value(TripFieldType.DATE_OF_BIRTH, "2000-01-01", {"min_age": config})
    assert len(errors) == 0


def test_validate_min_age_failure():
    """Test failed minimum age validation"""
    config = {"min_value": 18}
    # Person born in 2010 should be under 18
    errors = validate_field_value(TripFieldType.DATE_OF_BIRTH, "2010-01-01", {"min_age": config})
    assert len(errors) == 1
    assert "Minimum Age validation failed" in errors[0]


def test_validate_max_age_success():
    """Test successful maximum age validation"""
    config = {"max_value": 65}
    # Person born in 1970 should be under 65
    errors = validate_field_value(TripFieldType.DATE_OF_BIRTH, "1970-01-01", {"max_age": config})
    assert len(errors) == 0


def test_validate_max_age_failure():
    """Test failed maximum age validation"""
    config = {"max_value": 65}
    # Person born in 1950 should be over 65
    errors = validate_field_value(TripFieldType.DATE_OF_BIRTH, "1950-01-01", {"max_age": config})
    assert len(errors) == 1
    assert "Maximum Age validation failed" in errors[0]


def test_validate_min_length_success():
    """Test successful minimum length validation"""
    config = {"min_length": 5}
    errors = validate_field_value(TripFieldType.NAME, "John Doe", {"min_length": config})
    assert len(errors) == 0


def test_validate_min_length_failure():
    """Test failed minimum length validation"""
    config = {"min_length": 10}
    errors = validate_field_value(TripFieldType.NAME, "John", {"min_length": config})
    assert len(errors) == 1
    assert "Minimum Length validation failed" in errors[0]


def test_validate_max_length_success():
    """Test successful maximum length validation"""
    config = {"max_length": 50}
    errors = validate_field_value(TripFieldType.NAME, "John Doe", {"max_length": config})
    assert len(errors) == 0


def test_validate_max_length_failure():
    """Test failed maximum length validation"""
    config = {"max_length": 5}
    errors = validate_field_value(TripFieldType.NAME, "John Doe Smith", {"max_length": config})
    assert len(errors) == 1
    assert "Maximum Length validation failed" in errors[0]


def test_validate_phone_country_codes_success():
    """Test successful phone country code validation"""
    config = {"allowed_codes": ["966", "971"]}
    errors = validate_field_value(TripFieldType.PHONE, "+966501234567", {"phone_country_codes": config})
    assert len(errors) == 0


def test_validate_phone_country_codes_failure():
    """Test failed phone country code validation"""
    config = {"allowed_codes": ["966"]}
    errors = validate_field_value(TripFieldType.PHONE, "+971501234567", {"phone_country_codes": config})
    assert len(errors) == 1
    assert "Allowed Country Codes validation failed" in errors[0]


def test_validate_phone_min_length_success():
    """Test successful phone minimum length validation"""
    config = {"min_length": 10}
    errors = validate_field_value(TripFieldType.PHONE, "+966501234567", {"phone_min_length": config})
    assert len(errors) == 0


def test_validate_phone_min_length_failure():
    """Test failed phone minimum length validation"""
    config = {"min_length": 15}
    errors = validate_field_value(TripFieldType.PHONE, "+966501234", {"phone_min_length": config})
    assert len(errors) == 1
    assert "Phone Minimum Length validation failed" in errors[0]


def test_validate_saudi_id_format_success():
    """Test successful Saudi ID format validation"""
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "1234567890", {"saudi_id_format": {}})
    assert len(errors) == 0


def test_validate_saudi_id_format_failure():
    """Test failed Saudi ID format validation"""
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "3234567890", {"saudi_id_format": {}})
    assert len(errors) == 1
    assert "Saudi ID Format validation failed" in errors[0]


def test_validate_iqama_format_success():
    """Test successful Iqama format validation"""
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "3234567890", {"iqama_format": {}})
    assert len(errors) == 0


def test_validate_iqama_format_failure():
    """Test failed Iqama format validation"""
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "1234567890", {"iqama_format": {}})
    assert len(errors) == 1
    assert "Iqama Format validation failed" in errors[0]


def test_validate_passport_format_success():
    """Test successful passport format validation"""
    errors = validate_field_value(TripFieldType.PASSPORT_NUMBER, "AB123456", {"passport_format": {}})
    assert len(errors) == 0


def test_validate_passport_format_failure():
    """Test failed passport format validation"""
    errors = validate_field_value(TripFieldType.PASSPORT_NUMBER, "123", {"passport_format": {}})
    assert len(errors) == 1
    assert "Passport Format validation failed" in errors[0]


def test_validate_gender_restrictions_success():
    """Test successful gender restrictions validation"""
    config = {"allowed_genders": ["male", "female"]}
    errors = validate_field_value(TripFieldType.GENDER, "male", {"gender_restrictions": config})
    assert len(errors) == 0


def test_validate_gender_restrictions_failure():
    """Test failed gender restrictions validation"""
    config = {"allowed_genders": ["male"]}
    errors = validate_field_value(TripFieldType.GENDER, "female", {"gender_restrictions": config})
    assert len(errors) == 1
    assert "Gender Restrictions validation failed" in errors[0]


def test_validate_regex_pattern_success():
    """Test successful regex pattern validation"""
    config = {"pattern": r"^[A-Z][a-z]+ [A-Z][a-z]+$"}  # First Last format
    errors = validate_field_value(TripFieldType.NAME, "John Doe", {"regex_pattern": config})
    assert len(errors) == 0


def test_validate_regex_pattern_failure():
    """Test failed regex pattern validation"""
    config = {"pattern": r"^[A-Z][a-z]+ [A-Z][a-z]+$"}  # First Last format
    errors = validate_field_value(TripFieldType.NAME, "john doe", {"regex_pattern": config})
    assert len(errors) == 1
    assert "Custom Pattern validation failed" in errors[0]


def test_validate_multiple_validations():
    """Test multiple validations on a single field"""
    validation_config = {
        "min_length": {"min_length": 5},
        "max_length": {"max_length": 20},
        "regex_pattern": {"pattern": r"^[A-Za-z ]+$"}  # Only letters and spaces
    }
    
    # Should pass all validations
    errors = validate_field_value(TripFieldType.NAME, "John Doe", validation_config)
    assert len(errors) == 0
    
    # Should fail min_length
    errors = validate_field_value(TripFieldType.NAME, "Jo", validation_config)
    assert len(errors) == 1
    assert "Minimum Length validation failed" in errors[0]
    
    # Should fail regex (contains numbers)
    errors = validate_field_value(TripFieldType.NAME, "John123", validation_config)
    assert len(errors) == 1
    assert "Custom Pattern validation failed" in errors[0]


def test_get_available_validations_for_field():
    """Test getting available validations for different field types"""
    # Phone field should have phone-specific validations
    phone_validations = get_available_validations_for_field(TripFieldType.PHONE)
    expected_phone_validations = ["phone_country_codes", "phone_min_length", "phone_max_length", "regex_pattern"]
    for validation in expected_phone_validations:
        assert validation in phone_validations
    
    # Date of birth should have age validations
    dob_validations = get_available_validations_for_field(TripFieldType.DATE_OF_BIRTH)
    expected_dob_validations = ["min_age", "max_age"]
    for validation in expected_dob_validations:
        assert validation in dob_validations
    
    # ID/Iqama should have format validations
    id_validations = get_available_validations_for_field(TripFieldType.ID_IQAMA_NUMBER)
    expected_id_validations = ["saudi_id_format", "iqama_format", "regex_pattern", "min_length", "max_length"]
    for validation in expected_id_validations:
        assert validation in id_validations


def test_validate_validation_config_success():
    """Test successful validation config validation"""
    # Valid config for phone field
    config = {"phone_country_codes": {"allowed_codes": ["966", "971"]}}
    errors = validate_validation_config(TripFieldType.PHONE, config)
    assert len(errors) == 0


def test_validate_validation_config_failure_unknown_validation():
    """Test validation config failure with unknown validation type"""
    config = {"unknown_validation": {"some_param": "value"}}
    errors = validate_validation_config(TripFieldType.PHONE, config)
    assert len(errors) == 1
    assert "Unknown validation type" in errors[0]


def test_validate_validation_config_failure_unavailable_for_field():
    """Test validation config failure with validation not available for field type"""
    config = {"min_age": {"min_value": 18}}  # Age validation not available for name field
    errors = validate_validation_config(TripFieldType.NAME, config)
    assert len(errors) == 1
    assert "not available for field type" in errors[0]


def test_validate_validation_config_failure_missing_required_param():
    """Test validation config failure with missing required parameter"""
    config = {"min_age": {}}  # Missing required min_value parameter
    errors = validate_validation_config(TripFieldType.DATE_OF_BIRTH, config)
    assert len(errors) == 1
    assert "Missing required parameter" in errors[0]


# API Endpoint Tests
def test_get_available_validations_api(client: TestClient, session: Session):
    """Test the API endpoint for getting available validations for a field type"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    response = client.get(
        f"{settings.API_V1_STR}/trips/validation/available/phone",
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["field_type"] == "phone"
    assert "available_validations" in data
    assert "phone_country_codes" in data["available_validations"]


def test_get_validation_metadata_api(client: TestClient, session: Session):
    """Test the API endpoint for getting validation metadata"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    response = client.get(
        f"{settings.API_V1_STR}/trips/validation/metadata",
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "validation_metadata" in data
    assert "min_age" in data["validation_metadata"]
    assert "phone_country_codes" in data["validation_metadata"]


def test_validate_config_api(client: TestClient, session: Session):
    """Test the API endpoint for validating validation configuration"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Test valid config
    valid_config = {
        "field_type": "phone",
        "validation_config": {
            "phone_country_codes": {"allowed_codes": ["966", "971"]}
        }
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/validation/validate-config",
        headers=headers,
        json=valid_config
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] == True
    assert len(data["errors"]) == 0
    
    # Test invalid config
    invalid_config = {
        "field_type": "phone",
        "validation_config": {
            "min_age": {"min_value": 18}  # Age validation not available for phone
        }
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/validation/validate-config",
        headers=headers,
        json=invalid_config
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] == False
    assert len(data["errors"]) > 0


def test_validate_value_api(client: TestClient, session: Session):
    """Test the API endpoint for validating field values"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Test valid value
    valid_data = {
        "field_type": "date_of_birth",
        "value": "2000-01-01",
        "validation_config": {
            "min_age": {"min_value": 18}
        }
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/validation/validate-value",
        headers=headers,
        json=valid_data
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] == True
    assert len(data["errors"]) == 0
    
    # Test invalid value
    invalid_data = {
        "field_type": "date_of_birth",
        "value": "2010-01-01",
        "validation_config": {
            "min_age": {"min_value": 18}
        }
    }
    response = client.post(
        f"{settings.API_V1_STR}/trips/validation/validate-value",
        headers=headers,
        json=invalid_data
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] == False
    assert len(data["errors"]) > 0


def test_validate_saudi_id_format():
    """Test Saudi ID format validation"""
    # Valid Saudi ID (starts with 1 or 2, 10 digits)
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "1234567890", {"saudi_id_format": {}})
    assert len(errors) == 0
    
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "2987654321", {"saudi_id_format": {}})
    assert len(errors) == 0
    
    # Invalid Saudi ID (starts with 3)
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "3234567890", {"saudi_id_format": {}})
    assert len(errors) == 1
    
    # Invalid Saudi ID (wrong length)
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "123456789", {"saudi_id_format": {}})
    assert len(errors) == 1


def test_validate_iqama_format():
    """Test Iqama format validation"""
    # Valid Iqama (starts with 3-9, 10 digits)
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "3234567890", {"iqama_format": {}})
    assert len(errors) == 0
    
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "9876543210", {"iqama_format": {}})
    assert len(errors) == 0
    
    # Invalid Iqama (starts with 1)
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "1234567890", {"iqama_format": {}})
    assert len(errors) == 1
    
    # Invalid Iqama (wrong length)
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "323456789", {"iqama_format": {}})
    assert len(errors) == 1


def test_validate_passport_format():
    """Test passport format validation"""
    # Valid passport (6-12 alphanumeric)
    errors = validate_field_value(TripFieldType.PASSPORT_NUMBER, "AB123456", {"passport_format": {}})
    assert len(errors) == 0
    
    errors = validate_field_value(TripFieldType.PASSPORT_NUMBER, "123456789ABC", {"passport_format": {}})
    assert len(errors) == 0
    
    # Invalid passport (too short)
    errors = validate_field_value(TripFieldType.PASSPORT_NUMBER, "AB123", {"passport_format": {}})
    assert len(errors) == 1
    
    # Invalid passport (contains special characters)
    errors = validate_field_value(TripFieldType.PASSPORT_NUMBER, "AB123-456", {"passport_format": {}})
    assert len(errors) == 1


def test_validate_gender_restrictions():
    """Test gender restrictions validation"""
    config = {"allowed_genders": ["male", "female"]}
    
    # Valid gender
    errors = validate_field_value(TripFieldType.GENDER, "male", {"gender_restrictions": config})
    assert len(errors) == 0
    
    # Invalid gender
    errors = validate_field_value(TripFieldType.GENDER, "other", {"gender_restrictions": config})
    assert len(errors) == 1
    assert "Gender Restrictions validation failed" in errors[0]


def test_complex_validation_scenario():
    """Test a complex validation scenario with multiple validations"""
    # Phone with multiple validations
    validation_config = {
        "phone_country_codes": {"allowed_codes": ["966", "971"]},
        "phone_min_length": {"min_length": 12},
        "phone_max_length": {"max_length": 15}
    }
    
    # Valid phone that passes all validations
    errors = validate_field_value(TripFieldType.PHONE, "+966501234567", validation_config)
    assert len(errors) == 0
    
    # Phone that fails country code validation
    errors = validate_field_value(TripFieldType.PHONE, "+1234567890123", validation_config)
    assert len(errors) == 1
    assert "Allowed Country Codes validation failed" in errors[0]
    
    # Phone that fails length validation
    errors = validate_field_value(TripFieldType.PHONE, "+966123", validation_config)
    assert len(errors) == 1
    assert "Phone Minimum Length validation failed" in errors[0]


def test_validation_with_empty_config():
    """Test validation with empty or None config"""
    # No validation config should pass
    errors = validate_field_value(TripFieldType.NAME, "Any Value", None)
    assert len(errors) == 0
    
    errors = validate_field_value(TripFieldType.NAME, "Any Value", {})
    assert len(errors) == 0


def test_validation_config_validation_edge_cases():
    """Test validation config validation edge cases"""
    # Empty config should be valid
    errors = validate_validation_config(TripFieldType.NAME, {})
    assert len(errors) == 0
    
    # Multiple invalid validations
    config = {
        "unknown_validation": {"param": "value"},
        "min_age": {"min_value": 18}  # Not available for name field
    }
    errors = validate_validation_config(TripFieldType.NAME, config)
    assert len(errors) == 2


def test_registration_with_validation_config_integration(client: TestClient, session: Session):
    """Test trip registration with validation config integration"""
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    # Create provider and trip
    from app.tests.utils.provider import create_random_provider
    from app.models.source import RequestSource as RS
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RS.PROVIDERS_PANEL)
    session.refresh(provider_user)
    provider = crud.provider.get_provider_by_id(session, id=provider_user.provider_id)
    trip_in = TripCreate(
        name_en="Test Trip with Validation",
        description_en="A trip to test validation integration",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider)
    
    # Create package with validation config
    package = TripPackageModel(
        trip_id=trip.id,
        name_en="Adult Package",
        name_ar="Adult Package AR",
        description_en="Package for adults with age validation",
        description_ar="Package for adults with age validation AR",
        price=100.0,
        is_active=True
    )
    session.add(package)
    session.commit()
    session.refresh(package)
    
    # Add required fields with validation config
    name_field = TripPackageRequiredField(
        package_id=package.id,
        field_type=TripFieldType.NAME,
        is_required=True,
        validation_config={"min_length": {"min_length": 3}}
    )
    dob_field = TripPackageRequiredField(
        package_id=package.id,
        field_type=TripFieldType.DATE_OF_BIRTH,
        is_required=True,
        validation_config={"min_age": {"min_value": 18}}
    )
    phone_field = TripPackageRequiredField(
        package_id=package.id,
        field_type=TripFieldType.PHONE,
        is_required=True,
        validation_config={"phone_country_codes": {"allowed_codes": ["966"]}}
    )
    
    session.add_all([name_field, dob_field, phone_field])
    session.commit()
    
    # Create mobile user for registration
    from app.models.source import RequestSource
    from unittest.mock import patch, AsyncMock
    mobile_user, mobile_headers = user_authentication_headers(client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP)
    
    with patch('app.services.email.email_service.send_booking_confirmation_email', new_callable=AsyncMock):
        # Test successful registration with valid data
        valid_registration = {
            "total_participants": 1,
            "total_amount": 150.0,
            "status": "pending",
            "participants": [
                {
                    "package_id": str(package.id),
                    "name": "John Doe",  # Valid length
                    "date_of_birth": "2000-01-01",  # Over 18
                    "phone": "+966501234567"  # Valid Saudi number
                }
            ]
        }
        response = client.post(
            f"{settings.API_V1_STR}/trips/{trip.id}/register",
            headers=mobile_headers,
            json=valid_registration
        )
        assert response.status_code == 200
        
        # Test failed registration with validation errors — use a different user
        # (the first user already has an active registration for this trip)
        mobile_user2, mobile_headers2 = user_authentication_headers(
            client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
        )
        invalid_registration = {
            "total_participants": 1,
            "total_amount": 150.0,
            "status": "pending",
            "participants": [
                {
                    "package_id": str(package.id),
                    "name": "Jo",  # Too short (min 3 chars)
                    "date_of_birth": "2010-01-01",  # Under 18
                    "phone": "+971501234567"  # Wrong country code
                }
            ]
        }
        response = client.post(
            f"{settings.API_V1_STR}/trips/{trip.id}/register",
            headers=mobile_headers2,
            json=invalid_registration
        )
        assert response.status_code == 400
        assert "Validation failed" in response.json()["detail"]


def test_package_creation_with_validation_config(client: TestClient, session: Session):
    """Test creating package required fields with validation config through API"""
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Package Validation Config",
        description_en="A trip to test package validation config",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create package
    package_data = {
        "name_en": "Validated Package",
            "name_ar": "Validated Package AR",
        "description_en": "Package with validation rules",
            "description_ar": "Package with validation rules AR",
        "price": 150.0
    }
    package_response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages",
        headers=provider_headers,
        json=package_data
    )
    assert package_response.status_code == 200
    package_id = package_response.json()["id"]
    
    # Manually add validation config to required fields (simulating future API enhancement)
    package = session.get(TripPackageModel, package_id)
    required_fields = session.query(TripPackageRequiredField).filter(
        TripPackageRequiredField.package_id == package_id
    ).all()
    
    # Add validation config to name field
    for field in required_fields:
        if field.field_type == TripFieldType.NAME:
            field.validation_config = {"min_length": {"min_length": 5}}
        elif field.field_type == TripFieldType.DATE_OF_BIRTH:
            field.validation_config = {"min_age": {"min_value": 21}}
    
    session.commit()
    
    # Verify validation config was saved
    updated_fields = session.query(TripPackageRequiredField).filter(
        TripPackageRequiredField.package_id == package_id
    ).all()
    
    name_field = next((f for f in updated_fields if f.field_type == TripFieldType.NAME), None)
    assert name_field is not None
    assert name_field.validation_config is not None
    assert name_field.validation_config["min_length"]["min_length"] == 5


def test_set_package_required_fields_with_validation_api(client: TestClient, session: Session):
    """Test setting package required fields with validation configurations via API"""
    from app.models.trip_package import TripPackage as TripPackageModel
    
    # Create provider and trip
    provider_user, provider_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip_in = TripCreate(
        name_en="Test Trip for Validation API",
        description_en="A trip to test validation API",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        max_participants=10
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)
    
    # Create package
    package = TripPackageModel(
        trip_id=trip.id,
        name_en="Test Package",
        name_ar="Test Package AR",
        description_en="Package for validation API test",
        description_ar="Package for validation API test AR",
        price=100.0,
        is_active=True
    )
    session.add(package)
    session.commit()
    session.refresh(package)
    
    # Set required fields with validation configs
    validation_request = {
        "required_fields": [
            {
                "field_type": "name",
                "validation_config": {
                    "min_length": {"min_length": 3},
                    "max_length": {"max_length": 50}
                }
            },
            {
                "field_type": "phone",
                "validation_config": {
                    "phone_country_codes": {"allowed_codes": ["966", "971"]}
                }
            }
        ]
    }
    
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages/{package.id}/required-fields-with-validation",
        headers=provider_headers,
        json=validation_request
    )
    
    assert response.status_code == 200
    assert "validation configurations updated successfully" in response.json()["message"]
