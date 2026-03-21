import asyncio
import uuid
import logging
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, BackgroundTasks, UploadFile, File
from sqlmodel import Session
from pydantic import BaseModel

from app import crud
from app.api.deps import get_current_active_provider, get_session, get_current_active_user
from app.api.rbac_deps import require_provider_permission
from app.models.user import User
from app.utils.localization import get_name, get_description
from app.schemas.trip import TripCreate, TripRead, TripUpdate
from app.schemas.trip_package_field import TripPackageRequiredFieldsResponse, PackageRequiredFieldWithValidation, TripPackageRequiredFieldsSet, TripPackageRequiredFieldsSetWithValidation
from app.models.trip_field import TripFieldType, FIELD_METADATA
from app.models.field_validation import get_available_validations_for_field, validate_field_value, validate_validation_config, VALIDATION_METADATA, PHONE_COUNTRY_METADATA, NATIONALITY_LIST
from app.schemas.field_metadata import AvailableFieldsResponse, FieldMetadata, FieldOption
from app.schemas.trip_package import TripPackageCreate, TripPackage, TripPackageUpdate, TripPackageWithRequiredFields
from app.schemas.trip_registration import TripRegistrationCreate, TripRegistration
from app.schemas.trip_extra_fee import TripExtraFeeCreate, TripExtraFeeUpdate, TripExtraFeeResponse
from app.crud import trip_extra_fee
from app.services.fcm import fcm_service
from app.models.user_push_token import UserPushToken

router = APIRouter()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _normalize_trip_value_for_compare(value):
    if hasattr(value, "value"):
        return value.value
    if isinstance(value, bool):
        return value
    if isinstance(value, Decimal):
        return format(value.normalize(), "f")
    if isinstance(value, (int, float)):
        return format(Decimal(str(value)).normalize(), "f")
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, dict):
        return {k: _normalize_trip_value_for_compare(v) for k, v in sorted(value.items())}
    if isinstance(value, list):
        return sorted(_normalize_trip_value_for_compare(item) for item in value)
    return value


def _get_hidden_package(session: Session, trip_id: uuid.UUID):
    from app.models.trip_package import TripPackage as TripPackageModel

    return session.query(TripPackageModel).filter(TripPackageModel.trip_id == trip_id).first()


def _filter_trip_update_changes(session: Session, db_trip, trip_in: TripUpdate) -> Dict[str, Any]:
    payload = trip_in.model_dump(exclude_unset=True)
    hidden_package = None
    package_only_fields = {"price", "is_refundable", "amenities"}

    if any(field in payload for field in package_only_fields):
        hidden_package = _get_hidden_package(session, db_trip.id)

    changed: Dict[str, Any] = {}
    for field, value in payload.items():
        if field in package_only_fields:
            current_value = getattr(hidden_package, field, None) if hidden_package else None
        else:
            current_value = getattr(db_trip, field, None)
        if _normalize_trip_value_for_compare(value) != _normalize_trip_value_for_compare(current_value):
            changed[field] = value
    return changed


def _filter_package_update_changes(package, package_in: TripPackageUpdate) -> Dict[str, Any]:
    payload = package_in.model_dump(exclude_unset=True, exclude={"required_fields"})
    changed: Dict[str, Any] = {}
    for field, value in payload.items():
        current_value = getattr(package, field, None)
        if _normalize_trip_value_for_compare(value) != _normalize_trip_value_for_compare(current_value):
            changed[field] = value
    return changed


def _trip_has_active_paid_bookings(session: Session, trip_id: uuid.UUID) -> bool:
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from app.models.payment import Payment, PaymentStatus
    from sqlmodel import select as sql_select

    return session.exec(
        sql_select(Payment).join(
            TripRegistrationModel,
            Payment.registration_id == TripRegistrationModel.id,
        ).where(
            TripRegistrationModel.trip_id == trip_id,
            TripRegistrationModel.status != "cancelled",
            Payment.status == PaymentStatus.PAID,
        )
    ).first() is not None


def _raise_paid_booking_material_change_error() -> None:
    raise HTTPException(
        status_code=409,
        detail=(
            "This trip has active paid bookings. "
            "Material trip details cannot be changed once participants have booked. "
            "To change the trip, cancel it first (all participants will be refunded)."
        ),
    )


def _normalize_required_field_state(fields) -> List[Dict[str, Any]]:
    normalized = []
    for field in fields:
        field_type = field["field_type"]
        normalized.append({
            "field_type": field_type.value if hasattr(field_type, "value") else str(field_type),
            "is_required": bool(field.get("is_required", True)),
            "validation_config": _normalize_trip_value_for_compare(field.get("validation_config") or {}),
        })
    return sorted(normalized, key=lambda item: item["field_type"])


def _get_package_required_fields_state(package) -> List[Dict[str, Any]]:
    return _normalize_required_field_state([
        {
            "field_type": field.field_type,
            "is_required": field.is_required,
            "validation_config": field.validation_config,
        }
        for field in (package.required_fields or [])
    ])


def _desired_required_fields_state(field_types: List[TripFieldType]) -> List[Dict[str, Any]]:
    mandatory_fields = {TripFieldType.NAME, TripFieldType.DATE_OF_BIRTH}
    all_fields = mandatory_fields.union(set(field_types or []))
    return _normalize_required_field_state([
        {
            "field_type": field_type,
            "is_required": True,
            "validation_config": {},
        }
        for field_type in all_fields
    ])


def _desired_required_fields_state_with_validation(
    required_fields: List[PackageRequiredFieldWithValidation],
) -> List[Dict[str, Any]]:
    desired: Dict[TripFieldType, Dict[str, Any]] = {
        TripFieldType.NAME: {},
        TripFieldType.DATE_OF_BIRTH: {},
    }
    for field_config in required_fields:
        desired[field_config.field_type] = field_config.validation_config or {}
    return _normalize_required_field_state([
        {
            "field_type": field_type,
            "is_required": True,
            "validation_config": validation_config,
        }
        for field_type, validation_config in desired.items()
    ])


def _get_starting_city_info(session: Session, trip) -> Optional[dict]:
    if not trip.starting_city_id:
        return None
    from app.models.destination import Destination
    sc = session.get(Destination, trip.starting_city_id)
    if not sc:
        return None
    country_name_en = None
    country_name_ar = None
    if sc.parent_id:
        parent = session.get(Destination, sc.parent_id)
        if parent:
            country_name_en = parent.name_en
            country_name_ar = parent.name_ar
    return {
        "id": sc.id,
        "name_en": sc.name_en,
        "name_ar": sc.name_ar,
        "country_code": sc.country_code,
        "country_name_en": country_name_en,
        "country_name_ar": country_name_ar,
    }


def _get_destinations_info(session: Session, trip) -> list:
    from app.models.destination import Destination
    from app.models.trip_destination import TripDestination
    from sqlmodel import select as sql_select
    links = session.exec(
        sql_select(TripDestination).where(TripDestination.trip_id == trip.id)
    ).all()
    from app.models.place import Place
    result = []
    for link in links:
        dest = session.get(Destination, link.destination_id)
        if not dest:
            continue
        country_name_en = None
        country_name_ar = None
        if dest.parent_id:
            parent = session.get(Destination, dest.parent_id)
            if parent:
                country_name_en = parent.name_en
                country_name_ar = parent.name_ar
        place_name_en = None
        place_name_ar = None
        if link.place_id:
            place = session.get(Place, link.place_id)
            if place:
                place_name_en = place.name_en
                place_name_ar = place.name_ar
        result.append({
            "id": dest.id,
            "name_en": dest.name_en,
            "name_ar": dest.name_ar,
            "country_code": dest.country_code,
            "country_name_en": country_name_en,
            "country_name_ar": country_name_ar,
            "place_name_en": place_name_en,
            "place_name_ar": place_name_ar,
            "type": dest.type.value if hasattr(dest.type, "value") else str(dest.type),
        })
    return result


def _build_package_with_fields(session: Session, package) -> TripPackageWithRequiredFields:
    """Build TripPackageWithRequiredFields from a TripPackage ORM object."""
    from app.models.trip_package_field import TripPackageRequiredField
    from app.models.trip_registration import TripRegistration as TripRegistrationModel, TripRegistrationParticipant as TripParticipantModel
    required_fields = session.query(TripPackageRequiredField).filter(
        TripPackageRequiredField.package_id == package.id
    ).all()
    required_field_types = [rf.field_type.value for rf in required_fields]
    required_fields_details = [
        {"id": str(rf.id), "package_id": str(rf.package_id), "field_type": rf.field_type.value,
         "is_required": rf.is_required, "validation_config": rf.validation_config}
        for rf in required_fields
    ]
    # Compute per-package available_spots if max_participants is set
    available_spots = None
    if package.max_participants is not None:
        booked_in_pkg = (
            session.query(TripParticipantModel)
            .join(TripRegistrationModel, TripParticipantModel.registration_id == TripRegistrationModel.id)
            .filter(
                TripParticipantModel.package_id == package.id,
                TripRegistrationModel.status.in_(["confirmed", "pending_payment"]),
            )
            .count()
        )
        available_spots = max(0, package.max_participants - booked_in_pkg)
    return TripPackageWithRequiredFields(
        id=package.id, trip_id=package.trip_id,
        name_en=package.name_en, name_ar=package.name_ar,
        description_en=package.description_en, description_ar=package.description_ar,
        price=package.price, currency=package.currency, is_active=package.is_active,
        max_participants=package.max_participants,
        available_spots=available_spots,
        is_refundable=package.is_refundable,
        amenities=package.amenities,
        required_fields=required_field_types,
        required_fields_details=required_fields_details,
    )


def _sync_hidden_package(
    session: Session, trip,
    price=None, is_refundable=None, amenities=None,
    required_field_types=None,
) -> None:
    """For non-packaged trips: ensure exactly one hidden package exists and is in sync."""
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    from app.models.trip_field import TripFieldType
    from decimal import Decimal
    existing = session.query(TripPackageModel).filter(TripPackageModel.trip_id == trip.id).first()
    if existing:
        existing.max_participants = trip.max_participants
        if price is not None:
            existing.price = Decimal(str(price))
        if is_refundable is not None:
            existing.is_refundable = is_refundable
        if amenities is not None:
            existing.amenities = list(amenities)
        session.add(existing)
    else:
        hidden = TripPackageModel(
            trip_id=trip.id, name_en="Standard", name_ar="قياسي",
            description_en="Standard package", description_ar="الباقة القياسية",
            price=Decimal(str(price)) if price is not None else Decimal("0.00"),
            is_active=True,
            max_participants=trip.max_participants,
            is_refundable=is_refundable if is_refundable is not None else True,
            amenities=list(amenities) if amenities else None,
        )
        session.add(hidden)
        session.flush()
        fields_to_add = required_field_types or [TripFieldType.NAME, TripFieldType.DATE_OF_BIRTH]
        for ft in fields_to_add:
            session.add(TripPackageRequiredField(package_id=hidden.id, field_type=ft))
    session.commit()


