"""API response localization utilities."""

from typing import Any, Dict, List, Optional
from app.core.language import get_localized_field


def localize_trip_response(trip: Any, lang: Optional[str] = None) -> Dict[str, Any]:
    """
    Localize trip response based on language preference.
    
    Args:
        trip: Trip object with bilingual fields
        lang: Language code ('en' or 'ar'). If None, returns both languages.
    
    Returns:
        Dictionary with localized or bilingual fields
    """
    if not lang or lang not in ['en', 'ar']:
        # Return both languages
        return {
            "id": str(trip.id),
            "name_en": trip.name_en,
            "name_ar": trip.name_ar,
            "description_en": trip.description_en,
            "description_ar": trip.description_ar,
            "start_date": trip.start_date,
            "end_date": trip.end_date,
            "max_participants": trip.max_participants,
            "is_active": trip.is_active,
            "is_refundable": trip.is_refundable,
            "amenities": trip.amenities,
            "has_meeting_place": trip.has_meeting_place,
            "meeting_location": trip.meeting_location,
            "meeting_time": trip.meeting_time,
            "images": trip.images,
            "trip_metadata": trip.trip_metadata,
            "provider_id": str(trip.provider_id),
        }
    
    # Return single language
    return {
        "id": str(trip.id),
        "name": get_localized_field(trip, 'name', lang),
        "description": get_localized_field(trip, 'description', lang),
        "start_date": trip.start_date,
        "end_date": trip.end_date,
        "max_participants": trip.max_participants,
        "is_active": trip.is_active,
        "is_refundable": trip.is_refundable,
        "amenities": trip.amenities,
        "has_meeting_place": trip.has_meeting_place,
        "meeting_location": trip.meeting_location,
        "meeting_time": trip.meeting_time,
        "images": trip.images,
        "trip_metadata": trip.trip_metadata,
        "provider_id": str(trip.provider_id),
    }


def localize_package_response(package: Any, lang: Optional[str] = None) -> Dict[str, Any]:
    """
    Localize package response based on language preference.
    
    Args:
        package: TripPackage object with bilingual fields
        lang: Language code ('en' or 'ar'). If None, returns both languages.
    
    Returns:
        Dictionary with localized or bilingual fields
    """
    if not lang or lang not in ['en', 'ar']:
        # Return both languages
        return {
            "id": str(package.id),
            "trip_id": str(package.trip_id),
            "name_en": package.name_en,
            "name_ar": package.name_ar,
            "description_en": package.description_en,
            "description_ar": package.description_ar,
            "price": float(package.price),
            "currency": package.currency,
            "is_active": package.is_active,
        }
    
    # Return single language
    return {
        "id": str(package.id),
        "trip_id": str(package.trip_id),
        "name": get_localized_field(package, 'name', lang),
        "description": get_localized_field(package, 'description', lang),
        "price": float(package.price),
        "currency": package.currency,
        "is_active": package.is_active,
    }


def localize_trip_list(trips: List[Any], lang: Optional[str] = None) -> List[Dict[str, Any]]:
    """Localize a list of trips."""
    return [localize_trip_response(trip, lang) for trip in trips]


def localize_package_list(packages: List[Any], lang: Optional[str] = None) -> List[Dict[str, Any]]:
    """Localize a list of packages."""
    return [localize_package_response(package, lang) for package in packages]
