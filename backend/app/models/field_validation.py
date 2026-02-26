from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, date
import re
from enum import Enum

from .trip_field import TripFieldType


class ValidationType(str, Enum):
    """Provider-configurable validation types (further restrict always-on defaults)."""
    MIN_AGE = "min_age"
    MAX_AGE = "max_age"
    PHONE_COUNTRY_CODES = "phone_country_codes"
    GENDER_RESTRICTIONS = "gender_restrictions"
    NATIONALITY_RESTRICTION = "nationality_restriction"


# ---------------------------------------------------------------------------
# Phone number patterns per dial code: (min_digits, max_digits, optional_regex)
# Digits counted AFTER stripping the country prefix (local number length).
# ---------------------------------------------------------------------------
PHONE_PATTERNS: Dict[str, Dict[str, Any]] = {
    "966": {"min": 9, "max": 9,  "regex": r"^5\d{8}$"},          # SA mobile: 05xxxxxxxx → strip leading 0 → 9 digits starting with 5
    "971": {"min": 9, "max": 9,  "regex": r"^(5[024568]\d{7}|[234679]\d{7})$"},  # UAE
    "965": {"min": 8, "max": 8},                                   # KW
    "974": {"min": 8, "max": 8},                                   # QA
    "973": {"min": 8, "max": 8},                                   # BH
    "968": {"min": 8, "max": 8},                                   # OM
    "962": {"min": 9, "max": 9},                                   # JO
    "961": {"min": 7, "max": 8},                                   # LB
    "963": {"min": 9, "max": 9},                                   # SY
    "964": {"min": 10, "max": 10},                                 # IQ
    "967": {"min": 9, "max": 9},                                   # YE
    "20":  {"min": 10, "max": 10},                                 # EG
    "212": {"min": 9, "max": 9},                                   # MA
    "216": {"min": 8, "max": 8},                                   # TN
    "213": {"min": 9, "max": 9},                                   # DZ
    "249": {"min": 9, "max": 9},                                   # SD
    "91":  {"min": 10, "max": 10},                                 # IN
    "92":  {"min": 10, "max": 10},                                 # PK
    "880": {"min": 10, "max": 10},                                 # BD
    "63":  {"min": 10, "max": 10},                                 # PH
    "62":  {"min": 9,  "max": 12},                                 # ID
    "94":  {"min": 9,  "max": 9},                                  # LK
    "977": {"min": 9,  "max": 10},                                 # NP
    "251": {"min": 9,  "max": 9},                                  # ET
    "1":   {"min": 10, "max": 10},                                 # US/CA
    "44":  {"min": 10, "max": 10},                                 # GB
    "33":  {"min": 9,  "max": 9},                                  # FR
    "49":  {"min": 10, "max": 11},                                 # DE
    "39":  {"min": 9,  "max": 11},                                 # IT
    "34":  {"min": 9,  "max": 9},                                  # ES
    "90":  {"min": 10, "max": 10},                                 # TR
    "7":   {"min": 10, "max": 10},                                 # RU
    "86":  {"min": 11, "max": 11},                                 # CN
    "81":  {"min": 10, "max": 11},                                 # JP
    "82":  {"min": 9,  "max": 10},                                 # KR
    "55":  {"min": 10, "max": 11},                                 # BR
    "61":  {"min": 9,  "max": 9},                                  # AU
}


