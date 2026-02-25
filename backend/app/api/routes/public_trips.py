"""
Public API routes for trips (no authentication required)
"""

import logging
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlmodel import Session, select
from typing import List, Optional
import uuid
from app.utils.localization import get_name, get_description
from app.api.deps import get_session
from app.schemas.trip import TripRead
from app.schemas.field_metadata import AvailableFieldsResponse, FieldMetadata, FieldOption
from app.models.trip_field import TripFieldType, FIELD_METADATA
import app.crud as crud
from app.schemas.trip_package import TripPackageWithRequiredFields
from app.models.trip_package import TripPackage as TripPackageModel
from app.models.trip_package_field import TripPackageRequiredField

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/field-metadata", response_model=AvailableFieldsResponse)
def get_public_field_metadata(
    accept_language: Optional[str] = Header(default="en", alias="Accept-Language"),
):
    """
    Get all field type metadata with localized labels (public, no auth required).
    Returns display names and select options in the requested language.
    """
    lang = "ar" if (accept_language or "en").startswith("ar") else "en"
    fields = []

    for field_type in TripFieldType:
        metadata = FIELD_METADATA.get(field_type, {})

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

        fields.append(FieldMetadata(
            field_name=field_type,
            display_name=display_name,
            display_name_ar=metadata.get("display_name_ar"),
            ui_type=metadata.get("ui_type", "text"),
            placeholder=placeholder,
            placeholder_ar=metadata.get("placeholder_ar"),
            required=metadata.get("required", False),
            options=options,
            available_validations=metadata.get("available_validations", []),
        ))

    return AvailableFieldsResponse(fields=fields)


def build_trip_read(trip, session: Session) -> TripRead:
    """Convert a Trip ORM object to a TripRead schema with properly built packages."""
    all_packages = session.query(TripPackageModel).filter(
        TripPackageModel.trip_id == trip.id,
        TripPackageModel.is_active == True
    ).all()

    is_packaged = getattr(trip, 'is_packaged_trip', False)
    resp_price = None
    resp_is_refundable = None
    resp_amenities = None

    if is_packaged:
        from app.models.trip_registration import TripRegistration as TripRegistrationModel, TripRegistrationParticipant as TripParticipantModel
        packages_with_fields = []
        for package in all_packages:
            required_fields = session.query(TripPackageRequiredField).filter(
                TripPackageRequiredField.package_id == package.id
            ).all()
            required_field_types = [rf.field_type.value for rf in required_fields]
            required_fields_details = [
                {"id": str(rf.id), "package_id": str(rf.package_id), "field_type": rf.field_type.value,
                 "is_required": rf.is_required, "validation_config": rf.validation_config}
                for rf in required_fields
            ]
            pkg_available_spots = None
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
                pkg_available_spots = max(0, package.max_participants - booked_in_pkg)
            packages_with_fields.append(TripPackageWithRequiredFields(
                id=package.id,
                trip_id=package.trip_id,
                name_en=package.name_en,
                name_ar=package.name_ar,
                description_en=package.description_en,
                description_ar=package.description_ar,
                price=package.price,
                currency=package.currency,
                is_active=package.is_active,
                max_participants=package.max_participants,
                available_spots=pkg_available_spots,
                is_refundable=package.is_refundable,
                amenities=package.amenities,
                required_fields=required_field_types,
                required_fields_details=required_fields_details,
            ))
    else:
        # Non-packaged: hide packages, surface hidden package fields in response only
        packages_with_fields = []
        if all_packages:
            hp = all_packages[0]
            if hp.max_participants is not None:
                trip.max_participants = hp.max_participants
            resp_price = float(hp.price) if hp.price is not None else None
            resp_is_refundable = hp.is_refundable
            resp_amenities = hp.amenities

    from app.crud import provider as provider_crud
    provider = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
    provider_info = {
        "id": provider.id,
        "company_name": provider.company_name,
    } if provider else {"id": trip.provider_id, "company_name": "Unknown"}

    # Build starting_city info
    starting_city_info = None
    if trip.starting_city_id:
        from app.models.destination import Destination
        sc = session.get(Destination, trip.starting_city_id)
        if sc:
            starting_city_info = {
                "id": sc.id,
                "name_en": sc.name_en,
                "name_ar": sc.name_ar,
                "country_code": sc.country_code,
            }

    # Build destinations list
    from app.models.trip_destination import TripDestination
    from app.models.destination import Destination
    from sqlmodel import select as sql_select
    trip_dest_links = session.exec(
        sql_select(TripDestination).where(TripDestination.trip_id == trip.id)
    ).all()
    destinations_info = []
    for link in trip_dest_links:
        dest = session.get(Destination, link.destination_id)
        if dest:
            destinations_info.append({
                "id": dest.id,
                "name_en": dest.name_en,
                "name_ar": dest.name_ar,
                "country_code": dest.country_code,
                "type": dest.type.value if hasattr(dest.type, 'value') else str(dest.type),
            })

    # Compute available spots
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    active_regs = session.exec(
        sql_select(TripRegistrationModel).where(
            TripRegistrationModel.trip_id == trip.id,
            TripRegistrationModel.status.in_(["confirmed", "pending_payment"]),
        )
    ).all()
    booked = sum(r.total_participants for r in active_regs)
    available_spots = max(0, trip.max_participants - booked)

    return TripRead(
        id=trip.id,
        provider_id=trip.provider_id,
        provider=provider_info,
        name_en=trip.name_en,
        name_ar=trip.name_ar,
        description_en=trip.description_en,
        description_ar=trip.description_ar,
        start_date=trip.start_date,
        end_date=trip.end_date,
        max_participants=trip.max_participants,
        images=trip.images,
        trip_metadata=trip.trip_metadata,
        is_active=trip.is_active,
        price=resp_price,
        is_refundable=resp_is_refundable,
        amenities=resp_amenities,
        has_meeting_place=trip.has_meeting_place,
        meeting_location=trip.meeting_location,
        meeting_time=trip.meeting_time,
        trip_reference=trip.trip_reference,
        registration_deadline=trip.registration_deadline,
        starting_city_id=trip.starting_city_id,
        starting_city=starting_city_info,
        is_international=trip.is_international,
        is_packaged_trip=is_packaged,
        destinations=destinations_info,
        packages=packages_with_fields,
        extra_fees=[],
        available_spots=available_spots,
    )


