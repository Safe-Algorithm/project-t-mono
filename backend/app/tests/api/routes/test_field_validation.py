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
    get_available_validations_for_field,
    PHONE_COUNTRY_METADATA,
    NATIONALITY_LIST,
)
from app.models.trip_field import TripFieldType
from app.models.user import UserRole
from app.schemas.trip import TripCreate
from app.tests.utils.user import user_authentication_headers
import app.crud as crud


# ---------------------------------------------------------------------------
# Age validation
# ---------------------------------------------------------------------------

def test_validate_min_age_success():
    config = {"min_value": 18}
    errors = validate_field_value(TripFieldType.DATE_OF_BIRTH, "2000-01-01", {"min_age": config})
    assert len(errors) == 0


def test_validate_min_age_failure():
    config = {"min_value": 18}
    errors = validate_field_value(TripFieldType.DATE_OF_BIRTH, "2010-01-01", {"min_age": config})
    assert len(errors) == 1
    assert "18" in errors[0]


def test_validate_max_age_success():
    config = {"max_value": 65}
    errors = validate_field_value(TripFieldType.DATE_OF_BIRTH, "1970-01-01", {"max_age": config})
    assert len(errors) == 0


def test_validate_max_age_failure():
    config = {"max_value": 65}
    errors = validate_field_value(TripFieldType.DATE_OF_BIRTH, "1950-01-01", {"max_age": config})
    assert len(errors) == 1
    assert "65" in errors[0]


# ---------------------------------------------------------------------------
# Phone — always-on format + optional country restriction
# ---------------------------------------------------------------------------

def test_validate_phone_valid_saudi_number():
    """Valid Saudi mobile number passes with no config."""
    errors = validate_field_value(TripFieldType.PHONE, "+966501234567", None)
    assert len(errors) == 0


def test_validate_phone_valid_uae_number():
    errors = validate_field_value(TripFieldType.PHONE, "+971501234567", None)
    assert len(errors) == 0


def test_validate_phone_valid_us_number():
    errors = validate_field_value(TripFieldType.PHONE, "+12125551234", None)
    assert len(errors) == 0


def test_validate_phone_unknown_dial_code_fails():
    """Number with unknown country prefix should fail always-on check."""
    errors = validate_field_value(TripFieldType.PHONE, "+9991234567", None)
    assert len(errors) == 1
    assert "dial code" in errors[0].lower() or "country" in errors[0].lower()


def test_validate_phone_invalid_length_fails():
    """Saudi code but wrong local length should fail always-on check."""
    errors = validate_field_value(TripFieldType.PHONE, "+96612345", None)  # too short
    assert len(errors) == 1


def test_validate_phone_country_codes_restriction_success():
    """Valid SA number passes SA-only restriction."""
    config = {"allowed_codes": ["966", "971"]}
    errors = validate_field_value(TripFieldType.PHONE, "+966501234567", {"phone_country_codes": config})
    assert len(errors) == 0


def test_validate_phone_country_codes_restriction_failure():
    """Valid UAE number fails SA-only restriction."""
    config = {"allowed_codes": ["966"]}
    errors = validate_field_value(TripFieldType.PHONE, "+971501234567", {"phone_country_codes": config})
    assert len(errors) == 1
    assert "Saudi Arabia" in errors[0]


def test_validate_phone_no_config_passes_valid_number():
    """Phone with no config passes as long as format is valid."""
    errors = validate_field_value(TripFieldType.PHONE, "+966501234567", None)
    assert len(errors) == 0


# ---------------------------------------------------------------------------
# ID/Iqama — always-on format validation (Saudi ID or Iqama, both accepted by default)
# ---------------------------------------------------------------------------

def test_validate_id_saudi_national_id_accepted():
    """Saudi National ID (starts with 1 or 2, 10 digits) is always accepted."""
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "1234567890", None)
    assert len(errors) == 0


def test_validate_id_iqama_accepted():
    """Iqama number (starts with 3-9, 10 digits) is always accepted."""
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "3234567890", None)
    assert len(errors) == 0


def test_validate_id_wrong_format_fails():
    """A 9-digit number should always fail."""
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "123456789", None)
    assert len(errors) == 1
    assert "10 digits" in errors[0] or "Saudi" in errors[0]


def test_validate_id_letters_fail():
    """Non-numeric value should fail."""
    errors = validate_field_value(TripFieldType.ID_IQAMA_NUMBER, "ABCD123456", None)
    assert len(errors) == 1


def test_validate_id_no_configurable_validations():
    """ID/Iqama has no provider-configurable validations — format is always-on."""
    avail = get_available_validations_for_field(TripFieldType.ID_IQAMA_NUMBER)
    assert len(avail) == 0