# Phone country metadata for provider panel picker
PHONE_COUNTRY_METADATA: List[Dict[str, str]] = [
    {"dial_code": "966", "code": "SA", "name": "Saudi Arabia",   "name_ar": "المملكة العربية السعودية", "flag": "🇸🇦"},
    {"dial_code": "971", "code": "AE", "name": "UAE",             "name_ar": "الإمارات العربية المتحدة",  "flag": "🇦🇪"},
    {"dial_code": "965", "code": "KW", "name": "Kuwait",          "name_ar": "الكويت",                   "flag": "🇰🇼"},
    {"dial_code": "974", "code": "QA", "name": "Qatar",           "name_ar": "قطر",                      "flag": "🇶🇦"},
    {"dial_code": "973", "code": "BH", "name": "Bahrain",         "name_ar": "البحرين",                  "flag": "🇧🇭"},
    {"dial_code": "968", "code": "OM", "name": "Oman",            "name_ar": "عُمان",                    "flag": "🇴🇲"},
    {"dial_code": "962", "code": "JO", "name": "Jordan",          "name_ar": "الأردن",                   "flag": "🇯🇴"},
    {"dial_code": "961", "code": "LB", "name": "Lebanon",         "name_ar": "لبنان",                   "flag": "🇱🇧"},
    {"dial_code": "963", "code": "SY", "name": "Syria",           "name_ar": "سوريا",                   "flag": "🇸🇾"},
    {"dial_code": "964", "code": "IQ", "name": "Iraq",            "name_ar": "العراق",                   "flag": "🇮🇶"},
    {"dial_code": "967", "code": "YE", "name": "Yemen",           "name_ar": "اليمن",                   "flag": "🇾🇪"},
    {"dial_code": "20",  "code": "EG", "name": "Egypt",           "name_ar": "مصر",                      "flag": "🇪🇬"},
    {"dial_code": "212", "code": "MA", "name": "Morocco",         "name_ar": "المغرب",                   "flag": "🇲🇦"},
    {"dial_code": "216", "code": "TN", "name": "Tunisia",         "name_ar": "تونس",                    "flag": "🇹🇳"},
    {"dial_code": "213", "code": "DZ", "name": "Algeria",         "name_ar": "الجزائر",                  "flag": "🇩🇿"},
    {"dial_code": "249", "code": "SD", "name": "Sudan",           "name_ar": "السودان",                  "flag": "🇸🇩"},
    {"dial_code": "91",  "code": "IN", "name": "India",           "name_ar": "الهند",                   "flag": "🇮🇳"},
    {"dial_code": "92",  "code": "PK", "name": "Pakistan",        "name_ar": "باكستان",                  "flag": "🇵🇰"},
    {"dial_code": "880", "code": "BD", "name": "Bangladesh",      "name_ar": "بنغلاديش",                 "flag": "🇧🇩"},
    {"dial_code": "63",  "code": "PH", "name": "Philippines",     "name_ar": "الفلبين",                  "flag": "🇵🇭"},
    {"dial_code": "62",  "code": "ID", "name": "Indonesia",       "name_ar": "إندونيسيا",               "flag": "🇮🇩"},
    {"dial_code": "94",  "code": "LK", "name": "Sri Lanka",       "name_ar": "سريلانكا",                 "flag": "🇱🇰"},
    {"dial_code": "977", "code": "NP", "name": "Nepal",           "name_ar": "نيبال",                   "flag": "🇳🇵"},
    {"dial_code": "251", "code": "ET", "name": "Ethiopia",        "name_ar": "إثيوبيا",                  "flag": "🇪🇹"},
    {"dial_code": "1",   "code": "US", "name": "United States",   "name_ar": "الولايات المتحدة",         "flag": "🇺🇸"},
    {"dial_code": "44",  "code": "GB", "name": "United Kingdom",  "name_ar": "المملكة المتحدة",          "flag": "🇬🇧"},
    {"dial_code": "33",  "code": "FR", "name": "France",          "name_ar": "فرنسا",                   "flag": "🇫🇷"},
    {"dial_code": "49",  "code": "DE", "name": "Germany",         "name_ar": "ألمانيا",                  "flag": "🇩🇪"},
    {"dial_code": "39",  "code": "IT", "name": "Italy",           "name_ar": "إيطاليا",                  "flag": "🇮🇹"},
    {"dial_code": "34",  "code": "ES", "name": "Spain",           "name_ar": "إسبانيا",                  "flag": "🇪🇸"},
    {"dial_code": "90",  "code": "TR", "name": "Turkey",          "name_ar": "تركيا",                   "flag": "🇹🇷"},
    {"dial_code": "7",   "code": "RU", "name": "Russia",          "name_ar": "روسيا",                   "flag": "🇷🇺"},
    {"dial_code": "86",  "code": "CN", "name": "China",           "name_ar": "الصين",                   "flag": "🇨🇳"},
    {"dial_code": "81",  "code": "JP", "name": "Japan",           "name_ar": "اليابان",                  "flag": "🇯🇵"},
    {"dial_code": "82",  "code": "KR", "name": "South Korea",     "name_ar": "كوريا الجنوبية",           "flag": "🇰🇷"},
    {"dial_code": "55",  "code": "BR", "name": "Brazil",          "name_ar": "البرازيل",                 "flag": "🇧🇷"},
    {"dial_code": "61",  "code": "AU", "name": "Australia",       "name_ar": "أستراليا",                 "flag": "🇦🇺"},
    {"dial_code": "1",   "code": "CA", "name": "Canada",          "name_ar": "كندا",                    "flag": "🇨🇦"},
]