def _build_trip_read(session: Session, trip, provider_info: dict, extra_fees: list) -> TripRead:
    """Build a TripRead response. For non-packaged trips, surfaces is_refundable/amenities
    from the hidden package into the response (not stored on Trip itself)."""
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from sqlmodel import select as sql_select
    all_packages = session.query(TripPackageModel).filter(
        TripPackageModel.trip_id == trip.id, TripPackageModel.is_active == True,
    ).all()
    # Computed response-only fields for non-packaged trips
    resp_price = None
    resp_is_refundable = None
    resp_amenities = None
    simple_required_fields: list = []
    simple_required_fields_details: list = []
    if trip.is_packaged_trip:
        packages_with_fields = [_build_package_with_fields(session, p) for p in all_packages]
    else:
        packages_with_fields = []
        if all_packages:
            hp = all_packages[0]
            if hp.max_participants is not None:
                trip.max_participants = hp.max_participants
            resp_price = float(hp.price) if hp.price is not None else None
            resp_is_refundable = hp.is_refundable
            resp_amenities = hp.amenities
            from app.models.trip_package_field import TripPackageRequiredField
            hp_fields = session.query(TripPackageRequiredField).filter(
                TripPackageRequiredField.package_id == hp.id
            ).all()
            simple_required_fields = [rf.field_type.value for rf in hp_fields]
            simple_required_fields_details = [
                {"id": str(rf.id), "package_id": str(rf.package_id), "field_type": rf.field_type.value,
                 "is_required": rf.is_required, "validation_config": rf.validation_config}
                for rf in hp_fields
            ]
    active_regs = session.exec(
        sql_select(TripRegistrationModel).where(
            TripRegistrationModel.trip_id == trip.id,
            TripRegistrationModel.status.in_(["confirmed", "pending_payment"]),
        )
    ).all()
    booked = sum(r.total_participants for r in active_regs)
    return TripRead(
        id=trip.id, provider_id=trip.provider_id, provider=provider_info,
        name_en=trip.name_en, name_ar=trip.name_ar,
        description_en=trip.description_en, description_ar=trip.description_ar,
        start_date=trip.start_date, end_date=trip.end_date,
        max_participants=trip.max_participants, images=trip.images,
        trip_metadata=trip.trip_metadata, is_active=trip.is_active,
        content_hash=trip.content_hash,
        price=resp_price, is_refundable=resp_is_refundable, amenities=resp_amenities,
        has_meeting_place=trip.has_meeting_place, meeting_place_name=trip.meeting_place_name,
        meeting_place_name_ar=trip.meeting_place_name_ar,
        meeting_location=trip.meeting_location,
        meeting_time=trip.meeting_time, trip_reference=trip.trip_reference,
        registration_deadline=trip.registration_deadline,
        starting_city_id=trip.starting_city_id,
        starting_city=_get_starting_city_info(session, trip),
        destinations=_get_destinations_info(session, trip),
        is_international=trip.is_international, is_packaged_trip=trip.is_packaged_trip,
        trip_type=trip.trip_type,
        timezone=trip.timezone,
        packages=packages_with_fields, extra_fees=extra_fees,
        available_spots=max(0, trip.max_participants - booked),
        simple_trip_required_fields=simple_required_fields,
        simple_trip_required_fields_details=simple_required_fields_details,
    )