# ---------------------------------------------------------------------------
# Passport — always-on format validation (no config options)
# ---------------------------------------------------------------------------

def test_validate_passport_format_success():
    errors = validate_field_value(TripFieldType.PASSPORT_NUMBER, "AB123456", None)
    assert len(errors) == 0


def test_validate_passport_format_success_12_chars():
    errors = validate_field_value(TripFieldType.PASSPORT_NUMBER, "123456789ABC", None)
    assert len(errors) == 0


def test_validate_passport_format_failure_too_short():
    errors = validate_field_value(TripFieldType.PASSPORT_NUMBER, "AB123", None)
    assert len(errors) == 1
    assert "6-12 alphanumeric" in errors[0]


def test_validate_passport_format_failure_special_chars():
    errors = validate_field_value(TripFieldType.PASSPORT_NUMBER, "AB123-456", None)
    assert len(errors) == 1


def test_passport_has_no_available_validations():
    """Passport exposes no configurable validation options — format is automatic."""
    avail = get_available_validations_for_field(TripFieldType.PASSPORT_NUMBER)
    assert len(avail) == 0


# ---------------------------------------------------------------------------
# Gender — always-on (must be male/female) + optional restriction
# ---------------------------------------------------------------------------

def test_validate_gender_male_no_config():
    """'male' passes always-on check with no config."""
    errors = validate_field_value(TripFieldType.GENDER, "male", None)
    assert len(errors) == 0


def test_validate_gender_female_no_config():
    errors = validate_field_value(TripFieldType.GENDER, "female", None)
    assert len(errors) == 0


def test_validate_gender_invalid_value_always_fails():
    """Values other than male/female always fail regardless of config."""
    errors = validate_field_value(TripFieldType.GENDER, "prefer_not_to_say", None)
    assert len(errors) == 1
    assert "male" in errors[0].lower() or "female" in errors[0].lower()


def test_validate_gender_other_always_fails():
    errors = validate_field_value(TripFieldType.GENDER, "other", None)
    assert len(errors) == 1


def test_validate_gender_restriction_female_only():
    """Provider restricts to females only; male is rejected."""
    config = {"allowed_genders": ["female"]}
    errors = validate_field_value(TripFieldType.GENDER, "male", {"gender_restrictions": config})
    assert len(errors) == 1
    assert "females" in errors[0]


def test_validate_gender_restriction_both_allowed():
    config = {"allowed_genders": ["male", "female"]}
    errors = validate_field_value(TripFieldType.GENDER, "male", {"gender_restrictions": config})
    assert len(errors) == 0


# ---------------------------------------------------------------------------
# Nationality — always-on (must be known code) + optional restriction
# ---------------------------------------------------------------------------

def test_validate_nationality_known_code_no_config():
    """Known nationality code passes always-on check with no restriction."""
    errors = validate_field_value(TripFieldType.NATIONALITY, "SA", None)
    assert len(errors) == 0


def test_validate_nationality_unknown_code_always_fails():
    """Unknown ISO code fails always-on check."""
    errors = validate_field_value(TripFieldType.NATIONALITY, "XX", None)
    assert len(errors) == 1
    assert "unknown" in errors[0].lower() or "nationality" in errors[0].lower()


def test_validate_nationality_restriction_success():
    config = {"allowed_nationalities": ["SA", "AE"]}
    errors = validate_field_value(TripFieldType.NATIONALITY, "SA", {"nationality_restriction": config})
    assert len(errors) == 0


def test_validate_nationality_restriction_failure():
    config = {"allowed_nationalities": ["SA"]}
    errors = validate_field_value(TripFieldType.NATIONALITY, "EG", {"nationality_restriction": config})
    assert len(errors) == 1
    assert "Saudi" in errors[0]


def test_validate_nationality_case_insensitive():
    config = {"allowed_nationalities": ["SA"]}
    errors = validate_field_value(TripFieldType.NATIONALITY, "sa", {"nationality_restriction": config})
    assert len(errors) == 0


# ---------------------------------------------------------------------------
# Available validations per field
# ---------------------------------------------------------------------------

def test_get_available_validations_phone():
    avail = get_available_validations_for_field(TripFieldType.PHONE)
    assert "phone_country_codes" in avail
    assert "phone_min_length" not in avail
    assert "regex_pattern" not in avail


def test_get_available_validations_dob():
    avail = get_available_validations_for_field(TripFieldType.DATE_OF_BIRTH)
    assert "min_age" in avail
    assert "max_age" in avail


def test_get_available_validations_id():
    """ID/Iqama has no configurable validations — format is always-on."""
    avail = get_available_validations_for_field(TripFieldType.ID_IQAMA_NUMBER)
    assert len(avail) == 0


