"""Language utility module for handling bilingual content."""

from enum import Enum
from typing import Optional, Dict, Any


class Language(str, Enum):
    """Supported languages."""
    ENGLISH = "en"
    ARABIC = "ar"


def get_localized_field(obj: Any, field_base: str, lang: Optional[str] = None) -> str:
    """
    Get localized field value based on language preference.
    
    Args:
        obj: Object with bilingual fields
        field_base: Base field name (e.g., 'name', 'description')
        lang: Language code ('en' or 'ar'). If None, returns English by default.
    
    Returns:
        Localized field value
    
    Example:
        >>> get_localized_field(trip, 'name', 'ar')
        # Returns trip.name_ar
    """
    # Default to English if no language specified
    if not lang or lang not in ['en', 'ar']:
        lang = 'en'
    
    field_name = f"{field_base}_{lang}"
    return getattr(obj, field_name, getattr(obj, f"{field_base}_en", ""))


def localize_dict(data: Dict[str, Any], lang: Optional[str] = None) -> Dict[str, Any]:
    """
    Transform bilingual dictionary to single-language dictionary.
    
    Args:
        data: Dictionary with _en and _ar suffixed keys
        lang: Language code ('en' or 'ar'). If None, returns both languages.
    
    Returns:
        Dictionary with localized fields
    
    Example:
        >>> localize_dict({'name_en': 'Trip', 'name_ar': 'رحلة'}, 'ar')
        {'name': 'رحلة'}
    """
    if not lang or lang not in ['en', 'ar']:
        # Return both languages if no specific language requested
        return data
    
    localized = {}
    processed_fields = set()
    
    for key, value in data.items():
        # Check if this is a bilingual field
        if key.endswith('_en') or key.endswith('_ar'):
            base_field = key[:-3]  # Remove _en or _ar suffix
            
            # Skip if we already processed this field
            if base_field in processed_fields:
                continue
            
            # Get the localized value
            if key.endswith(f'_{lang}'):
                localized[base_field] = value
            else:
                # Get the value for the requested language
                lang_key = f"{base_field}_{lang}"
                if lang_key in data:
                    localized[base_field] = data[lang_key]
            
            processed_fields.add(base_field)
        else:
            # Non-bilingual field, keep as is
            localized[key] = value
    
    return localized


def get_language_from_header(accept_language: Optional[str]) -> str:
    """
    Parse Accept-Language header and return supported language code.
    
    Args:
        accept_language: Accept-Language header value
    
    Returns:
        Language code ('en' or 'ar'), defaults to 'en'
    
    Example:
        >>> get_language_from_header('ar-SA,ar;q=0.9,en;q=0.8')
        'ar'
    """
    if not accept_language:
        return 'en'
    
    # Parse the header (simplified version)
    # Format: "ar-SA,ar;q=0.9,en;q=0.8"
    languages = accept_language.lower().split(',')
    
    for lang in languages:
        # Remove quality factor if present
        lang_code = lang.split(';')[0].strip()
        
        # Extract primary language code
        if lang_code.startswith('ar'):
            return 'ar'
        elif lang_code.startswith('en'):
            return 'en'
    
    return 'en'  # Default to English