# Nationality list for provider panel picker (ISO 3166-1 alpha-2 codes)
NATIONALITY_LIST: List[Dict[str, str]] = [
    {"code": "SA", "name": "Saudi",        "name_ar": "سعودي"},
    {"code": "AE", "name": "Emirati",      "name_ar": "إماراتي"},
    {"code": "KW", "name": "Kuwaiti",      "name_ar": "كويتي"},
    {"code": "QA", "name": "Qatari",       "name_ar": "قطري"},
    {"code": "BH", "name": "Bahraini",     "name_ar": "بحريني"},
    {"code": "OM", "name": "Omani",        "name_ar": "عُماني"},
    {"code": "JO", "name": "Jordanian",    "name_ar": "أردني"},
    {"code": "LB", "name": "Lebanese",     "name_ar": "لبناني"},
    {"code": "SY", "name": "Syrian",       "name_ar": "سوري"},
    {"code": "IQ", "name": "Iraqi",        "name_ar": "عراقي"},
    {"code": "YE", "name": "Yemeni",       "name_ar": "يمني"},
    {"code": "EG", "name": "Egyptian",     "name_ar": "مصري"},
    {"code": "MA", "name": "Moroccan",     "name_ar": "مغربي"},
    {"code": "TN", "name": "Tunisian",     "name_ar": "تونسي"},
    {"code": "DZ", "name": "Algerian",     "name_ar": "جزائري"},
    {"code": "SD", "name": "Sudanese",     "name_ar": "سوداني"},
    {"code": "LY", "name": "Libyan",       "name_ar": "ليبي"},
    {"code": "PS", "name": "Palestinian",  "name_ar": "فلسطيني"},
    {"code": "IN", "name": "Indian",       "name_ar": "هندي"},
    {"code": "PK", "name": "Pakistani",    "name_ar": "باكستاني"},
    {"code": "BD", "name": "Bangladeshi",  "name_ar": "بنغلاديشي"},
    {"code": "PH", "name": "Filipino",     "name_ar": "فلبيني"},
    {"code": "ID", "name": "Indonesian",   "name_ar": "إندونيسي"},
    {"code": "LK", "name": "Sri Lankan",   "name_ar": "سريلانكي"},
    {"code": "NP", "name": "Nepali",       "name_ar": "نيبالي"},
    {"code": "ET", "name": "Ethiopian",    "name_ar": "إثيوبي"},
    {"code": "US", "name": "American",     "name_ar": "أمريكي"},
    {"code": "GB", "name": "British",      "name_ar": "بريطاني"},
    {"code": "FR", "name": "French",       "name_ar": "فرنسي"},
    {"code": "DE", "name": "German",       "name_ar": "ألماني"},
    {"code": "TR", "name": "Turkish",      "name_ar": "تركي"},
    {"code": "RU", "name": "Russian",      "name_ar": "روسي"},
    {"code": "CN", "name": "Chinese",      "name_ar": "صيني"},
    {"code": "JP", "name": "Japanese",     "name_ar": "ياباني"},
    {"code": "KR", "name": "South Korean", "name_ar": "كوري جنوبي"},
    {"code": "AU", "name": "Australian",   "name_ar": "أسترالي"},
    {"code": "CA", "name": "Canadian",     "name_ar": "كندي"},
]

class ValidationError(Exception):
    """Custom exception for validation errors"""
    pass


# ---------------------------------------------------------------------------
# Always-on field validators (run regardless of provider config)
# ---------------------------------------------------------------------------

_VALID_NATIONALITY_CODES = {n["code"].upper() for n in NATIONALITY_LIST}
_KNOWN_DIAL_CODES = sorted({c["dial_code"] for c in PHONE_COUNTRY_METADATA}, key=len, reverse=True)
_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
_ID_SAUDI_RE = re.compile(r'^[12]\d{9}$')
_ID_IQAMA_RE = re.compile(r'^[3-9]\d{9}$')
_PASSPORT_RE = re.compile(r'^[A-Z0-9]{6,12}$')


