import uuid
from enum import Enum
from typing import TYPE_CHECKING, List, Dict, Any

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import ENUM as SQLEnum
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .trip import Trip


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
        "required": True
    },
    TripFieldType.EMAIL: {
        "display_name": "Email Address",
        "ui_type": UIFieldType.EMAIL,
        "placeholder": "Enter email address",
        "required": True
    },
    TripFieldType.PHONE: {
        "display_name": "Phone Number",
        "ui_type": UIFieldType.PHONE,
        "placeholder": "Enter phone number",
        "required": True
    },
    TripFieldType.ID_IQAMA_NUMBER: {
        "display_name": "ID/Iqama Number",
        "ui_type": UIFieldType.TEXT,
        "placeholder": "Enter ID or Iqama number",
        "required": True
    },
    TripFieldType.PASSPORT_NUMBER: {
        "display_name": "Passport Number",
        "ui_type": UIFieldType.TEXT,
        "placeholder": "Enter passport number",
        "required": True
    },
    TripFieldType.DATE_OF_BIRTH: {
        "display_name": "Date of Birth",
        "ui_type": UIFieldType.DATE,
        "placeholder": "Select date of birth",
        "required": True
    },
    TripFieldType.GENDER: {
        "display_name": "Gender",
        "ui_type": UIFieldType.SELECT,
        "options": [
            {"value": GenderType.MALE.value, "label": "Male"},
            {"value": GenderType.FEMALE.value, "label": "Female"},
            {"value": GenderType.PREFER_NOT_TO_SAY.value, "label": "Prefer not to say"}
        ],
        "required": False
    },
    TripFieldType.ADDRESS: {
        "display_name": "Address",
        "ui_type": UIFieldType.TEXTAREA,
        "placeholder": "Enter full address",
        "required": False
    },
    TripFieldType.CITY: {
        "display_name": "City",
        "ui_type": UIFieldType.TEXT,
        "placeholder": "Enter city",
        "required": False
    },
    TripFieldType.COUNTRY: {
        "display_name": "Country",
        "ui_type": UIFieldType.TEXT,
        "placeholder": "Enter country",
        "required": False
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
        "required": False
    },
    TripFieldType.MEDICAL_CONDITIONS: {
        "display_name": "Medical Conditions",
        "ui_type": UIFieldType.TEXTAREA,
        "placeholder": "Describe any medical conditions",
        "required": False
    },
    TripFieldType.ALLERGIES: {
        "display_name": "Allergies",
        "ui_type": UIFieldType.TEXTAREA,
        "placeholder": "List any allergies",
        "required": False
    }
}


class TripRequiredField(SQLModel, table=True):
    """Model to store which fields are required for a specific trip"""
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(foreign_key="trip.id")
    field_type: TripFieldType = Field(sa_column=Column(SQLEnum(TripFieldType, name='tripfieldtype', values_callable=lambda obj: [e.value for e in obj])))
    is_required: bool = Field(default=True)
    
    trip: "Trip" = Relationship(back_populates="required_fields")
