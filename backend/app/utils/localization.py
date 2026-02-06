"""
Localization utilities for handling bilingual fields.
"""
from typing import Optional, Any


def get_localized_field(obj: Any, field_base: str, prefer_lang: str = "en") -> Optional[str]:
    """
    Get the first non-null value from bilingual fields.
    
    Args:
        obj: Object with bilingual fields (e.g., Trip, TripPackage)
        field_base: Base field name (e.g., "name", "description")
        prefer_lang: Preferred language ("en" or "ar"), defaults to "en"
    
    Returns:
        First non-null value from the bilingual fields, or None if both are null
    
    Examples:
        >>> get_localized_field(trip, "name")  # Returns name_en if exists, else name_ar
        >>> get_localized_field(package, "description", prefer_lang="ar")  # Prefers AR first
    """
    if prefer_lang == "ar":
        # Try Arabic first, then English
        ar_value = getattr(obj, f"{field_base}_ar", None)
        if ar_value:
            return ar_value
        return getattr(obj, f"{field_base}_en", None)
    else:
        # Try English first, then Arabic
        en_value = getattr(obj, f"{field_base}_en", None)
        if en_value:
            return en_value
        return getattr(obj, f"{field_base}_ar", None)


def get_name(obj: Any, prefer_lang: str = "en") -> str:
    """Get name from bilingual object, returns first non-null value."""
    return get_localized_field(obj, "name", prefer_lang) or "Unnamed"


def get_description(obj: Any, prefer_lang: str = "en") -> str:
    """Get description from bilingual object, returns first non-null value."""
    return get_localized_field(obj, "description", prefer_lang) or ""