def _always_on_errors(field_type: TripFieldType, value: str, lang: str) -> List[str]:
    """
    Run always-on validations that apply regardless of provider configuration.
    Returns list of error strings.
    """
    errors: List[str] = []
    ar = lang == "ar"

    if field_type == TripFieldType.GENDER:
        if value not in ("male", "female"):
            errors.append("الجنس يجب أن يكون ذكر أو أنثى" if ar else "Gender must be 'male' or 'female'")

    elif field_type == TripFieldType.NATIONALITY:
        if value.upper() not in _VALID_NATIONALITY_CODES:
            errors.append("الجنسية غير معروفة" if ar else "Unknown nationality code")

    elif field_type == TripFieldType.PHONE:
        clean = re.sub(r'\D', '', value)
        matched_code: Optional[str] = None
        for code in _KNOWN_DIAL_CODES:
            if clean.startswith(code):
                matched_code = code
                break
        if matched_code is None:
            errors.append(
                "رقم الهاتف يجب أن يبدأ برمز دولة معروف" if ar
                else "Phone number must start with a known country dial code"
            )
        else:
            local = clean[len(matched_code):]
            # Strip a leading 0 if present (common notation)
            if local.startswith("0"):
                local = local[1:]
            pattern = PHONE_PATTERNS.get(matched_code)
            if pattern:
                min_d, max_d = pattern["min"], pattern["max"]
                if not (min_d <= len(local) <= max_d):
                    errors.append(
                        f"رقم الهاتف غير صحيح لهذه الدولة" if ar
                        else f"Phone number length is invalid for the detected country code (+{matched_code})"
                    )
                elif "regex" in pattern and not re.match(pattern["regex"], local):
                    errors.append(
                        "رقم الهاتف غير صحيح" if ar
                        else f"Phone number format is invalid for the detected country code (+{matched_code})"
                    )

    elif field_type == TripFieldType.ID_IQAMA_NUMBER:
        if not (_ID_SAUDI_RE.match(value) or _ID_IQAMA_RE.match(value)):
            errors.append(
                "يجب إدخال هوية وطنية سعودية صحيحة (يبدأ بـ 1 أو 2) أو رقم إقامة صحيح (يبدأ بـ 3-9)، 10 أرقام" if ar
                else "Must be a valid Saudi National ID (starts with 1 or 2) or Iqama number (starts with 3-9), exactly 10 digits"
            )

    elif field_type == TripFieldType.PASSPORT_NUMBER:
        if not _PASSPORT_RE.match(value.upper()):
            errors.append(
                "رقم جواز السفر يجب أن يتكون من 6 إلى 12 حرفاً أو رقماً" if ar
                else "Passport number must be 6-12 alphanumeric characters"
            )

    elif field_type == TripFieldType.EMAIL:
        if not _EMAIL_RE.match(value):
            errors.append("البريد الإلكتروني غير صحيح" if ar else "Invalid email address format")
        elif len(value) > 254:
            errors.append("البريد الإلكتروني طويل جداً" if ar else "Email address is too long")

    elif field_type == TripFieldType.NAME:
        if len(value) > 100:
            errors.append("الاسم يجب أن لا يتجاوز 100 حرف" if ar else "Name must not exceed 100 characters")

    elif field_type == TripFieldType.ADDRESS:
        if len(value) > 300:
            errors.append("العنوان يجب أن لا يتجاوز 300 حرف" if ar else "Address must not exceed 300 characters")

    elif field_type == TripFieldType.MEDICAL_CONDITIONS:
        if len(value) > 500:
            errors.append("يجب أن لا يتجاوز 500 حرف" if ar else "Medical conditions must not exceed 500 characters")

    elif field_type == TripFieldType.ALLERGIES:
        if len(value) > 500:
            errors.append("يجب أن لا يتجاوز 500 حرف" if ar else "Allergies must not exceed 500 characters")

    return errors


# ---------------------------------------------------------------------------
# Provider-configurable validators (further restrict the always-on defaults)
# ---------------------------------------------------------------------------

class FieldValidator:
    """Provider-configurable validation logic."""

    @staticmethod
    def validate_min_age(value: str, config: Dict[str, Any]) -> bool:
        try:
            birth_date = datetime.strptime(value, "%Y-%m-%d").date()
            today = date.today()
            age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            return age >= config["min_value"]
        except (ValueError, KeyError):
            return False

    @staticmethod
    def validate_max_age(value: str, config: Dict[str, Any]) -> bool:
        try:
            birth_date = datetime.strptime(value, "%Y-%m-%d").date()
            today = date.today()
            age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            return age <= config["max_value"]
        except (ValueError, KeyError):
            return False

    @staticmethod
    def validate_phone_country_codes(value: str, config: Dict[str, Any]) -> bool:
        """Restrict phone to a subset of allowed dial codes (always-on already checked format)."""
        try:
            allowed_codes: List[str] = config["allowed_codes"]
            clean = re.sub(r'\D', '', value)
            for code in sorted(allowed_codes, key=len, reverse=True):
                if clean.startswith(code):
                    return True
            return False
        except KeyError:
            return False

    @staticmethod
    def validate_gender_restrictions(value: str, config: Dict[str, Any]) -> bool:
        """Restrict to a provider-chosen subset of genders (always-on already verified male/female)."""
        try:
            allowed_genders: List[str] = config["allowed_genders"]
            return value in allowed_genders
        except KeyError:
            return False

    @staticmethod
    def validate_nationality_restriction(value: str, config: Dict[str, Any]) -> bool:
        """Restrict to provider-chosen nationalities (always-on already verified code exists)."""
        try:
            allowed: List[str] = config["allowed_nationalities"]
            return value.upper() in [n.upper() for n in allowed]
        except KeyError:
            return False