def test_get_available_validations_gender():
    avail = get_available_validations_for_field(TripFieldType.GENDER)
    assert "gender_restrictions" in avail


def test_get_available_validations_nationality():
    avail = get_available_validations_for_field(TripFieldType.NATIONALITY)
    assert "nationality_restriction" in avail


def test_get_available_validations_name_empty():
    """Name field has no configurable validations."""
    avail = get_available_validations_for_field(TripFieldType.NAME)
    assert len(avail) == 0


# ---------------------------------------------------------------------------
# validate_validation_config
# ---------------------------------------------------------------------------

def test_validate_validation_config_success_phone():
    config = {"phone_country_codes": {"allowed_codes": ["966", "971"]}}
    errors = validate_validation_config(TripFieldType.PHONE, config)
    assert len(errors) == 0


def test_validate_validation_config_unknown_type():
    config = {"unknown_validation": {"some_param": "value"}}
    errors = validate_validation_config(TripFieldType.PHONE, config)
    assert len(errors) == 1
    assert "Unknown validation type" in errors[0]


def test_validate_validation_config_unavailable_for_field():
    """min_age is not available for the phone field."""
    config = {"min_age": {"min_value": 18}}
    errors = validate_validation_config(TripFieldType.PHONE, config)
    assert len(errors) == 1
    assert "not available for field type" in errors[0]


def test_validate_validation_config_missing_required_param():
    config = {"min_age": {}}
    errors = validate_validation_config(TripFieldType.DATE_OF_BIRTH, config)
    assert len(errors) == 1
    assert "Missing required parameter" in errors[0]


def test_validate_validation_config_id_type_unknown():
    """id_type_restriction is no longer a configurable option — treated as unknown."""
    config = {"id_type_restriction": {"restriction": "saudis_only"}}
    errors = validate_validation_config(TripFieldType.ID_IQAMA_NUMBER, config)
    assert len(errors) == 1
    assert "Unknown" in errors[0] or "not available" in errors[0]


# ---------------------------------------------------------------------------
# Phone country metadata + nationality list
# ---------------------------------------------------------------------------

def test_phone_country_metadata_has_saudi_arabia():
    sa = next((c for c in PHONE_COUNTRY_METADATA if c["code"] == "SA"), None)
    assert sa is not None
    assert sa["dial_code"] == "966"
    assert sa["flag"] == "🇸🇦"


def test_phone_country_metadata_all_have_required_keys():
    for c in PHONE_COUNTRY_METADATA:
        assert "dial_code" in c
        assert "code" in c
        assert "name" in c
        assert "name_ar" in c
        assert "flag" in c


def test_nationality_list_has_saudi():
    sa = next((n for n in NATIONALITY_LIST if n["code"] == "SA"), None)
    assert sa is not None
    assert sa["name"] == "Saudi"


def test_nationality_list_all_have_required_keys():
    for n in NATIONALITY_LIST:
        assert "code" in n
        assert "name" in n
        assert "name_ar" in n


# ---------------------------------------------------------------------------
# Empty/None config
# ---------------------------------------------------------------------------

def test_validation_with_empty_config():
    errors = validate_field_value(TripFieldType.NAME, "Any Value", None)
    assert len(errors) == 0

    errors = validate_field_value(TripFieldType.NAME, "Any Value", {})
    assert len(errors) == 0


# ---------------------------------------------------------------------------
# Always-on: email, name length, address length
# ---------------------------------------------------------------------------

def test_validate_email_valid():
    errors = validate_field_value(TripFieldType.EMAIL, "user@example.com", None)
    assert len(errors) == 0


def test_validate_email_invalid():
    errors = validate_field_value(TripFieldType.EMAIL, "not-an-email", None)
    assert len(errors) == 1


def test_validate_name_within_limit():
    errors = validate_field_value(TripFieldType.NAME, "Ahmed Al-Rashidi", None)
    assert len(errors) == 0


def test_validate_name_too_long():
    errors = validate_field_value(TripFieldType.NAME, "A" * 101, None)
    assert len(errors) == 1


def test_validate_address_within_limit():
    errors = validate_field_value(TripFieldType.ADDRESS, "123 Main St", None)
    assert len(errors) == 0


def test_validate_address_too_long():
    errors = validate_field_value(TripFieldType.ADDRESS, "A" * 301, None)
    assert len(errors) == 1


def test_validation_config_empty_is_valid():
    errors = validate_validation_config(TripFieldType.NAME, {})
    assert len(errors) == 0


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


def test_validation_config_multiple_invalid():
    """Multiple invalid validations at once should each produce an error."""
    config = {
        "unknown_validation": {"param": "value"},
        "min_age": {"min_value": 18},
    }
    errors = validate_validation_config(TripFieldType.NAME, config)
    assert len(errors) == 2