@router.post("", response_model=TripRead)
def create_trip(
    *,
    session: Session = Depends(get_session),
    trip_in: TripCreate,
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Create a new trip for the current provider."""
    try:
        logger.info(f"Creating trip for provider: {current_user.provider_id}")
        trip = crud.trip.create_trip(
            session=session, trip_in=trip_in, provider=current_user.provider
        )
        logger.info(f"Trip created successfully with ID: {trip.id}")
        # For non-packaged trips, auto-create the hidden package
        if not trip.is_packaged_trip:
            _sync_hidden_package(
                session, trip,
                price=trip_in.price,
                is_refundable=trip_in.is_refundable,
                amenities=trip_in.amenities,
            )
            session.refresh(trip)
            # Recompute hash now that the hidden package exists (packages are part of the hash)
            crud.trip.recompute_content_hash(session=session, trip=trip)
        from app.crud import provider as provider_crud
        provider = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
        provider_info = {"id": provider.id, "company_name": provider.company_name} if provider else {"id": trip.provider_id, "company_name": "Unknown"}
        from app.models.trip_amenity import TripExtraFee
        extra_fees = session.query(TripExtraFee).filter(TripExtraFee.trip_id == trip.id).all()
        return _build_trip_read(session, trip, provider_info, extra_fees)
    except Exception as e:
        logger.error(f"Error creating trip: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=List[TripRead])
def read_trips(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_provider),
    search: Optional[str] = None,
    start_date_from: Optional[str] = None,
    start_date_to: Optional[str] = None,
    end_date_from: Optional[str] = None,
    end_date_to: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_participants: Optional[int] = None,
    max_participants: Optional[int] = None,
    min_rating: Optional[float] = None,
    is_active: Optional[bool] = None,
):
    """Retrieve and filter trips for the current provider."""
    from datetime import datetime, timezone
    from decimal import Decimal

    def _parse_search_date(s: str) -> datetime:
        """Parse an ISO date string from the client and return naive UTC.
        Offset-aware strings are converted to UTC then stripped.
        Naive strings are assumed to already be UTC (client sent toISOString())."""
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is not None:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt

    # Parse date strings to naive UTC datetime objects
    start_date_from_dt = _parse_search_date(start_date_from) if start_date_from else None
    start_date_to_dt = _parse_search_date(start_date_to) if start_date_to else None
    end_date_from_dt = _parse_search_date(end_date_from) if end_date_from else None
    end_date_to_dt = _parse_search_date(end_date_to) if end_date_to else None
    
    # Convert price to Decimal
    min_price_decimal = Decimal(str(min_price)) if min_price is not None else None
    max_price_decimal = Decimal(str(max_price)) if max_price is not None else None
    
    trips = crud.trip.search_and_filter_trips(
        session=session,
        provider_id=current_user.provider_id,
        search_query=search,
        start_date_from=start_date_from_dt,
        start_date_to=start_date_to_dt,
        end_date_from=end_date_from_dt,
        end_date_to=end_date_to_dt,
        min_price=min_price_decimal,
        max_price=max_price_decimal,
        min_participants=min_participants,
        max_participants=max_participants,
        min_rating=min_rating,
        is_active=is_active,
        skip=skip,
        limit=limit
    )
    
    trips_with_packages = []
    for trip in trips:
        from app.crud import provider as provider_crud
        _prov = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
        _pinfo = {"id": _prov.id, "company_name": _prov.company_name} if _prov else {"id": trip.provider_id, "company_name": "Unknown"}
        trips_with_packages.append(_build_trip_read(session, trip, _pinfo, []))
    return trips_with_packages


# Available Fields Endpoint
@router.get("/available-fields", response_model=AvailableFieldsResponse)
def get_available_package_fields(
    current_user: User = Depends(get_current_active_provider),
    accept_language: Optional[str] = Header(default="en", alias="Accept-Language"),
):
    """Get all available field types with metadata for trip package creation."""
    lang = "ar" if (accept_language or "en").startswith("ar") else "en"
    fields = []

    for field_type in TripFieldType:
        metadata = FIELD_METADATA.get(field_type, {})

        # Convert options if they exist
        options = None
        if "options" in metadata:
            options = [
                FieldOption(
                    value=opt["value"],
                    label=opt["label_ar"] if lang == "ar" and opt.get("label_ar") else opt["label"],
                    label_ar=opt.get("label_ar"),
                )
                for opt in metadata["options"]
            ]

        display_name = (
            metadata.get("display_name_ar") if lang == "ar" and metadata.get("display_name_ar")
            else metadata.get("display_name", field_type.value.replace("_", " ").title())
        )
        placeholder = (
            metadata.get("placeholder_ar") if lang == "ar" and metadata.get("placeholder_ar")
            else metadata.get("placeholder")
        )

        field_metadata = FieldMetadata(
            field_name=field_type,
            display_name=display_name,
            display_name_ar=metadata.get("display_name_ar"),
            ui_type=metadata.get("ui_type", "text"),
            placeholder=placeholder,
            placeholder_ar=metadata.get("placeholder_ar"),
            required=metadata.get("required", True),
            options=options,
            available_validations=metadata.get("available_validations", [])
        )
        fields.append(field_metadata)

    return AvailableFieldsResponse(fields=fields)


@router.get("/registrations/{registration_id}", response_model=TripRegistration)
def get_my_registration(
    *,
    session: Session = Depends(get_session),
    registration_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
):
    """Get a specific registration by ID (must belong to current user)."""
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from app.models.trip import Trip as TripModel
    from app.models.provider import Provider as ProviderModel
    from app.schemas.trip_registration import RegistrationTripInfo

    registration = session.get(TripRegistrationModel, registration_id)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    if registration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    trip = registration.trip or session.get(TripModel, registration.trip_id)
    provider = (trip.provider if trip else None) or (session.get(ProviderModel, trip.provider_id) if trip else None)

    trip_info = RegistrationTripInfo(
        id=trip.id,
        name_en=trip.name_en,
        name_ar=trip.name_ar,
        description_en=trip.description_en,
        description_ar=trip.description_ar,
        start_date=trip.start_date,
        end_date=trip.end_date,
        provider_id=trip.provider_id,
        trip_reference=trip.trip_reference,
        provider={"id": str(provider.id), "company_name": provider.company_name} if provider else {"id": str(trip.provider_id), "company_name": "Unknown"},
    )

    from app.schemas.trip_registration import TripRegistration as TripRegistrationSchema
    return TripRegistrationSchema(
        id=registration.id,
        trip_id=registration.trip_id,
        user_id=registration.user_id,
        total_participants=registration.total_participants,
        total_amount=registration.total_amount,
        status=registration.status,
        registration_date=registration.registration_date,
        spot_reserved_until=registration.spot_reserved_until,
        booking_reference=registration.booking_reference,
        participants=list(registration.participants or []),
        trip=trip_info,
    )


@router.get("/all", response_model=List[TripRead])
def list_all_trips(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    provider_name: Optional[str] = None,
    start_date_from: Optional[str] = None,
    start_date_to: Optional[str] = None,
    end_date_from: Optional[str] = None,
    end_date_to: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_participants: Optional[int] = None,
    max_participants: Optional[int] = None,
    min_rating: Optional[float] = None,
    is_active: Optional[bool] = True,
):
    """Retrieve and filter all trips (public endpoint for mobile app)."""
    from datetime import datetime, timezone
    from decimal import Decimal

    def _parse_search_date(s: str) -> datetime:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is not None:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt

    # Parse date strings to naive UTC datetime objects
    start_date_from_dt = _parse_search_date(start_date_from) if start_date_from else None
    start_date_to_dt = _parse_search_date(start_date_to) if start_date_to else None
    end_date_from_dt = _parse_search_date(end_date_from) if end_date_from else None
    end_date_to_dt = _parse_search_date(end_date_to) if end_date_to else None
    
    # Convert price to Decimal
    min_price_decimal = Decimal(str(min_price)) if min_price is not None else None
    max_price_decimal = Decimal(str(max_price)) if max_price is not None else None
    
    trips = crud.trip.search_and_filter_trips(
        session=session,
        provider_id=None,  # No provider filter for public endpoint
        provider_name=provider_name,
        search_query=search,
        start_date_from=start_date_from_dt,
        start_date_to=start_date_to_dt,
        end_date_from=end_date_from_dt,
        end_date_to=end_date_to_dt,
        min_price=min_price_decimal,
        max_price=max_price_decimal,
        min_participants=min_participants,
        max_participants=max_participants,
        min_rating=min_rating,
        is_active=is_active,
        skip=skip,
        limit=limit
    )
    
    trips_with_packages = []
    for trip in trips:
        from app.crud import provider as provider_crud
        _prov = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
        _pinfo = {"id": _prov.id, "company_name": _prov.company_name} if _prov else {"id": trip.provider_id, "company_name": "Unknown"}
        trips_with_packages.append(_build_trip_read(session, trip, _pinfo, []))
    return trips_with_packages


@router.get("/{trip_id}", response_model=TripRead)
def read_trip(
    *, 
    session: Session = Depends(get_session), 
    trip_id: uuid.UUID, 
    current_user: User = Depends(get_current_active_provider)
):
    """Retrieve a specific trip by ID."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    from app.crud import provider as provider_crud
    provider = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
    provider_info = {"id": provider.id, "company_name": provider.company_name} if provider else {"id": trip.provider_id, "company_name": "Unknown"}
    from app.models.trip_amenity import TripExtraFee
    extra_fees = session.query(TripExtraFee).filter(TripExtraFee.trip_id == trip_id).all()
    return _build_trip_read(session, trip, provider_info, extra_fees)


@router.put("/{trip_id}", response_model=TripRead)
def update_trip(
    *, 
    session: Session = Depends(get_session), 
    trip_id: uuid.UUID, 
    trip_in: TripUpdate,
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Update a trip."""
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from app.models.payment import Payment, PaymentStatus
    from sqlmodel import select as sql_select

    db_trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not db_trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if db_trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    trip_changes = _filter_trip_update_changes(session, db_trip, trip_in)
    trip_in = TripUpdate(**trip_changes)

    if "is_refundable" in trip_changes:
        raise HTTPException(
            status_code=400,
            detail="Refundability cannot be changed after a trip is published. "
                   "Users may have booked based on the original refund policy.",
        )

    # Check whether any paid payment exists across ALL non-cancelled registrations for this trip.
    # We do this as a single join-like query to avoid false negatives when the first
    # registration is pending_payment but another has a completed payment.
    has_active_paid_bookings = session.exec(
        sql_select(Payment).join(
            TripRegistrationModel,
            Payment.registration_id == TripRegistrationModel.id,
        ).where(
            TripRegistrationModel.trip_id == trip_id,
            TripRegistrationModel.status != "cancelled",
            Payment.status == PaymentStatus.PAID,
        )
    ).first() is not None

    if has_active_paid_bookings:
        # Rule: Cannot edit content fields when paid participants exist.
        # Only allow non-material edits like images or trip_metadata.
        _MATERIAL_FIELDS = {
            "name_en", "name_ar", "description_en", "description_ar",
            "start_date", "end_date", "registration_deadline", "max_participants",
            "trip_type", "is_packaged_trip", "timezone",
            "has_meeting_place", "meeting_place_name", "meeting_place_name_ar",
            "meeting_location", "price", "amenities",
            "starting_city_id", "is_international",
        }
        attempted = set(trip_changes.keys()) & _MATERIAL_FIELDS
        if attempted:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This trip has active paid bookings. "
                    "Material trip details cannot be changed once participants have booked. "
                    "To change the trip, cancel it first (all participants will be refunded)."
                ),
            )

        # Rule: Cannot deactivate a trip that has paid participants.
        if trip_in.is_active is False:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Cannot deactivate a trip that has active paid bookings. "
                    "Use the cancel-trip endpoint to cancel the trip and refund all participants."
                ),
            )

    trip = crud.trip.update_trip(session=session, db_trip=db_trip, trip_in=trip_in)
    if not trip.name_en and not trip.name_ar:
        raise HTTPException(status_code=400, detail="At least one of name_en or name_ar must be provided")
    if not trip.description_en and not trip.description_ar:
        raise HTTPException(status_code=400, detail="At least one of description_en or description_ar must be provided")
    if not trip.is_packaged_trip:
        _sync_hidden_package(
            session, trip,
            price=trip_in.price,
            is_refundable=trip_in.is_refundable,
            amenities=trip_in.amenities,
        )
        session.refresh(trip)
    from app.crud import provider as provider_crud
    provider = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
    provider_info = {"id": provider.id, "company_name": provider.company_name} if provider else {"id": trip.provider_id, "company_name": "Unknown"}
    from app.models.trip_amenity import TripExtraFee
    extra_fees = session.query(TripExtraFee).filter(TripExtraFee.trip_id == trip_id).all()
    return _build_trip_read(session, trip, provider_info, extra_fees)


@router.delete("/{trip_id}")
def delete_trip(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Delete a trip. Blocked when paid active registrations exist — use cancel-trip instead."""
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from app.models.payment import Payment, PaymentStatus
    from sqlmodel import select as sql_select

    db_trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not db_trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if db_trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Rule: Cannot delete a trip that has active paid participants.
    # Provider must cancel the trip (which refunds everyone) instead.
    # Check across ALL non-cancelled registrations, not just the first one.
    has_active_paid_bookings_for_delete = session.exec(
        sql_select(Payment).join(
            TripRegistrationModel,
            Payment.registration_id == TripRegistrationModel.id,
        ).where(
            TripRegistrationModel.trip_id == trip_id,
            TripRegistrationModel.status != "cancelled",
            Payment.status == PaymentStatus.PAID,
        )
    ).first() is not None
    if has_active_paid_bookings_for_delete:
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot delete a trip that has active paid bookings. "
                "Use the cancel-trip endpoint instead — this will refund all participants "
                "and notify them of the cancellation."
            ),
        )

    crud.trip.delete_trip(session=session, db_trip=db_trip)
    return {"ok": True}


@router.post("/{trip_id}/join", response_model=TripRead)
def join_trip(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
):
    """Join a trip."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    trip = crud.trip.add_user_to_trip(session=session, db_trip=trip, user=current_user)
    return trip


@router.post("/{trip_id}/leave", response_model=TripRead)
def leave_trip(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
):
    """Leave a trip."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    trip = crud.trip.remove_user_from_trip(session=session, db_trip=trip, user=current_user)
    return trip


# @router.post("/{trip_id}/rate", response_model=TripRead)
# def rate_trip(
#     *,
#     session: Session = Depends(get_session),
#     trip_id: uuid.UUID,
#     rating_in: TripRatingCreate,
#     current_user: User = Depends(get_current_active_user),
# ):
#     """Rate a trip."""
#     try:
#         trip = crud.trip.get_trip(session=session, trip_id=trip_id)
#         if not trip:
#             raise HTTPException(status_code=404, detail="Trip not found")
#         trip = crud.trip.rate_trip(
#             session=session, db_trip=trip, rating_in=rating_in, user=current_user
#         )
#         return trip
#     except Exception as e:
#         logger.error(f"Error rating trip: {e}", exc_info=True)
#         raise HTTPException(status_code=500, detail=str(e))


# Note: Required fields are now managed at the package level via TripPackageRequiredField
# See package endpoints below for field management


def _validate_tier_participant_totals(
    session,
    trip_id: uuid.UUID,
    trip_max: int,
    exclude_package_id=None,
    override_package_max: dict = None,
):
    """
    Validate that, if ALL active packages have a max_participants value,
    their sum equals the trip's max_participants.
    override_package_max is {package_id: new_value} for the package being created/updated.
    """
    from app.models.trip_package import TripPackage as TripPackageModel
    packages = session.query(TripPackageModel).filter(
        TripPackageModel.trip_id == trip_id,
        TripPackageModel.is_active == True,  # noqa: E712
    ).all()

    # Include the new package being created (not yet in DB)
    if override_package_max:
        # Build effective list: replace/add values from override
        effective = []
        for p in packages:
            if str(p.id) == str(exclude_package_id):
                val = override_package_max.get(str(p.id))
            else:
                val = p.max_participants
            effective.append(val)
        # If this is a brand-new package (not yet in DB), add its value
        if exclude_package_id is None and None not in (list(override_package_max.values())):
            for v in override_package_max.values():
                effective.append(v)
    else:
        effective = [p.max_participants for p in packages]

    # Only validate when there are 2+ packages and every package has a value
    if all(v is not None and v > 0 for v in effective) and len(effective) >= 2:
        total = sum(effective)
        if total != trip_max:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Sum of tier max_participants ({total}) must equal "
                    f"the trip's max_participants ({trip_max}). "
                    f"Please adjust tier capacities."
                ),
            )