# Registry
VALIDATION_FUNCTIONS: Dict[ValidationType, Callable[[str, Dict[str, Any]], bool]] = {
    ValidationType.MIN_AGE: FieldValidator.validate_min_age,
    ValidationType.MAX_AGE: FieldValidator.validate_max_age,
    ValidationType.PHONE_COUNTRY_CODES: FieldValidator.validate_phone_country_codes,
    ValidationType.GENDER_RESTRICTIONS: FieldValidator.validate_gender_restrictions,
    ValidationType.NATIONALITY_RESTRICTION: FieldValidator.validate_nationality_restriction,
}

# Metadata for provider panel UI
VALIDATION_METADATA: Dict[ValidationType, Dict[str, Any]] = {
    ValidationType.MIN_AGE: {
        "display_name": "Minimum Age",
        "display_name_ar": "الحد الأدنى للعمر",
        "description": "Minimum age requirement based on date of birth",
        "parameters": {
            "min_value": {"type": "number", "description": "Minimum age in years", "required": True}
        }
    },
    ValidationType.MAX_AGE: {
        "display_name": "Maximum Age",
        "display_name_ar": "الحد الأقصى للعمر",
        "description": "Maximum age requirement based on date of birth",
        "parameters": {
            "max_value": {"type": "number", "description": "Maximum age in years", "required": True}
        }
    },
    ValidationType.PHONE_COUNTRY_CODES: {
        "display_name": "Allowed Phone Countries",
        "display_name_ar": "دول الهاتف المسموح بها",
        "description": "Restrict phone numbers to selected countries (number format is always validated)",
        "parameters": {
            "allowed_codes": {
                "type": "phone_country_picker",
                "description": "Select allowed countries",
                "required": True
            }
        }
    },
    ValidationType.GENDER_RESTRICTIONS: {
        "display_name": "Gender Restriction",
        "display_name_ar": "تقييد الجنس",
        "description": "Limit participants to a specific gender (male or female are always the only options)",
        "parameters": {
            "allowed_genders": {
                "type": "gender_picker",
                "description": "Select allowed genders",
                "required": True
            }
        }
    },
    ValidationType.NATIONALITY_RESTRICTION: {
        "display_name": "Allowed Nationalities",
        "display_name_ar": "الجنسيات المسموح بها",
        "description": "Restrict participation to specific nationalities",
        "parameters": {
            "allowed_nationalities": {
                "type": "nationality_picker",
                "description": "Select allowed nationalities",
                "required": True
            }
        }
    },
}


# ---------------------------------------------------------------------------
# Helper: get available validations for a field type
# ---------------------------------------------------------------------------
def _get_field_available_validations(field_type: TripFieldType) -> List[ValidationType]:
    from .trip_field import FIELD_METADATA
    validation_strings = FIELD_METADATA.get(field_type, {}).get("available_validations", [])
    return [ValidationType(vs) for vs in validation_strings if vs in [vt.value for vt in ValidationType]]


