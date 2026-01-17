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
        "ui_type": UIFieldType.TEXT,
        "placeholder": "Enter full name",
        "required": True,
        "available_validations": ["min_length", "max_length", "regex_pattern"]
    },
    TripFieldType.EMAIL: {
        "display_name": "Email Address",
        "ui_type": UIFieldType.EMAIL,
        "placeholder": "Enter email address",
        "required": True,
        "available_validations": ["min_length", "max_length", "regex_pattern"]
    },
    TripFieldType.PHONE: {
        "display_name": "Phone Number",
        "ui_type": UIFieldType.PHONE,
        "placeholder": "Enter phone number",
        "required": True,
        "available_validations": ["phone_country_codes", "phone_min_length", "phone_max_length", "regex_pattern"]
    },
    TripFieldType.ID_IQAMA_NUMBER: {
        "display_name": "ID/Iqama Number",
        "ui_type": UIFieldType.TEXT,
        "placeholder": "Enter ID or Iqama number",
        "required": True,
        "available_validations": ["saudi_id_format", "iqama_format", "regex_pattern", "min_length", "max_length"]
    },
    TripFieldType.PASSPORT_NUMBER: {
        "display_name": "Passport Number",
        "ui_type": UIFieldType.TEXT,
        "placeholder": "Enter passport number",
        "required": True,
        "available_validations": ["passport_format", "regex_pattern", "min_length", "max_length"]
    },
    TripFieldType.DATE_OF_BIRTH: {
        "display_name": "Date of Birth",
        "ui_type": UIFieldType.DATE,
        "placeholder": "Select date of birth",
        "required": True,
        "available_validations": ["min_age", "max_age"]
    },
    TripFieldType.GENDER: {
        "display_name": "Gender",
        "ui_type": UIFieldType.SELECT,
        "options": [
            {"value": GenderType.MALE.value, "label": "Male"},
            {"value": GenderType.FEMALE.value, "label": "Female"},
            {"value": GenderType.PREFER_NOT_TO_SAY.value, "label": "Prefer not to say"}
        ],
        "required": False,
        "available_validations": ["gender_restrictions"]
    },
    TripFieldType.ADDRESS: {
        "display_name": "Address",
        "ui_type": UIFieldType.TEXTAREA,
        "placeholder": "Enter full address",
        "required": False,
        "available_validations": ["min_length", "max_length", "regex_pattern"]
    },
    TripFieldType.CITY: {
        "display_name": "City",
        "ui_type": UIFieldType.TEXT, 
        "placeholder": "Enter city",
        "required": False,
        "available_validations": ["min_length", "max_length", "regex_pattern"]
    },
    TripFieldType.COUNTRY: {
        "display_name": "Country",
        "ui_type": UIFieldType.TEXT,
        "placeholder": "Enter country",
        "required": False,
        "available_validations": ["min_length", "max_length", "regex_pattern"]
    },
    TripFieldType.DISABILITY: {
        "display_name": "Disability",
        "ui_type": UIFieldType.SELECT,
        "options": [
            {"value": DisabilityType.NONE.value, "label": "None"},
            {"value": DisabilityType.MOBILITY.value, "label": "Mobility"},
            {"value": DisabilityType.VISUAL.value, "label": "Visual"},
            {"value": DisabilityType.HEARING.value, "label": "Hearing"},
            {"value": DisabilityType.COGNITIVE.value, "label": "Cognitive"},
            {"value": DisabilityType.OTHER.value, "label": "Other"}
        ],
        "required": False,
        "available_validations": []
    },
    TripFieldType.MEDICAL_CONDITIONS: {
        "display_name": "Medical Conditions",
        "ui_type": UIFieldType.TEXTAREA,
        "placeholder": "Describe any medical conditions",
        "required": False,
        "available_validations": ["min_length", "max_length", "regex_pattern"]
    },
    TripFieldType.ALLERGIES: {
        "display_name": "Allergies",
        "ui_type": UIFieldType.TEXTAREA,
        "placeholder": "List any allergies",
        "required": False,
        "available_validations": ["min_length", "max_length", "regex_pattern"]
    }
}