# Trip Packages Endpoints
@router.post("/{trip_id}/packages", response_model=TripPackageWithRequiredFields)
def create_trip_package(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    package_in: TripPackageCreate,
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Create a package for a trip."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if _trip_has_active_paid_bookings(session, trip_id):
        _raise_paid_booking_material_change_error()

    # Validate tier participant total if this new package provides max_participants
    if package_in.max_participants is not None and trip.is_packaged_trip:
        _validate_tier_participant_totals(
            session=session,
            trip_id=trip_id,
            trip_max=trip.max_participants,
            exclude_package_id=None,
            override_package_max={"__new__": package_in.max_participants},
        )
    
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    # Create package without required_fields
    package_data = package_in.model_dump(exclude={"required_fields"})
    package = TripPackageModel(trip_id=trip_id, **package_data)
    session.add(package)
    session.commit()
    session.refresh(package)
    
    # Add required fields - always include NAME and DATE_OF_BIRTH, plus any additional fields
    from app.models.trip_field import TripFieldType
    mandatory_fields = {TripFieldType.NAME, TripFieldType.DATE_OF_BIRTH}
    
    # Start with mandatory fields
    required_fields_to_add = set(mandatory_fields)
    
    # Add any additional fields provided by user
    if package_in.required_fields:
        required_fields_to_add.update(package_in.required_fields)
    
    # Convert back to list
    required_fields_to_add = list(required_fields_to_add)
    
    for field_type in required_fields_to_add:
        required_field = TripPackageRequiredField(
            package_id=package.id, 
            field_type=field_type
        )
        session.add(required_field)
    session.commit()
    session.refresh(trip)
    crud.trip.recompute_content_hash(session=session, trip=trip)

    # Get required fields for response
    required_fields = session.query(TripPackageRequiredField).filter(
        TripPackageRequiredField.package_id == package.id
    ).all()
    required_field_types = [rf.field_type.value for rf in required_fields]
    
    # Create response with required fields
    return TripPackageWithRequiredFields(
        id=package.id,
        trip_id=package.trip_id,
        name_en=package.name_en,
        name_ar=package.name_ar,
        description_en=package.description_en,
        description_ar=package.description_ar,
        price=package.price,
        is_active=package.is_active,
        required_fields=required_field_types
    )


@router.get("/{trip_id}/packages", response_model=List[TripPackageWithRequiredFields])
def get_trip_packages(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
):
    """Get packages for a trip."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    packages = session.query(TripPackageModel).filter(
        TripPackageModel.trip_id == trip_id,
        TripPackageModel.is_active == True
    ).all()
    
    # Create response with required_fields for each package
    response_packages = []
    for package in packages:
        required_fields = session.query(TripPackageRequiredField).filter(
            TripPackageRequiredField.package_id == package.id
        ).all()
        required_field_types = [rf.field_type.value for rf in required_fields]
        
        response_packages.append(TripPackageWithRequiredFields(
            id=package.id,
            trip_id=package.trip_id,
            name_en=package.name_en,
            name_ar=package.name_ar,
            description_en=package.description_en,
            description_ar=package.description_ar,
            price=package.price,
            is_active=package.is_active,
            required_fields=required_field_types
        ))
    
    return response_packages


@router.put("/{trip_id}/packages/{package_id}", response_model=TripPackageWithRequiredFields)
def update_trip_package(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    package_id: uuid.UUID,
    package_in: TripPackageUpdate,
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Update a trip package."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    package = session.query(TripPackageModel).filter(
        TripPackageModel.id == package_id,
        TripPackageModel.trip_id == trip_id
    ).first()
    
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    package_changes = _filter_package_update_changes(package, package_in)
    required_fields_changed = False
    if package_in.required_fields is not None:
        required_fields_changed = (
            _get_package_required_fields_state(package)
            != _desired_required_fields_state(package_in.required_fields)
        )

    if "is_refundable" in package_changes:
        raise HTTPException(
            status_code=400,
            detail="Refundability cannot be changed after a trip is published. "
                   "Users may have booked based on the original refund policy.",
        )

    if _trip_has_active_paid_bookings(session, trip_id) and (package_changes or required_fields_changed):
        _raise_paid_booking_material_change_error()

    # Validate tier participant total if max_participants is being updated
    if "max_participants" in package_changes and trip.is_packaged_trip:
        _validate_tier_participant_totals(
            session=session,
            trip_id=trip_id,
            trip_max=trip.max_participants,
            exclude_package_id=package_id,
            override_package_max={str(package_id): package_changes["max_participants"]},
        )

    # Update package fields (excluding required_fields)
    for field, value in package_changes.items():
        setattr(package, field, value)

    # Validate that at least one name and one description remain after patch
    if not package.name_en and not package.name_ar:
        raise HTTPException(status_code=400, detail="At least one of name_en or name_ar must be provided")
    if not package.description_en and not package.description_ar:
        raise HTTPException(status_code=400, detail="At least one of description_en or description_ar must be provided")
    
    # Update required fields if provided
    if package_in.required_fields is not None and required_fields_changed:
        # Clear existing required fields
        session.query(TripPackageRequiredField).filter(
            TripPackageRequiredField.package_id == package_id
        ).delete()
        
        # Always include mandatory fields
        from app.models.trip_field import TripFieldType
        mandatory_fields = {TripFieldType.NAME, TripFieldType.DATE_OF_BIRTH}
        
        # Start with mandatory fields
        required_fields_to_add = set(mandatory_fields)
        
        # Add any additional fields provided by user
        required_fields_to_add.update(package_in.required_fields)
        
        # Add new required fields
        for field_type in required_fields_to_add:
            required_field = TripPackageRequiredField(
                package_id=package_id, 
                field_type=field_type
            )
            session.add(required_field)
    
    if package_changes or required_fields_changed:
        session.commit()
        session.refresh(package)
        session.refresh(trip)
        crud.trip.recompute_content_hash(session=session, trip=trip)
    else:
        session.refresh(package)
        session.refresh(trip)

    # Get required fields for response
    required_fields = session.query(TripPackageRequiredField).filter(
        TripPackageRequiredField.package_id == package.id
    ).all()
    required_field_types = [rf.field_type.value for rf in required_fields]
    
    # Create response with required fields
    return TripPackageWithRequiredFields(
        id=package.id,
        trip_id=package.trip_id,
        name_en=package.name_en,
        name_ar=package.name_ar,
        description_en=package.description_en,
        description_ar=package.description_ar,
        price=package.price,
        is_active=package.is_active,
        required_fields=required_field_types
    )


@router.delete("/{trip_id}/packages/{package_id}", status_code=204)
def delete_trip_package(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    package_id: uuid.UUID,
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Deactivate a trip package. Blocks if it would leave fewer than 2 active packages."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if not trip.is_packaged_trip:
        raise HTTPException(status_code=400, detail="Cannot remove packages from a non-packaged trip")

    from app.models.trip_package import TripPackage as TripPackageModel

    package = session.query(TripPackageModel).filter(
        TripPackageModel.id == package_id,
        TripPackageModel.trip_id == trip_id,
    ).first()
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    if _trip_has_active_paid_bookings(session, trip_id):
        _raise_paid_booking_material_change_error()

    active_count = session.query(TripPackageModel).filter(
        TripPackageModel.trip_id == trip_id,
        TripPackageModel.is_active == True,
    ).count()
    if active_count <= 2:
        raise HTTPException(
            status_code=400,
            detail="A packaged trip must have at least 2 packages. Add another package before removing this one.",
        )

    package.is_active = False
    session.add(package)
    session.commit()
    session.refresh(trip)
    crud.trip.recompute_content_hash(session=session, trip=trip)


# Trip Package Required Fields Endpoints
@router.post("/{trip_id}/packages/{package_id}/required-fields")
def set_package_required_fields(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    package_id: uuid.UUID,
    field_types: List[TripFieldType],
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Set required fields for a trip package (legacy endpoint)."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    # Verify package exists and belongs to trip
    package = session.query(TripPackageModel).filter(
        TripPackageModel.id == package_id,
        TripPackageModel.trip_id == trip_id
    ).first()
    
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    if _trip_has_active_paid_bookings(session, trip_id):
        if _get_package_required_fields_state(package) != _desired_required_fields_state(field_types):
            _raise_paid_booking_material_change_error()
    
    # Clear existing required fields
    session.query(TripPackageRequiredField).filter(
        TripPackageRequiredField.package_id == package_id
    ).delete()
    
    # Always include mandatory fields
    from app.models.trip_field import TripFieldType
    mandatory_fields = {TripFieldType.NAME, TripFieldType.DATE_OF_BIRTH}
    
    # Start with mandatory fields
    required_fields_to_add = set(mandatory_fields)
    
    # Add any additional fields provided by user
    required_fields_to_add.update(field_types)
    
    # Add new required fields
    for field_type in required_fields_to_add:
        required_field = TripPackageRequiredField(package_id=package_id, field_type=field_type)
        session.add(required_field)
    
    session.commit()
    session.refresh(trip)
    crud.trip.recompute_content_hash(session=session, trip=trip)
    return {"message": "Required fields updated successfully"}


@router.post("/{trip_id}/packages/{package_id}/required-fields-with-validation")
def set_package_required_fields_with_validation(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    package_id: uuid.UUID,
    request: TripPackageRequiredFieldsSetWithValidation,
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Set required fields with validation configurations for a trip package."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    # Verify package exists and belongs to trip
    package = session.query(TripPackageModel).filter(
        TripPackageModel.id == package_id,
        TripPackageModel.trip_id == trip_id
    ).first()
    
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    if _trip_has_active_paid_bookings(session, trip_id):
        if _get_package_required_fields_state(package) != _desired_required_fields_state_with_validation(request.required_fields):
            _raise_paid_booking_material_change_error()
    
    # Validate all validation configs before proceeding
    validation_errors = []
    for field_config in request.required_fields:
        if field_config.validation_config:
            errors = validate_validation_config(field_config.field_type, field_config.validation_config)
            if errors:
                validation_errors.extend([f"{field_config.field_type.value}: {error}" for error in errors])
    
    if validation_errors:
        raise HTTPException(
            status_code=400, 
            detail=f"Validation configuration errors: {'; '.join(validation_errors)}"
        )
    
    # Clear existing required fields
    session.query(TripPackageRequiredField).filter(
        TripPackageRequiredField.package_id == package_id
    ).delete()
    
    # Always include mandatory fields
    mandatory_fields = {TripFieldType.NAME, TripFieldType.DATE_OF_BIRTH}
    
    # Collect all field types to add
    fields_to_add = {}
    
    # Add mandatory fields first
    for field_type in mandatory_fields:
        fields_to_add[field_type] = {}
    
    # Add user-specified fields with their validation configs
    for field_config in request.required_fields:
        fields_to_add[field_config.field_type] = field_config.validation_config or {}
    
    # Add new required fields with validation configs
    for field_type, validation_config in fields_to_add.items():
        required_field = TripPackageRequiredField(
            package_id=package_id, 
            field_type=field_type,
            validation_config=validation_config if validation_config else None
        )
        session.add(required_field)
    
    session.commit()
    session.refresh(trip)
    crud.trip.recompute_content_hash(session=session, trip=trip)
    return {"message": "Required fields with validation configurations updated successfully"}


@router.get("/{trip_id}/packages/{package_id}/required-fields", response_model=TripPackageRequiredFieldsResponse)
def get_package_required_fields(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    package_id: uuid.UUID,
):
    """Get required fields for a trip package."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    # Verify package exists and belongs to trip
    package = session.query(TripPackageModel).filter(
        TripPackageModel.id == package_id,
        TripPackageModel.trip_id == trip_id
    ).first()
    
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    required_fields = session.query(TripPackageRequiredField).filter(
        TripPackageRequiredField.package_id == package_id
    ).all()
    
    return TripPackageRequiredFieldsResponse(package_id=package_id, required_fields=required_fields)


# Trip Registration Endpoints
@router.post("/{trip_id}/validate-registration", status_code=200)
async def validate_registration(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    registration_in: TripRegistrationCreate,
    current_user: User = Depends(get_current_active_user),
    accept_language: Optional[str] = Header(default="en", alias="Accept-Language"),
):
    """Dry-run validation of registration payload. Returns 200 if valid, 400 with structured error if not."""
    _lang = (accept_language or "en").split(",")[0].split(";")[0].strip()[:2].lower()
    _reg_lang = _lang if _lang in ("ar", "en") else "en"

    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField

    if not registration_in.participants:
        raise HTTPException(status_code=400, detail={"code": "no_participants", "messages": ["At least one participant is required"]})

    # For non-packaged trips, auto-assign the hidden package (same as register_for_trip)
    any_has_package = any(p.package_id for p in registration_in.participants)
    if not any_has_package:
        hidden_pkg = session.query(TripPackageModel).filter(
            TripPackageModel.trip_id == trip_id
        ).first()
        if hidden_pkg:
            for participant in registration_in.participants:
                participant.package_id = hidden_pkg.id

    for idx, participant in enumerate(registration_in.participants):
        if not participant.package_id:
            continue
        package = session.query(TripPackageModel).filter(
            TripPackageModel.id == participant.package_id,
            TripPackageModel.trip_id == trip_id,
        ).first()
        if not package:
            raise HTTPException(status_code=400, detail=f"Package {participant.package_id} not found for this trip")

        required_fields = session.query(TripPackageRequiredField).filter(
            TripPackageRequiredField.package_id == participant.package_id
        ).all()

        for required_field in required_fields:
            field_type = required_field.field_type
            field_value = getattr(participant, field_type.value, None)

            if required_field.is_required and (field_value is None or (isinstance(field_value, str) and not field_value.strip())):
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "required_field_missing",
                        "field": field_type.value,
                        "package": get_name(package),
                        "participant_index": idx,
                    }
                )

            if field_value:
                field_str = field_value.value if hasattr(field_value, 'value') else str(field_value)
                validation_errors = validate_field_value(field_type, field_str, required_field.validation_config, lang=_reg_lang)
                if validation_errors:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "code": "field_validation_failed",
                            "field": field_type.value,
                            "package": get_name(package),
                            "participant_index": idx,
                            "messages": validation_errors,
                        }
                    )

    return {"valid": True}