def _build_error_message(
    validation_type: "ValidationType",
    config: Dict[str, Any],
    lang: str = "en",
) -> str:
    """Return a specific, human-readable error message for a failed validation."""

    if validation_type == ValidationType.MIN_AGE:
        min_val = config.get("min_value", "?")
        if lang == "ar":
            return f"الحد الأدنى للعمر هو {min_val} سنة"
        return f"Minimum age requirement is {min_val} years"

    if validation_type == ValidationType.MAX_AGE:
        max_val = config.get("max_value", "?")
        if lang == "ar":
            return f"الحد الأقصى للعمر هو {max_val} سنة"
        return f"Maximum age allowed is {max_val} years"

    if validation_type == ValidationType.PHONE_COUNTRY_CODES:
        codes = config.get("allowed_codes", [])
        # Map dial codes to country names
        code_to_name = {c["dial_code"]: (c["name_ar"] if lang == "ar" else c["name"]) for c in PHONE_COUNTRY_METADATA}
        names = [code_to_name.get(c, f"+{c}") for c in codes]
        names_str = "، ".join(names) if lang == "ar" else ", ".join(names)
        if lang == "ar":
            return f"رقم الهاتف يجب أن يكون من: {names_str}"
        return f"Phone number must be from: {names_str}"

    if validation_type == ValidationType.GENDER_RESTRICTIONS:
        allowed = config.get("allowed_genders", [])
        if lang == "ar":
            gender_map = {"male": "ذكور", "female": "إناث"}
            names = [gender_map.get(g, g) for g in allowed]
            return f"هذه الرحلة مخصصة لـ: {' و'.join(names)} فقط"
        gender_map_en = {"male": "males", "female": "females"}
        names_en = [gender_map_en.get(g, g) for g in allowed]
        return f"This trip is for {' and '.join(names_en)} only"

    if validation_type == ValidationType.NATIONALITY_RESTRICTION:
        codes = config.get("allowed_nationalities", [])
        code_to_name = {n["code"]: (n["name_ar"] if lang == "ar" else n["name"]) for n in NATIONALITY_LIST}
        names = [code_to_name.get(c.upper(), c) for c in codes]
        names_str = "، ".join(names) if lang == "ar" else ", ".join(names)
        if lang == "ar":
            return f"هذه الرحلة متاحة للجنسيات التالية فقط: {names_str}"
        return f"This trip is available for the following nationalities only: {names_str}"

    # Fallback
    meta = VALIDATION_METADATA.get(validation_type, {})
    name = meta.get("display_name_ar" if lang == "ar" else "display_name", validation_type.value)
    return f"{name} validation failed" if lang == "en" else f"فشل التحقق من: {name}"


def validate_field_value(
    field_type: TripFieldType,
    value: str,
    validation_config: Optional[Dict[str, Any]],
    lang: str = "en",
) -> List[str]:
    """
    Validate a field value in two phases:
    1. Always-on checks: format/range rules that apply regardless of provider config
       (gender must be male/female, nationality from known list, phone full format,
        ID/Iqama format, passport format, email format, text length limits).
    2. Provider-configurable restrictions: further narrow the allowed set
       (e.g. phone_country_codes, gender_restrictions, nationality_restriction, min/max age).

    Returns list of error messages (empty = valid).
    lang: 'en' or 'ar' — controls the language of returned error messages.
    """
    # Phase 1: always-on
    errors = _always_on_errors(field_type, value, lang)

    # If always-on already found errors, skip provider restrictions
    # (no point saying "only SA phones allowed" if the number itself is invalid)
    if errors:
        return errors

    # Phase 2: provider-configurable restrictions
    if not validation_config:
        return errors

    available = _get_field_available_validations(field_type)

    for validation_type_str, config in validation_config.items():
        try:
            validation_type = ValidationType(validation_type_str)
        except ValueError:
            continue

        if validation_type not in available:
            continue

        validation_func = VALIDATION_FUNCTIONS.get(validation_type)
        if not validation_func:
            continue

        if not validation_func(value, config):
            errors.append(_build_error_message(validation_type, config, lang))

    return errors


def get_available_validations_for_field(field_type: TripFieldType) -> Dict[str, Dict[str, Any]]:
    available = _get_field_available_validations(field_type)
    return {
        vt.value: VALIDATION_METADATA[vt]
        for vt in available
        if vt in VALIDATION_METADATA
    }


def validate_validation_config(
    field_type: TripFieldType,
    validation_config: Dict[str, Any],
) -> List[str]:
    """Validate that a validation configuration is valid for a field type."""
    errors: List[str] = []
    available = _get_field_available_validations(field_type)

    for validation_type_str, config in validation_config.items():
        try:
            validation_type = ValidationType(validation_type_str)
        except ValueError:
            errors.append(f"Unknown validation type: '{validation_type_str}'")
            continue

        if validation_type not in available:
            errors.append(
                f"Validation '{validation_type_str}' is not available for field type '{field_type.value}'"
            )
            continue

        meta = VALIDATION_METADATA.get(validation_type, {})
        for param_name, param_info in meta.get("parameters", {}).items():
            if param_info.get("required") and param_name not in config:
                errors.append(
                    f"Missing required parameter '{param_name}' for validation '{validation_type_str}'"
                )

    return errors
