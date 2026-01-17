from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, date
import re
from enum import Enum

from .trip_field import TripFieldType


class ValidationType(str, Enum):
    """Available validation types"""
    MIN_AGE = "min_age"
    MAX_AGE = "max_age"
    MIN_LENGTH = "min_length"
    MAX_LENGTH = "max_length"
    REGEX_PATTERN = "regex_pattern"
    PHONE_COUNTRY_CODES = "phone_country_codes"
    PHONE_MIN_LENGTH = "phone_min_length"
    PHONE_MAX_LENGTH = "phone_max_length"
    GENDER_RESTRICTIONS = "gender_restrictions"
    SAUDI_ID_FORMAT = "saudi_id_format"
    IQAMA_FORMAT = "iqama_format"
    PASSPORT_FORMAT = "passport_format"
    REQUIRED_FORMAT = "required_format"


class ValidationError(Exception):
    """Custom exception for validation errors"""
    pass


class FieldValidator:
    """Class to handle field validation logic"""
    
    @staticmethod
    def validate_min_age(value: str, config: Dict[str, Any]) -> bool:
        """Validate minimum age from date of birth"""
        try:
            birth_date = datetime.strptime(value, "%Y-%m-%d").date()
            today = date.today()
            age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            return age >= config["min_value"]
        except (ValueError, KeyError):
            return False
    
    @staticmethod
    def validate_max_age(value: str, config: Dict[str, Any]) -> bool:
        """Validate maximum age from date of birth"""
        try:
            birth_date = datetime.strptime(value, "%Y-%m-%d").date()
            today = date.today()
            age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            return age <= config["max_value"]
        except (ValueError, KeyError):
            return False
    
    @staticmethod
    def validate_min_length(value: str, config: Dict[str, Any]) -> bool:
        """Validate minimum string length"""
        try:
            return len(value.strip()) >= config["min_length"]
        except KeyError:
            return False
    
    @staticmethod
    def validate_max_length(value: str, config: Dict[str, Any]) -> bool:
        """Validate maximum string length"""
        try:
            return len(value.strip()) <= config["max_length"]
        except KeyError:
            return False
    
    @staticmethod
    def validate_regex_pattern(value: str, config: Dict[str, Any]) -> bool:
        """Validate against regex pattern"""
        try:
            pattern = config["pattern"]
            return bool(re.match(pattern, value))
        except (KeyError, re.error):
            return False
    
    @staticmethod
    def validate_phone_country_codes(value: str, config: Dict[str, Any]) -> bool:
        """Validate phone number country code"""
        try:
            allowed_codes = config["allowed_codes"]
            # Remove any non-digit characters and check if it starts with allowed codes
            clean_phone = re.sub(r'\D', '', value)
            return any(clean_phone.startswith(code) for code in allowed_codes)
        except KeyError:
            return False
    
    @staticmethod
    def validate_phone_min_length(value: str, config: Dict[str, Any]) -> bool:
        """Validate minimum phone number length"""
        try:
            clean_phone = re.sub(r'\D', '', value)
            return len(clean_phone) >= config["min_length"]
        except KeyError:
            return False
    
    @staticmethod
    def validate_phone_max_length(value: str, config: Dict[str, Any]) -> bool:
        """Validate maximum phone number length"""
        try:
            clean_phone = re.sub(r'\D', '', value)
            return len(clean_phone) <= config["max_length"]
        except KeyError:
            return False
    
    @staticmethod
    def validate_gender_restrictions(value: str, config: Dict[str, Any]) -> bool:
        """Validate gender against allowed options"""
        try:
            allowed_genders = config["allowed_genders"]
            return value in allowed_genders
        except KeyError:
            return False
    
    @staticmethod
    def validate_saudi_id_format(value: str, config: Dict[str, Any]) -> bool:
        """Validate Saudi ID format (10 digits, starts with 1 or 2)"""
        pattern = r'^[12]\d{9}$'
        return bool(re.match(pattern, value))
    
    @staticmethod
    def validate_iqama_format(value: str, config: Dict[str, Any]) -> bool:
        """Validate Iqama format (10 digits, starts with 3-9)"""
        pattern = r'^[3-9]\d{9}$'
        return bool(re.match(pattern, value))
    
    @staticmethod
    def validate_passport_format(value: str, config: Dict[str, Any]) -> bool:
        """Validate passport format (alphanumeric, 6-12 characters)"""
        pattern = r'^[A-Z0-9]{6,12}$'
        return bool(re.match(pattern, value.upper()))
    
    @staticmethod
    def validate_required_format(value: str, config: Dict[str, Any]) -> bool:
        """Validate against a required format pattern"""
        try:
            pattern = config["format_pattern"]
            return bool(re.match(pattern, value))
        except (KeyError, re.error):
            return False