@router.post("/{trip_id}/register", response_model=TripRegistration)
async def register_for_trip(
    *,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    registration_in: TripRegistrationCreate,
    current_user: User = Depends(get_current_active_user),
    accept_language: Optional[str] = Header(default="en", alias="Accept-Language"),
):
    """Register for a trip with multiple participants."""
    from datetime import datetime, timedelta, timezone
    _reg_lang = "ar" if (accept_language or "en").startswith("ar") else "en"
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Guard: trip must be active
    if not trip.is_active:
        raise HTTPException(status_code=400, detail="This trip is no longer available for booking")

    # Guard: trip must not have started yet
    if trip.start_date <= datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="This trip has already started or passed")

    # Guard: trip content_hash must match what the client last read.
    # If the provider changed trip details since the user opened the trip page,
    # we reject the booking so the user sees the updated information first.
    if registration_in.trip_content_hash is not None and trip.content_hash is not None:
        if registration_in.trip_content_hash != trip.content_hash:
            raise HTTPException(
                status_code=409,
                detail=(
                    "The trip details have been updated since you last viewed this trip. "
                    "Please review the updated information and try booking again."
                ),
            )

    # Guard: user must not already have an active registration for this trip
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from sqlmodel import select as sql_select
    _ACTIVE_STATUSES = ["pending_payment", "awaiting_provider", "processing", "confirmed"]
    existing_user_reg_stmt = sql_select(TripRegistrationModel).where(
        TripRegistrationModel.trip_id == trip_id,
        TripRegistrationModel.user_id == current_user.id,
        TripRegistrationModel.status.in_(_ACTIVE_STATUSES),
    )
    existing_user_reg = session.exec(existing_user_reg_stmt).first()
    if existing_user_reg:
        raise HTTPException(
            status_code=400,
            detail="You already have an active registration for this trip. Check your bookings."
        )

    # Guard: trip must not be full (count all active registrations)
    confirmed_count_stmt = sql_select(TripRegistrationModel).where(
        TripRegistrationModel.trip_id == trip_id,
        TripRegistrationModel.status.in_(_ACTIVE_STATUSES),
    )
    existing_regs = session.exec(confirmed_count_stmt).all()
    booked_participants = sum(r.total_participants for r in existing_regs)
    if booked_participants + registration_in.total_participants > trip.max_participants:
        available = trip.max_participants - booked_participants
        raise HTTPException(
            status_code=400,
            detail=f"Not enough spots available. Only {available} spot(s) left."
        )

    # Guard: per-package spot check for packaged trips
    if trip.is_packaged_trip:
        from app.models.trip_package import TripPackage as TripPackageModel
        from app.models.trip_registration import TripRegistrationParticipant as TripParticipantModel
        from collections import Counter
        pkg_counts = Counter(
            p.package_id for p in registration_in.participants if p.package_id
        )
        for pkg_id, requested in pkg_counts.items():
            pkg = session.query(TripPackageModel).filter(
                TripPackageModel.id == pkg_id,
                TripPackageModel.trip_id == trip_id,
                TripPackageModel.is_active == True,
            ).first()
            if not pkg:
                raise HTTPException(status_code=400, detail=f"Package {pkg_id} not found or inactive")
            if pkg.max_participants is not None:
                booked_in_pkg = (
                    session.query(TripParticipantModel)
                    .join(TripRegistrationModel, TripParticipantModel.registration_id == TripRegistrationModel.id)
                    .filter(
                        TripParticipantModel.package_id == pkg_id,
                        TripRegistrationModel.status.in_(_ACTIVE_STATUSES),
                    )
                    .count()
                )
                pkg_available = pkg.max_participants - booked_in_pkg
                if requested > pkg_available:
                    pkg_name = pkg.name_en or pkg.name_ar or str(pkg_id)
                    raise HTTPException(
                        status_code=400,
                        detail=f"Package '{pkg_name}' only has {pkg_available} spot(s) left."
                    )

    # Validate is_registration_user field - only one participant can have it set to True
    registration_user_count = sum(1 for p in registration_in.participants if p.is_registration_user)
    if registration_user_count > 1:
        raise HTTPException(
            status_code=400, 
            detail="Only one participant can be marked as the registration user (is_registration_user=True)"
        )
    
    # For non-packaged trips, auto-assign the hidden package to all participants
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField

    if not trip.is_packaged_trip:
        hidden_pkg = session.query(TripPackageModel).filter(
            TripPackageModel.trip_id == trip_id
        ).first()
        if hidden_pkg:
            for participant in registration_in.participants:
                if not participant.package_id:
                    participant.package_id = hidden_pkg.id

    # Validate that all required fields are provided for each participant based on their package
    for participant in registration_in.participants:
        if participant.package_id:
            # Verify package exists and belongs to trip
            package = session.query(TripPackageModel).filter(
                TripPackageModel.id == participant.package_id,
                TripPackageModel.trip_id == trip_id
            ).first()
            
            if not package:
                raise HTTPException(status_code=400, detail=f"Package {participant.package_id} not found for this trip")
            
            # Get required fields for this package
            required_fields = session.query(TripPackageRequiredField).filter(
                TripPackageRequiredField.package_id == participant.package_id
            ).all()
            required_field_types = [rf.field_type.value for rf in required_fields]
            
            # Validate required fields for this participant
            for required_field in required_fields:
                field_type = required_field.field_type
                field_value = getattr(participant, field_type.value, None)
                
                # Check if field is required and present
                if required_field.is_required and (field_value is None or (isinstance(field_value, str) and not field_value.strip())):
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "code": "required_field_missing",
                            "field": field_type.value,
                            "package": get_name(package),
                        }
                    )

                # Validate field value: always-on checks run for every non-empty value;
                # provider-configurable restrictions (phase 2) only run when validation_config is set.
                if field_value:
                    field_str = field_value.value if hasattr(field_value, 'value') else str(field_value)
                    validation_errors = validate_field_value(field_type, field_str, required_field.validation_config, lang=_reg_lang)
                    if validation_errors:
                        raise HTTPException(
                            status_code=400,
                            detail={
                                "code": "field_validation_failed",
                                "field": field_type.value,
                                "package": get_name(package),
                                "messages": validation_errors,
                            }
                        )
    
    # Create registration with pending_payment status and 15-min spot reservation
    from app.models.trip_registration import TripRegistration as TripRegistrationModel, TripRegistrationParticipant as TripParticipantModel
    spot_reserved_until = datetime.utcnow() + timedelta(minutes=15)
    registration = TripRegistrationModel(
        trip_id=trip_id,
        user_id=current_user.id,
        total_participants=registration_in.total_participants,
        total_amount=registration_in.total_amount,
        status="pending_payment",
        spot_reserved_until=spot_reserved_until,
    )
    session.add(registration)
    session.commit()
    session.refresh(registration)
    
    # Create participants with their individual packages
    for participant_data in registration_in.participants:
        # Create participant data with registration_user_id
        participant_dict = participant_data.model_dump()
        participant_dict['registration_user_id'] = current_user.id  # Always set to the user making the registration
        
        participant = TripParticipantModel(
            registration_id=registration.id,
            **participant_dict
        )
        session.add(participant)
    
    session.commit()
    session.refresh(registration)

    # Build enriched response (provider must be serialized as dict, not SQLModel)
    from app.models.provider import Provider as ProviderModel
    from app.schemas.trip_registration import RegistrationTripInfo, TripRegistration as TripRegistrationSchema
    provider = trip.provider or session.get(ProviderModel, trip.provider_id)
    trip_info = RegistrationTripInfo(
        id=trip.id,
        name_en=trip.name_en,
        name_ar=trip.name_ar,
        description_en=trip.description_en,
        description_ar=trip.description_ar,
        start_date=trip.start_date,
        end_date=trip.end_date,
        provider_id=trip.provider_id,
        trip_reference=trip.trip_reference,
        provider={"id": str(provider.id), "company_name": provider.company_name} if provider else {"id": str(trip.provider_id), "company_name": "Unknown"},
    )
    return TripRegistrationSchema(
        id=registration.id,
        trip_id=registration.trip_id,
        user_id=registration.user_id,
        total_participants=registration.total_participants,
        total_amount=registration.total_amount,
        status=registration.status,
        registration_date=registration.registration_date,
        spot_reserved_until=registration.spot_reserved_until,
        booking_reference=registration.booking_reference,
        participants=list(registration.participants or []),
        trip=trip_info,
    )