@router.get("", response_model=List[TripRead])
def list_public_trips(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    provider_id: Optional[uuid.UUID] = None,
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
    starting_city_id: Optional[uuid.UUID] = None,
    is_international: Optional[bool] = None,
    destination_ids: Optional[List[uuid.UUID]] = Query(default=None),
    single_destination: Optional[bool] = None,
    amenities: Optional[List[str]] = Query(default=None),
):
    """Retrieve and filter all trips (public endpoint for mobile app).

    When provider_id is supplied (provider profile view) only inactive trips are
    excluded — past trips and closed-registration trips are still shown so users
    can see the provider's full history, reviews, and ratings.
    Otherwise returns only active, future trips with open registration.
    """
    start_date_from_dt = datetime.fromisoformat(start_date_from) if start_date_from else None
    start_date_to_dt = datetime.fromisoformat(start_date_to) if start_date_to else None
    end_date_from_dt = datetime.fromisoformat(end_date_from) if end_date_from else None
    end_date_to_dt = datetime.fromisoformat(end_date_to) if end_date_to else None

    min_price_decimal = Decimal(str(min_price)) if min_price is not None else None
    max_price_decimal = Decimal(str(max_price)) if max_price is not None else None

    # When browsing a specific provider's profile we want to show all their
    # active trips (including past ones) so users can see history and reviews.
    # For the general explore feed we keep the strict future+open-registration filter.
    is_provider_profile_view = provider_id is not None

    trips = crud.trip.search_and_filter_trips(
        session=session,
        provider_id=provider_id,
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
        starting_city_id=starting_city_id,
        is_international=is_international,
        destination_ids=destination_ids,
        single_destination=single_destination,
        amenities=amenities,
        only_future=not is_provider_profile_view,
        only_open_registration=not is_provider_profile_view,
        skip=skip,
        limit=limit,
    )

    return [build_trip_read(trip, session) for trip in trips]


@router.get("/{trip_id}", response_model=TripRead)
def get_public_trip(
    trip_id: str,
    session: Session = Depends(get_session)
):
    """
    Get a single trip by ID (public endpoint for mobile app).
    
    No authentication required.
    """
    import uuid
    from fastapi import HTTPException
    
    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid trip ID format")
    
    trip = crud.trip.get_trip(session=session, trip_id=trip_uuid)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    return build_trip_read(trip, session)