# Registry of validation functions
VALIDATION_FUNCTIONS: Dict[ValidationType, Callable[[str, Dict[str, Any]], bool]] = {
    ValidationType.MIN_AGE: FieldValidator.validate_min_age,
    ValidationType.MAX_AGE: FieldValidator.validate_max_age,
    ValidationType.MIN_LENGTH: FieldValidator.validate_min_length,
    ValidationType.MAX_LENGTH: FieldValidator.validate_max_length,
    ValidationType.REGEX_PATTERN: FieldValidator.validate_regex_pattern,
    ValidationType.PHONE_COUNTRY_CODES: FieldValidator.validate_phone_country_codes,
    ValidationType.PHONE_MIN_LENGTH: FieldValidator.validate_phone_min_length,
    ValidationType.PHONE_MAX_LENGTH: FieldValidator.validate_phone_max_length,
    ValidationType.GENDER_RESTRICTIONS: FieldValidator.validate_gender_restrictions,
    ValidationType.SAUDI_ID_FORMAT: FieldValidator.validate_saudi_id_format,
    ValidationType.IQAMA_FORMAT: FieldValidator.validate_iqama_format,
    ValidationType.PASSPORT_FORMAT: FieldValidator.validate_passport_format,
    ValidationType.REQUIRED_FORMAT: FieldValidator.validate_required_format,
}


# Validation metadata for UI configuration
VALIDATION_METADATA: Dict[ValidationType, Dict[str, Any]] = {
    ValidationType.MIN_AGE: {
        "display_name": "Minimum Age",
        "description": "Minimum age requirement based on date of birth",
        "parameters": {
            "min_value": {"type": "number", "description": "Minimum age in years", "required": True}
        }
    },
    ValidationType.MAX_AGE: {
        "display_name": "Maximum Age",
        "description": "Maximum age requirement based on date of birth",
        "parameters": {
            "max_value": {"type": "number", "description": "Maximum age in years", "required": True}
        }
    },
    ValidationType.MIN_LENGTH: {
        "display_name": "Minimum Length",
        "description": "Minimum character length for text fields",
        "parameters": {
            "min_length": {"type": "number", "description": "Minimum number of characters", "required": True}
        }
    },
    ValidationType.MAX_LENGTH: {
        "display_name": "Maximum Length",
        "description": "Maximum character length for text fields",
        "parameters": {
            "max_length": {"type": "number", "description": "Maximum number of characters", "required": True}
        }
    },
    ValidationType.REGEX_PATTERN: {
        "display_name": "Custom Pattern",
        "description": "Custom regex pattern validation",
        "parameters": {
            "pattern": {"type": "string", "description": "Regular expression pattern", "required": True}
        }
    },
    ValidationType.PHONE_COUNTRY_CODES: {
        "display_name": "Allowed Country Codes",
        "description": "Restrict phone numbers to specific country codes",
        "parameters": {
            "allowed_codes": {"type": "array", "description": "List of allowed country codes", "required": True}
        }
    },
    ValidationType.PHONE_MIN_LENGTH: {
        "display_name": "Phone Minimum Length",
        "description": "Minimum length for phone numbers (digits only)",
        "parameters": {
            "min_length": {"type": "number", "description": "Minimum number of digits", "required": True}
        }
    },
    ValidationType.PHONE_MAX_LENGTH: {
        "display_name": "Phone Maximum Length",
        "description": "Maximum length for phone numbers (digits only)",
        "parameters": {
            "max_length": {"type": "number", "description": "Maximum number of digits", "required": True}
        }
    },
    ValidationType.GENDER_RESTRICTIONS: {
        "display_name": "Gender Restrictions",
        "description": "Limit to specific gender options",
        "parameters": {
            "allowed_genders": {"type": "array", "description": "List of allowed gender values", "required": True}
        }
    },
    ValidationType.SAUDI_ID_FORMAT: {
        "display_name": "Saudi ID Format",
        "description": "Validate Saudi national ID format (10 digits, starts with 1 or 2)",
        "parameters": {}
    },
    ValidationType.IQAMA_FORMAT: {
        "display_name": "Iqama Format",
        "description": "Validate Iqama format (10 digits, starts with 3-9)",
        "parameters": {}
    },
    ValidationType.PASSPORT_FORMAT: {
        "display_name": "Passport Format",
        "description": "Validate passport format (6-12 alphanumeric characters)",
        "parameters": {}
    },
    ValidationType.REQUIRED_FORMAT: {
        "display_name": "Required Format",
        "description": "Validate against a specific format pattern",
        "parameters": {
            "format_pattern": {"type": "string", "description": "Required format regex pattern", "required": True}
        }
    }
}