@router.get("/{trip_id}/registrations")
def get_trip_registrations(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Get all registrations for a trip (provider only), enriched with user info."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    from sqlmodel import select as sql_select
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from app.models.provider import Provider as ProviderModel
    from app.schemas.trip_registration import RegistrationTripInfo, TripRegistration as TripRegistrationSchema

    registrations = session.exec(
        sql_select(TripRegistrationModel).where(TripRegistrationModel.trip_id == trip_id)
    ).all()

    provider = trip.provider or session.get(ProviderModel, trip.provider_id)
    trip_info = RegistrationTripInfo(
        id=trip.id,
        name_en=trip.name_en,
        name_ar=trip.name_ar,
        description_en=trip.description_en,
        description_ar=trip.description_ar,
        start_date=trip.start_date,
        end_date=trip.end_date,
        provider_id=trip.provider_id,
        trip_reference=trip.trip_reference,
        provider={"id": str(provider.id), "company_name": provider.company_name} if provider else {"id": str(trip.provider_id), "company_name": "Unknown"},
    )

    result = []
    for reg in registrations:
        user = session.get(User, reg.user_id)
        reg_dict = TripRegistrationSchema(
            id=reg.id,
            trip_id=reg.trip_id,
            user_id=reg.user_id,
            total_participants=reg.total_participants,
            total_amount=reg.total_amount,
            status=reg.status,
            registration_date=reg.registration_date,
            spot_reserved_until=reg.spot_reserved_until,
            booking_reference=reg.booking_reference,
            participants=list(reg.participants or []),
            trip=trip_info,
        ).model_dump()
        reg_dict["user_name"] = user.name if user else None
        reg_dict["user_email"] = user.email if user else None
        reg_dict["user_phone"] = user.phone if user else None
        result.append(reg_dict)

    return result


# ── Provider Registration Status Transitions ────────────────────────────────

@router.post("/{trip_id}/registrations/{registration_id}/start-processing")
def flag_registration_processing(
    *,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    registration_id: uuid.UUID,
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """
    Provider marks a self-arranged booking as 'processing' — they have started
    booking flights/hotels for the participant.
    Allowed transition: awaiting_provider → processing
    """
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if trip.trip_type.value != "self_arranged":
        raise HTTPException(status_code=400, detail="Only self-arranged trips use the processing workflow")

    reg = session.get(TripRegistrationModel, registration_id)
    if not reg or reg.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Registration not found")
    if reg.status != "awaiting_provider":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start processing: booking is currently '{reg.status}'. Expected 'awaiting_provider'.",
        )

    reg.status = "processing"
    reg.processing_started_at = datetime.utcnow()
    session.add(reg)
    session.commit()
    session.refresh(reg)

    # Push: notify user that provider started arranging the trip
    from sqlmodel import select as sql_select
    reg_user = session.get(User, reg.user_id)
    if reg_user:
        lang = getattr(reg_user, "preferred_language", "en") or "en"
        trip_name = trip.name_en or trip.name_ar or ""
        tokens = [pt.token for pt in session.exec(sql_select(UserPushToken).where(UserPushToken.user_id == reg_user.id)).all()]
        for token in tokens:
            background_tasks.add_task(
                fcm_service.notify_registration_processing,
                fcm_token=token, trip_name=trip_name, lang=lang, registration_id=str(reg.id),
            )

    return {"id": str(reg.id), "status": reg.status, "processing_started_at": reg.processing_started_at}


@router.post("/{trip_id}/registrations/{registration_id}/confirm-processing")
def flag_registration_confirmed(
    *,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    registration_id: uuid.UUID,
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """
    Provider marks a self-arranged booking as 'confirmed' — all arrangements
    (flights, hotels, etc.) are fully booked for the participant.
    Allowed transition: processing → confirmed
    """
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if trip.trip_type.value != "self_arranged":
        raise HTTPException(status_code=400, detail="Only self-arranged trips use the processing workflow")

    reg = session.get(TripRegistrationModel, registration_id)
    if not reg or reg.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Registration not found")
    if reg.status != "processing":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot confirm: booking is currently '{reg.status}'. Expected 'processing'.",
        )

    reg.status = "confirmed"
    session.add(reg)
    session.commit()
    session.refresh(reg)

    # Push: notify user that all arrangements are complete
    from sqlmodel import select as sql_select
    reg_user = session.get(User, reg.user_id)
    if reg_user:
        lang = getattr(reg_user, "preferred_language", "en") or "en"
        trip_name = trip.name_en or trip.name_ar or ""
        tokens = [pt.token for pt in session.exec(sql_select(UserPushToken).where(UserPushToken.user_id == reg_user.id)).all()]
        for token in tokens:
            background_tasks.add_task(
                fcm_service.notify_registration_confirmed,
                fcm_token=token, trip_name=trip_name, lang=lang, registration_id=str(reg.id),
            )

    return {"id": str(reg.id), "status": reg.status}


# ── Cancellation & Refund Endpoints ─────────────────────────────────────────


class UserCancelRequest(BaseModel):
    reason: Optional[str] = None


class AdminCancelBookingRequest(BaseModel):
    refund_percentage_override: Optional[int] = None  # None = auto (use policy); or 0, 50, 100
    reason: Optional[str] = None


class ProviderCancelTripRequest(BaseModel):
    reason: Optional[str] = None


class AdminCancelTripRequest(BaseModel):
    reason: Optional[str] = None


async def _execute_refund_and_record(
    session,
    registration,
    decision,
    cancelled_by: str,
    actor_user_id,
    reason: Optional[str],
):
    """Apply refund via Moyasar (if amount > 0), record in RefundRecord, update registration."""
    from app.models.payment import Payment, PaymentStatus
    from app.models.refund_record import RefundRecord
    from app.services.moyasar import payment_service
    from sqlmodel import select as sql_select
    from datetime import datetime

    now = datetime.utcnow()

    # Find the paid payment for this registration
    paid_payment = session.exec(
        sql_select(Payment).where(
            Payment.registration_id == registration.id,
            Payment.status == PaymentStatus.PAID,
        )
    ).first()

    moyasar_refund_response = None
    refund_succeeded = False

    # Determine actual refund amount — 0 if no paid payment exists (booking was never charged)
    from decimal import Decimal as _Decimal
    actual_refund_amount = decision.refund_amount if paid_payment else _Decimal("0.00")
    actual_refund_pct = decision.refund_percentage if paid_payment else 0
    actual_rule = decision.refund_rule if paid_payment else "no_payment_found"

    if decision.eligible and paid_payment and paid_payment.moyasar_payment_id:
        try:
            result = await payment_service.refund_payment(
                payment_id=paid_payment.moyasar_payment_id,
                amount=actual_refund_amount,
                description=f"Cancellation refund: {actual_rule}",
            )
            moyasar_refund_response = str(result)
            paid_payment.refunded = True
            paid_payment.refunded_amount = actual_refund_amount
            paid_payment.refunded_at = now
            paid_payment.status = PaymentStatus.REFUNDED
            session.add(paid_payment)
            refund_succeeded = True
        except Exception as exc:
            logger.error(f"Moyasar refund failed for registration {registration.id}: {exc}")
            moyasar_refund_response = str(exc)
            refund_succeeded = False
    elif not paid_payment:
        # Booking was never paid — nothing to refund, just cancel cleanly
        refund_succeeded = True

    record = RefundRecord(
        registration_id=registration.id,
        payment_id=paid_payment.id if paid_payment else None,
        moyasar_payment_id=paid_payment.moyasar_payment_id if paid_payment else None,
        cancelled_by=cancelled_by,
        actor_user_id=actor_user_id,
        refund_percentage=actual_refund_pct,
        refund_amount=actual_refund_amount,
        original_amount=registration.total_amount,
        refund_rule=actual_rule,
        reason=reason,
        moyasar_refund_response=moyasar_refund_response,
        refund_succeeded=refund_succeeded,
    )
    session.add(record)

    registration.status = "cancelled"
    registration.cancelled_at = now
    registration.cancellation_reason = reason
    registration.cancelled_by = cancelled_by
    session.add(registration)


@router.post("/{trip_id}/registrations/{registration_id}/cancel")
async def user_cancel_booking(
    *,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    registration_id: uuid.UUID,
    body: UserCancelRequest = UserCancelRequest(),
    current_user: User = Depends(get_current_active_user),
):
    """
    User cancels their own booking. Refund is determined automatically by policy:
    - Cooling-off (1 hr, deadline > 24h away) → 100%
    - Non-refundable outside cooling-off → 0%
    - Guided refundable: tiered by hours to registration_deadline
    - Self-arranged refundable: 100% if awaiting_provider, 0% if processing/confirmed
    """
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.payment import Payment, PaymentStatus
    from app.services.refund import compute_refund
    from sqlmodel import select as sql_select

    reg = session.get(TripRegistrationModel, registration_id)
    if not reg or reg.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if reg.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your booking")
    if reg.status == "cancelled":
        raise HTTPException(status_code=400, detail="Booking is already cancelled")

    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Determine package refundability — use the first participant's package
    is_refundable = True
    participants = reg.participants
    if participants and participants[0].package_id:
        pkg = session.get(TripPackageModel, participants[0].package_id)
        if pkg and pkg.is_refundable is not None:
            is_refundable = pkg.is_refundable

    # Get paid_at from payment record
    paid_payment = session.exec(
        sql_select(Payment).where(
            Payment.registration_id == reg.id,
            Payment.status == PaymentStatus.PAID,
        )
    ).first()
    paid_at = paid_payment.paid_at if paid_payment else None

    decision = compute_refund(
        total_amount=reg.total_amount,
        is_refundable=is_refundable,
        trip_type=trip.trip_type.value,
        registration_status=reg.status,
        registration_deadline=trip.registration_deadline,
        paid_at=paid_at,
        cancelled_by="user",
    )

    await _execute_refund_and_record(
        session=session,
        registration=reg,
        decision=decision,
        cancelled_by="user",
        actor_user_id=current_user.id,
        reason=body.reason,
    )
    session.commit()

    # Use actual recorded values — may differ from decision when no paid payment exists
    actual_pct = decision.refund_percentage if paid_payment else 0
    actual_amt = float(decision.refund_amount) if paid_payment else 0.0

    # Push: notify user their cancellation is confirmed
    from sqlmodel import select as sql_select_cancel
    lang = getattr(current_user, "preferred_language", "en") or "en"
    trip_name_cancel = trip.name_en or trip.name_ar or ""
    tokens_cancel = [pt.token for pt in session.exec(sql_select_cancel(UserPushToken).where(UserPushToken.user_id == current_user.id)).all()]
    for token in tokens_cancel:
        background_tasks.add_task(
            fcm_service.notify_booking_cancelled_with_refund,
            fcm_token=token,
            trip_name=trip_name_cancel,
            refund_amount=str(int(actual_amt)),
            lang=lang,
            registration_id=str(reg.id),
        )

    return {
        "status": "cancelled",
        "refund_percentage": actual_pct,
        "refund_amount": actual_amt,
        "refund_rule": decision.refund_rule if paid_payment else "no_payment_found",
        "explanation": decision.explanation if paid_payment else "Booking cancelled. No payment was recorded, so no refund is due.",
    }


@router.post("/{trip_id}/registrations/{registration_id}/provider-cancel")
async def provider_cancel_single_booking(
    *,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    registration_id: uuid.UUID,
    body: UserCancelRequest = UserCancelRequest(),
    current_user: User = Depends(get_current_active_provider),
):
    """
    Provider cancels a single booking on their trip.
    Checks that the trip belongs to the provider's account.
    Refund is 100% when provider cancels regardless of policy.
    """
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from app.models.payment import Payment, PaymentStatus
    from app.services.refund import compute_refund
    from sqlmodel import select as sql_select

    reg = session.get(TripRegistrationModel, registration_id)
    if not reg or reg.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if reg.status == "cancelled":
        raise HTTPException(status_code=400, detail="Booking is already cancelled")

    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not your trip")

    paid_payment = session.exec(
        sql_select(Payment).where(
            Payment.registration_id == reg.id,
            Payment.status == PaymentStatus.PAID,
        )
    ).first()

    decision = compute_refund(
        total_amount=reg.total_amount,
        is_refundable=True,  # provider cancel always 100%
        trip_type=trip.trip_type.value,
        registration_status=reg.status,
        registration_deadline=trip.registration_deadline,
        paid_at=paid_payment.paid_at if paid_payment else None,
        cancelled_by="provider",
    )

    await _execute_refund_and_record(
        session=session,
        registration=reg,
        decision=decision,
        cancelled_by="provider",
        actor_user_id=current_user.id,
        reason=body.reason,
    )
    session.commit()

    # Push: notify the user their booking was cancelled by the provider
    reg_user = session.get(User, reg.user_id)
    if reg_user:
        lang = getattr(reg_user, "preferred_language", "en") or "en"
        trip_name_val = trip.name_en or trip.name_ar or ""
        tokens = [pt.token for pt in session.exec(
            select(UserPushToken).where(UserPushToken.user_id == reg_user.id)
        ).all()]
        for token in tokens:
            background_tasks.add_task(
                fcm_service.notify_trip_cancelled_by_provider,
                fcm_token=token, trip_name=trip_name_val, lang=lang, registration_id=str(reg.id),
            )

    actual_amt = float(decision.refund_amount) if paid_payment else 0.0
    return {
        "status": "cancelled",
        "refund_percentage": decision.refund_percentage if paid_payment else 0,
        "refund_amount": actual_amt,
        "refund_rule": decision.refund_rule if paid_payment else "no_payment_found",
    }


@router.post("/{trip_id}/cancel")
async def provider_cancel_trip(
    *,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    body: ProviderCancelTripRequest = ProviderCancelTripRequest(),
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """
    Provider cancels the entire trip. All active bookings are cancelled with 100% refund,
    bypassing non-refundable flags.
    """
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from app.services.refund import compute_refund
    from sqlmodel import select as sql_select

    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    active_regs = session.exec(
        sql_select(TripRegistrationModel).where(
            TripRegistrationModel.trip_id == trip_id,
            TripRegistrationModel.status != "cancelled",
        )
    ).all()

    for reg in active_regs:
        decision = compute_refund(
            total_amount=reg.total_amount,
            is_refundable=True,  # provider cancel always 100%
            trip_type=trip.trip_type.value,
            registration_status=reg.status,
            registration_deadline=trip.registration_deadline,
            paid_at=None,
            cancelled_by="provider",
        )
        await _execute_refund_and_record(
            session=session,
            registration=reg,
            decision=decision,
            cancelled_by="provider",
            actor_user_id=current_user.id,
            reason=body.reason,
        )

    trip.is_active = False
    session.add(trip)
    session.commit()

    # Push: notify each affected user the trip was cancelled by provider
    trip_name_cancel = trip.name_en or trip.name_ar or ""
    for reg in active_regs:
        reg_user = session.get(User, reg.user_id)
        if not reg_user:
            continue
        lang = getattr(reg_user, "preferred_language", "en") or "en"
        tokens = [pt.token for pt in session.exec(
            sql_select(UserPushToken).where(UserPushToken.user_id == reg_user.id)
        ).all()]
        for token in tokens:
            background_tasks.add_task(
                fcm_service.notify_trip_cancelled_by_provider,
                fcm_token=token, trip_name=trip_name_cancel, lang=lang, registration_id=str(reg.id),
            )

    return {
        "status": "trip_cancelled",
        "bookings_cancelled": len(active_regs),
        "all_refunded_100_percent": True,
    }


@router.post("/{trip_id}/registrations/{registration_id}/admin-cancel")
async def admin_cancel_booking(
    *,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    registration_id: uuid.UUID,
    body: AdminCancelBookingRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Admin cancels a single booking with a manually chosen refund percentage (0, 50, or 100).
    Bypasses all policy rules.
    """
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from app.services.refund import compute_refund

    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    if body.refund_percentage_override is not None and body.refund_percentage_override not in (0, 50, 100):
        raise HTTPException(status_code=400, detail="refund_percentage_override must be 0, 50, or 100")

    reg = session.get(TripRegistrationModel, registration_id)
    if not reg or reg.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if reg.status == "cancelled":
        raise HTTPException(status_code=400, detail="Booking is already cancelled")

    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Determine package refundability for policy-based auto calculation
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.payment import Payment, PaymentStatus
    from sqlmodel import select as sql_select
    is_refundable = True
    if reg.participants and reg.participants[0].package_id:
        pkg = session.get(TripPackageModel, reg.participants[0].package_id)
        if pkg and pkg.is_refundable is not None:
            is_refundable = pkg.is_refundable

    paid_payment = session.exec(
        sql_select(Payment).where(
            Payment.registration_id == reg.id,
            Payment.status == PaymentStatus.PAID,
        )
    ).first()

    decision = compute_refund(
        total_amount=reg.total_amount,
        is_refundable=is_refundable,
        trip_type=trip.trip_type.value,
        registration_status=reg.status,
        registration_deadline=trip.registration_deadline,
        paid_at=paid_payment.paid_at if paid_payment else None,
        cancelled_by="admin",
        admin_override_percentage=body.refund_percentage_override,
    )

    await _execute_refund_and_record(
        session=session,
        registration=reg,
        decision=decision,
        cancelled_by="admin",
        actor_user_id=current_user.id,
        reason=body.reason,
    )
    session.commit()

    actual_pct = decision.refund_percentage if paid_payment else 0
    actual_amt = float(decision.refund_amount) if paid_payment else 0.0

    # Push: notify user their booking was cancelled by admin
    reg_owner = session.get(User, reg.user_id)
    if reg_owner:
        lang = getattr(reg_owner, "preferred_language", "en") or "en"
        trip_name_cancel = trip.name_en or trip.name_ar or ""
        tokens = [pt.token for pt in session.exec(
            sql_select(UserPushToken).where(UserPushToken.user_id == reg_owner.id)
        ).all()]
        for token in tokens:
            background_tasks.add_task(
                fcm_service.notify_booking_cancelled_with_refund,
                fcm_token=token,
                trip_name=trip_name_cancel,
                refund_amount=str(int(actual_amt)),
                lang=lang,
                registration_id=str(reg.id),
            )

    return {
        "status": "cancelled",
        "refund_percentage": actual_pct,
        "refund_amount": actual_amt,
        "refund_rule": decision.refund_rule if paid_payment else "no_payment_found",
        "explanation": decision.explanation if paid_payment else "Booking cancelled. No payment was recorded, so no refund is due.",
    }


@router.post("/{trip_id}/admin-cancel")
async def admin_cancel_trip(
    *,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    body: AdminCancelTripRequest = AdminCancelTripRequest(),
    current_user: User = Depends(get_current_active_user),
):
    """
    Admin cancels an entire trip. All active bookings get 100% refund.
    """
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from app.services.refund import compute_refund
    from sqlmodel import select as sql_select

    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")

    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    active_regs = session.exec(
        sql_select(TripRegistrationModel).where(
            TripRegistrationModel.trip_id == trip_id,
            TripRegistrationModel.status != "cancelled",
        )
    ).all()

    for reg in active_regs:
        decision = compute_refund(
            total_amount=reg.total_amount,
            is_refundable=True,
            trip_type=trip.trip_type.value,
            registration_status=reg.status,
            registration_deadline=trip.registration_deadline,
            paid_at=None,
            cancelled_by="admin",
            admin_override_percentage=100,  # trip-level cancel always refunds 100%
        )
        await _execute_refund_and_record(
            session=session,
            registration=reg,
            decision=decision,
            cancelled_by="admin",
            actor_user_id=current_user.id,
            reason=body.reason,
        )

    trip.is_active = False
    session.add(trip)
    session.commit()

    # Push: notify each affected user the trip was cancelled by admin
    trip_name_cancel = trip.name_en or trip.name_ar or ""
    for reg in active_regs:
        reg_user = session.get(User, reg.user_id)
        if not reg_user:
            continue
        lang = getattr(reg_user, "preferred_language", "en") or "en"
        tokens = [pt.token for pt in session.exec(
            sql_select(UserPushToken).where(UserPushToken.user_id == reg_user.id)
        ).all()]
        for token in tokens:
            background_tasks.add_task(
                fcm_service.notify_trip_cancelled_by_provider,
                fcm_token=token, trip_name=trip_name_cancel, lang=lang, registration_id=str(reg.id),
            )

    return {
        "status": "trip_cancelled",
        "bookings_cancelled": len(active_regs),
        "all_refunded_100_percent": True,
    }


# ── Spot-count guard — include awaiting_provider + processing in "occupied" ─

# Field Validation Endpoints


@router.get("/validation/phone-countries")
def get_phone_countries(
    current_user: User = Depends(get_current_active_provider),
):
    """Get the list of countries with dial codes for the phone field picker."""
    return {"countries": PHONE_COUNTRY_METADATA}


@router.get("/validation/nationalities")
def get_nationalities(
    current_user: User = Depends(get_current_active_provider),
):
    """Get the list of nationalities for the nationality field picker."""
    return {"nationalities": NATIONALITY_LIST}


@router.get("/validation/available/{field_type}")
def get_available_validations(
    field_type: TripFieldType,
    current_user: User = Depends(get_current_active_provider),
):
    """Get available validation types for a specific field type."""
    available = get_available_validations_for_field(field_type)
    return {"field_type": field_type, "available_validations": available}


@router.get("/validation/metadata")
def get_validation_metadata(
    current_user: User = Depends(get_current_active_provider),
):
    """Get metadata for all validation types."""
    return {"validation_metadata": VALIDATION_METADATA}


class ValidationConfigRequest(BaseModel):
    field_type: TripFieldType
    validation_config: Dict[str, Any]


class ValidationValueRequest(BaseModel):
    field_type: TripFieldType
    value: str
    validation_config: Optional[Dict[str, Any]] = None


@router.post("/validation/validate-config")
def validate_field_validation_config(
    *,
    request: ValidationConfigRequest,
    current_user: User = Depends(get_current_active_provider),
):
    """Validate a validation configuration for a field type."""
    errors = validate_validation_config(request.field_type, request.validation_config)
    return {
        "field_type": request.field_type,
        "validation_config": request.validation_config,
        "is_valid": len(errors) == 0,
        "errors": errors
    }


@router.post("/validation/validate-value")
def validate_field_value_endpoint(
    *,
    request: ValidationValueRequest,
    current_user: User = Depends(get_current_active_provider),
    accept_language: Optional[str] = Header(default="en", alias="Accept-Language"),
):
    """Validate a field value against validation configuration."""
    lang = "ar" if (accept_language or "en").startswith("ar") else "en"
    errors = validate_field_value(request.field_type, request.value, request.validation_config, lang=lang)
    return {
        "field_type": request.field_type,
        "value": request.value,
        "validation_config": request.validation_config,
        "is_valid": len(errors) == 0,
        "errors": errors
    }


@router.post("/{trip_id}/upload-images")
async def upload_trip_images(
    trip_id: uuid.UUID,
    files: List[UploadFile] = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Upload images for a trip.

    Images are validated for minimum resolution (800×600 px), then compressed
    and downscaled to a maximum long edge of 1920 px before being stored.
    """
    from app.services.storage import storage_service
    from app.services.image_processing import process_trip_image

    # Get trip and verify ownership
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to upload images for this trip")

    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    max_size = 10 * 1024 * 1024  # 10 MB raw input (will be compressed before storage)

    uploaded_urls = []

    for file in files:
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {file.content_type}. Allowed types: JPEG, PNG, WEBP"
            )

        content = await file.read()

        if len(content) > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File '{file.filename}' is too large. Maximum accepted size is 10 MB"
            )

        # Validate resolution and compress — run in thread pool to avoid blocking the event loop
        try:
            loop = asyncio.get_event_loop()
            processed = await loop.run_in_executor(
                None, process_trip_image, content, file.filename or "image.jpg"
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        try:
            file_info = await storage_service.upload_file(
                file_data=processed.data,
                file_name=file.filename,
                content_type=processed.content_type,
                folder="trip_images"
            )
            url = file_info["downloadUrl"]
            uploaded_urls.append(url)

            # Save to provider's image collection
            crud.provider_image.add_image(
                session=session,
                provider_id=current_user.provider_id,
                url=url,
                b2_file_id=file_info.get("fileId", ""),
                b2_file_name=file_info.get("fileName", file.filename or ""),
                original_filename=file.filename,
                width=processed.width,
                height=processed.height,
                size_bytes=len(processed.data),
            )
        except Exception as e:
            logger.error(f"Error uploading file {file.filename}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to upload '{file.filename}'")

    # Update trip with new image URLs
    current_images = trip.images or []
    trip.images = current_images + uploaded_urls
    session.add(trip)
    session.commit()
    session.refresh(trip)

    return {
        "message": f"Successfully uploaded {len(uploaded_urls)} images",
        "uploaded_urls": uploaded_urls,
        "total_images": len(trip.images)
    }


@router.delete("/{trip_id}/images")
async def delete_trip_image(
    trip_id: uuid.UUID,
    image_url: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Delete a specific image from a trip."""
    from app.services.storage import storage_service
    
    # Get trip and verify ownership
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete images for this trip")
    
    if not trip.images or image_url not in trip.images:
        raise HTTPException(status_code=404, detail="Image not found in trip")
    
    # Remove image URL from trip - create new list to ensure SQLAlchemy detects the change
    trip.images = [img for img in trip.images if img != image_url]
    session.add(trip)
    session.commit()
    session.refresh(trip)
    
    # Note: We only have the URL, not the file_id needed for Backblaze deletion
    # In production, you might want to store file_id separately or extract it from URL
    # For now, we just remove the reference from the database
    logger.info(f"Removed image reference from trip: {image_url}")
    
    return {
        "message": "Image deleted successfully",
        "remaining_images": len(trip.images)
    }


# ===== Extra Fees Management =====

@router.post("/{trip_id}/extra-fees", response_model=TripExtraFeeResponse)
def create_trip_extra_fee(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    extra_fee_in: TripExtraFeeCreate,
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Create a new extra fee for a trip."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to add fees to this trip")
    
    extra_fee = trip_extra_fee.create_extra_fee(
        session=session,
        trip_id=trip_id,
        extra_fee_data=extra_fee_in
    )
    return extra_fee


@router.get("/{trip_id}/extra-fees", response_model=List[TripExtraFeeResponse])
def get_trip_extra_fees(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
):
    """Get all extra fees for a trip (public endpoint)."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    return trip_extra_fee.get_trip_extra_fees(session=session, trip_id=trip_id)


@router.put("/{trip_id}/extra-fees/{fee_id}", response_model=TripExtraFeeResponse)
def update_trip_extra_fee(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    fee_id: uuid.UUID,
    extra_fee_in: TripExtraFeeUpdate,
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Update an extra fee."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to update fees for this trip")
    
    extra_fee = trip_extra_fee.get_extra_fee(session=session, extra_fee_id=fee_id)
    if not extra_fee or extra_fee.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Extra fee not found")
    
    updated_fee = trip_extra_fee.update_extra_fee(
        session=session,
        extra_fee=extra_fee,
        extra_fee_data=extra_fee_in
    )
    return updated_fee


@router.delete("/{trip_id}/extra-fees/{fee_id}")
def delete_trip_extra_fee(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    fee_id: uuid.UUID,
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Delete an extra fee."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete fees for this trip")
    
    extra_fee = trip_extra_fee.get_extra_fee(session=session, extra_fee_id=fee_id)
    if not extra_fee or extra_fee.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Extra fee not found")
    
    trip_extra_fee.delete_extra_fee(session=session, extra_fee=extra_fee)
    return {"message": "Extra fee deleted successfully"}


@router.post("/{trip_id}/duplicate")
def duplicate_trip(
    trip_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Duplicate a trip.

    Creates a full copy of the trip (packages, required fields, destinations,
    images) owned by the same provider. The new trip starts as inactive (draft)
    with no dates set so the provider can fill them in before publishing.
    """
    source = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not source:
        raise HTTPException(status_code=404, detail="Trip not found")
    if source.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not authorised to duplicate this trip")

    new_trip = crud.trip.duplicate_trip(session=session, source_trip=source)

    provider_obj = crud.provider.get_provider_by_id(
        session=session, id=new_trip.provider_id
    )
    provider_info = {"id": provider_obj.id, "company_name": provider_obj.company_name}

    extra_fees = trip_extra_fee.get_trip_extra_fees(session=session, trip_id=new_trip.id)

    return _build_trip_read(session, new_trip, provider_info, extra_fees)