def test_registration_with_validation_config_integration(client: TestClient, session: Session):
    """Registration enforces phone country codes and min_age validation configs."""
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    from app.models.source import RequestSource as RS
    from unittest.mock import patch, AsyncMock

    provider_user, provider_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RS.PROVIDERS_PANEL
    )
    session.refresh(provider_user)
    provider = crud.provider.get_provider_by_id(session, id=provider_user.provider_id)
    trip_in = TripCreate(
        name_en="Test Trip with Validation",
        description_en="A trip to test validation integration",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=31),
        max_participants=10,
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider)

    package = TripPackageModel(
        trip_id=trip.id,
        name_en="Adult Package",
        name_ar="Adult Package AR",
        description_en="Package for adults with age validation",
        description_ar="Package for adults with age validation AR",
        price=100.0,
        is_active=True,
    )
    session.add(package)
    session.commit()
    session.refresh(package)

    dob_field = TripPackageRequiredField(
        package_id=package.id,
        field_type=TripFieldType.DATE_OF_BIRTH,
        is_required=True,
        validation_config={"min_age": {"min_value": 18}},
    )
    phone_field = TripPackageRequiredField(
        package_id=package.id,
        field_type=TripFieldType.PHONE,
        is_required=True,
        validation_config={"phone_country_codes": {"allowed_codes": ["966"]}},
    )
    session.add_all([dob_field, phone_field])
    session.commit()

    from app.models.source import RequestSource
    mobile_user, mobile_headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    with patch("app.services.email.email_service.send_booking_confirmation_email", new_callable=AsyncMock):
        valid_registration = {
            "total_participants": 1,
            "total_amount": 150.0,
            "status": "pending",
            "participants": [
                {
                    "package_id": str(package.id),
                    "name": "John Doe",
                    "date_of_birth": "2000-01-01",
                    "phone": "+966501234567",
                }
            ],
        }
        response = client.post(
            f"{settings.API_V1_STR}/trips/{trip.id}/register",
            headers=mobile_headers,
            json=valid_registration,
        )
        assert response.status_code == 200

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
                    "name": "Jane Doe",
                    "date_of_birth": "2010-01-01",
                    "phone": "+971501234567",
                }
            ],
        }
        response = client.post(
            f"{settings.API_V1_STR}/trips/{trip.id}/register",
            headers=mobile_headers2,
            json=invalid_registration,
        )
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert detail["code"] == "field_validation_failed"
        assert detail["field"] == "date_of_birth"
        assert len(detail["messages"]) > 0


def test_set_package_required_fields_with_validation_api(client: TestClient, session: Session):
    """Setting required fields with valid validation configs succeeds."""
    from app.models.trip_package import TripPackage as TripPackageModel

    provider_user, provider_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER
    )
    trip_in = TripCreate(
        name_en="Test Trip for Validation API",
        description_en="A trip to test validation API",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        max_participants=10,
    )
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider_user.provider)

    package = TripPackageModel(
        trip_id=trip.id,
        name_en="Test Package",
        name_ar="Test Package AR",
        description_en="Package for validation API test",
        description_ar="Package for validation API test AR",
        price=100.0,
        is_active=True,
    )
    session.add(package)
    session.commit()
    session.refresh(package)

    validation_request = {
        "required_fields": [
            {
                "field_type": "phone",
                "validation_config": {
                    "phone_country_codes": {"allowed_codes": ["966", "971"]}
                },
            },
            {
                "field_type": "date_of_birth",
                "validation_config": {"min_age": {"min_value": 18}},
            },
        ]
    }

    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/packages/{package.id}/required-fields-with-validation",
        headers=provider_headers,
        json=validation_request,
    )
    assert response.status_code == 200
    assert "validation configurations updated successfully" in response.json()["message"]


def test_phone_countries_api(client: TestClient, session: Session):
    """GET /validation/phone-countries returns country list with required fields."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    response = client.get(f"{settings.API_V1_STR}/trips/validation/phone-countries", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "countries" in data
    assert len(data["countries"]) > 0
    sa = next((c for c in data["countries"] if c["code"] == "SA"), None)
    assert sa is not None
    assert sa["dial_code"] == "966"


def test_nationalities_api(client: TestClient, session: Session):
    """GET /validation/nationalities returns nationality list."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    response = client.get(f"{settings.API_V1_STR}/trips/validation/nationalities", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "nationalities" in data
    assert len(data["nationalities"]) > 0
    sa = next((n for n in data["nationalities"] if n["code"] == "SA"), None)
    assert sa is not None