# Helper function to get available validations from FIELD_METADATA
def _get_field_available_validations(field_type: TripFieldType) -> List[ValidationType]:
    """Get available validations for a field type from FIELD_METADATA"""
    from .trip_field import FIELD_METADATA
    
    validation_strings = FIELD_METADATA.get(field_type, {}).get("available_validations", [])
    return [ValidationType(vs) for vs in validation_strings if vs in [vt.value for vt in ValidationType]]


def validate_field_value(field_type: TripFieldType, value: str, validation_config: Optional[Dict[str, Any]]) -> List[str]:
    """
    Validate a field value against its validation configuration
    
    Args:
        field_type: The type of field being validated
        value: The value to validate
        validation_config: Dictionary of validation rules
    
    Returns:
        List of validation error messages (empty if valid)
    """
    if not validation_config:
        return []
    
    errors = []
    
    for validation_type_str, config in validation_config.items():
        try:
            validation_type = ValidationType(validation_type_str)
            
            # Check if this validation is available for this field type
            if validation_type not in _get_field_available_validations(field_type):
                continue
            
            # Get validation function
            validation_func = VALIDATION_FUNCTIONS.get(validation_type)
            if not validation_func:
                continue
            
            # Perform validation
            if not validation_func(value, config):
                validation_meta = VALIDATION_METADATA.get(validation_type, {})
                error_msg = f"{validation_meta.get('display_name', validation_type)} validation failed"
                errors.append(error_msg)
                
        except (ValueError, TypeError):
            # Skip invalid validation types
            continue
    
    return errors


def get_available_validations_for_field(field_type: TripFieldType) -> Dict[str, Dict[str, Any]]:
    """
    Get available validation types for a specific field type
    
    Args:
        field_type: The field type to get validations for
        
    Returns:
        Dictionary of available validation types with their metadata
    """
    available_validations = _get_field_available_validations(field_type)
    return {
        validation_type.value: VALIDATION_METADATA[validation_type]
        for validation_type in available_validations
        if validation_type in VALIDATION_METADATA
    }


def validate_validation_config(field_type: TripFieldType, validation_config: Dict[str, Any]) -> List[str]:
    """
    Validate that a validation configuration is valid for a field type
    
    Args:
        field_type: The field type
        validation_config: The validation configuration to validate
    
    Returns:
        List of configuration error messages (empty if valid)
    """
    errors = []
    available_validations = _get_field_available_validations(field_type)
    
    for validation_type_str, config in validation_config.items():
        try:
            validation_type = ValidationType(validation_type_str)
            
            # Check if validation is available for this field
            if validation_type not in available_validations:
                errors.append(f"Validation '{validation_type_str}' is not available for field type '{field_type.value}'")
                continue
            
            # Check required parameters
            validation_meta = VALIDATION_METADATA.get(validation_type, {})
            required_params = {
                param_name: param_info 
                for param_name, param_info in validation_meta.get("parameters", {}).items()
                if param_info.get("required", False)
            }
            
            for param_name, param_info in required_params.items():
                if param_name not in config:
                    errors.append(f"Missing required parameter '{param_name}' for validation '{validation_type_str}'")
                    
        except ValueError:
            errors.append(f"Unknown validation type: '{validation_type_str}'")
    
    return errors
