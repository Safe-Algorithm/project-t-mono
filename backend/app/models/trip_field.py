from enum import Enum
from typing import Dict, Any



class TripFieldType(str, Enum):
    """Enum for trip required field types"""
    ID_IQAMA_NUMBER = "id_iqama_number"
    PASSPORT_NUMBER = "passport_number"
    NAME = "name"
    PHONE = "phone"
    EMAIL = "email"
    ADDRESS = "address"
    CITY = "city"
    COUNTRY = "country"
    DATE_OF_BIRTH = "date_of_birth"
    GENDER = "gender"
    DISABILITY = "disability"
    MEDICAL_CONDITIONS = "medical_conditions"
    ALLERGIES = "allergies"


class GenderType(str, Enum):
    """Enum for gender field"""
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"


class DisabilityType(str, Enum):
    """Enum for disability field"""
    NONE = "none"
    MOBILITY = "mobility"
    VISUAL = "visual"
    HEARING = "hearing"
    COGNITIVE = "cognitive"
    OTHER = "other"


class UIFieldType(str, Enum):
    """Enum for UI field display types"""
    TEXT = "text"
    EMAIL = "email"
    PHONE = "phone"
    NUMBER = "number"
    DATE = "date"
    SELECT = "select"
    TEXTAREA = "textarea"
    FILE = "file"


# Field metadata mapping for UI display
FIELD_METADATA: Dict[TripFieldType, Dict[str, Any]] = {
    TripFieldType.NAME: {
        "display_name": "Full Name",
        "display_name_ar": "الاسم الكامل",
        "ui_type": UIFieldType.TEXT,
        "placeholder": "Enter full name",
        "placeholder_ar": "أدخل الاسم الكامل",
        "required": True,
        "available_validations": ["min_length", "max_length", "regex_pattern"]
    },
    TripFieldType.EMAIL: {
        "display_name": "Email Address",
        "display_name_ar": "البريد الإلكتروني",
        "ui_type": UIFieldType.EMAIL,
        "placeholder": "Enter email address",
        "placeholder_ar": "أدخل البريد الإلكتروني",
        "required": True,
        "available_validations": ["min_length", "max_length", "regex_pattern"]
    },
    TripFieldType.PHONE: {
        "display_name": "Phone Number",
        "display_name_ar": "رقم الهاتف",
        "ui_type": UIFieldType.PHONE,
        "placeholder": "Enter phone number",
        "placeholder_ar": "أدخل رقم الهاتف",
        "required": True,
        "available_validations": ["phone_country_codes", "phone_min_length", "phone_max_length", "regex_pattern"]
    },
    TripFieldType.ID_IQAMA_NUMBER: {
        "display_name": "ID/Iqama Number",
        "display_name_ar": "رقم الهوية / الإقامة",
        "ui_type": UIFieldType.TEXT,
        "placeholder": "Enter ID or Iqama number",
        "placeholder_ar": "أدخل رقم الهوية أو الإقامة",
        "required": True,
        "available_validations": ["saudi_id_format", "iqama_format", "regex_pattern", "min_length", "max_length"]
    },
    TripFieldType.PASSPORT_NUMBER: {
        "display_name": "Passport Number",
        "display_name_ar": "رقم جواز السفر",
        "ui_type": UIFieldType.TEXT,
        "placeholder": "Enter passport number",
        "placeholder_ar": "أدخل رقم جواز السفر",
        "required": True,
        "available_validations": ["passport_format", "regex_pattern", "min_length", "max_length"]
    },
    TripFieldType.DATE_OF_BIRTH: {
        "display_name": "Date of Birth",
        "display_name_ar": "تاريخ الميلاد",
        "ui_type": UIFieldType.DATE,
        "placeholder": "Select date of birth",
        "placeholder_ar": "اختر تاريخ الميلاد",
        "required": True,
        "available_validations": ["min_age", "max_age"]
    },
    TripFieldType.GENDER: {
        "display_name": "Gender",
        "display_name_ar": "الجنس",
        "ui_type": UIFieldType.SELECT,
        "options": [
            {"value": GenderType.MALE.value, "label": "Male", "label_ar": "ذكر"},
            {"value": GenderType.FEMALE.value, "label": "Female", "label_ar": "أنثى"},
            {"value": GenderType.PREFER_NOT_TO_SAY.value, "label": "Prefer not to say", "label_ar": "أفضل عدم الإفصاح"}
        ],
        "required": False,
        "available_validations": ["gender_restrictions"]
    },
    TripFieldType.ADDRESS: {
        "display_name": "Address",
        "display_name_ar": "العنوان",
        "ui_type": UIFieldType.TEXTAREA,
        "placeholder": "Enter full address",
        "placeholder_ar": "أدخل العنوان الكامل",
        "required": False,
        "available_validations": ["min_length", "max_length", "regex_pattern"]
    },
    TripFieldType.CITY: {
        "display_name": "City",
        "display_name_ar": "المدينة",
        "ui_type": UIFieldType.TEXT,
        "placeholder": "Enter city",
        "placeholder_ar": "أدخل المدينة",
        "required": False,
        "available_validations": ["min_length", "max_length", "regex_pattern"]
    },
    TripFieldType.COUNTRY: {
        "display_name": "Country",
        "display_name_ar": "الدولة",
        "ui_type": UIFieldType.TEXT,
        "placeholder": "Enter country",
        "placeholder_ar": "أدخل الدولة",
        "required": False,
        "available_validations": ["min_length", "max_length", "regex_pattern"]
    },
    TripFieldType.DISABILITY: {
        "display_name": "Disability",
        "display_name_ar": "الإعاقة",
        "ui_type": UIFieldType.SELECT,
        "options": [
            {"value": DisabilityType.NONE.value, "label": "None", "label_ar": "لا يوجد"},
            {"value": DisabilityType.MOBILITY.value, "label": "Mobility impairment", "label_ar": "إعاقة حركية"},
            {"value": DisabilityType.VISUAL.value, "label": "Visual impairment", "label_ar": "إعاقة بصرية"},
            {"value": DisabilityType.HEARING.value, "label": "Hearing impairment", "label_ar": "إعاقة سمعية"},
            {"value": DisabilityType.COGNITIVE.value, "label": "Cognitive impairment", "label_ar": "إعاقة معرفية"},
            {"value": DisabilityType.OTHER.value, "label": "Other", "label_ar": "غير ذلك"}
        ],
        "required": False,
        "available_validations": []
    },
    TripFieldType.MEDICAL_CONDITIONS: {
        "display_name": "Medical Conditions",
        "display_name_ar": "الحالات الطبية",
        "ui_type": UIFieldType.TEXTAREA,
        "placeholder": "Describe any medical conditions",
        "placeholder_ar": "صف أي حالات طبية",
        "required": False,
        "available_validations": ["min_length", "max_length", "regex_pattern"]
    },
    TripFieldType.ALLERGIES: {
        "display_name": "Allergies",
        "display_name_ar": "الحساسية",
        "ui_type": UIFieldType.TEXTAREA,
        "placeholder": "List any allergies",
        "placeholder_ar": "اذكر أي حساسية",
        "required": False,
        "available_validations": ["min_length", "max_length", "regex_pattern"]
    }
}


