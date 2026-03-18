/**
 * Client-side field validators — mirrors backend `_always_on_errors` + provider config checks.
 * Returns localized error strings via i18next.
 *
 * Usage:
 *   const { validateField } = useFieldValidation();
 *   const error = validateField('email', 'bad-email', { isRequired: true });
 */

import { useTranslation } from 'react-i18next';
import { FieldType } from '../components/booking/ParticipantField';

// Phone patterns per dial code (local digits after stripping code and leading 0)
// Kept minimal — matches the backend PHONE_PATTERNS for the most common codes.
const PHONE_PATTERNS: Record<string, { min: number; max: number }> = {
  '966': { min: 9, max: 9 },   // Saudi Arabia
  '971': { min: 9, max: 9 },   // UAE
  '965': { min: 8, max: 8 },   // Kuwait
  '968': { min: 8, max: 8 },   // Oman
  '974': { min: 8, max: 8 },   // Qatar
  '973': { min: 8, max: 8 },   // Bahrain
  '1':   { min: 10, max: 10 }, // US/Canada
  '44':  { min: 10, max: 11 }, // UK
  '20':  { min: 10, max: 11 }, // Egypt
  '962': { min: 8, max: 9 },   // Jordan
  '961': { min: 7, max: 8 },   // Lebanon
  '963': { min: 9, max: 9 },   // Syria
  '964': { min: 10, max: 10 }, // Iraq
  '967': { min: 9, max: 9 },   // Yemen
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_SAUDI_RE = /^[12]\d{9}$/;
const ID_IQAMA_RE = /^[3-9]\d{9}$/;
const PASSPORT_RE = /^[A-Z0-9]{6,12}$/i;

export interface ValidationConfig {
  isRequired?: boolean;
  /** Provider-configurable extras */
  validationConfig?: Record<string, any> | null;
  /** For nationality/gender selects: known valid values */
  knownValues?: string[];
}

export function useFieldValidation() {
  const { t } = useTranslation();

  /**
   * Returns the first error string for a field, or null if valid.
   * Pass empty string / undefined value to check required-only.
   */
  const validateField = (
    fieldType: FieldType,
    value: string | undefined,
    config: ValidationConfig = {},
  ): string | null => {
    const { isRequired, validationConfig, knownValues } = config;
    const v = (value ?? '').trim();

    // Required check
    if (isRequired && !v) {
      return t('fieldValidation.required');
    }

    // Skip format checks if empty (optional field)
    if (!v) return null;

    switch (fieldType) {
      case 'name': {
        if (v.length > 100) return t('fieldValidation.nameTooLong');
        break;
      }

      case 'email': {
        if (!EMAIL_RE.test(v)) return t('fieldValidation.emailInvalid');
        if (v.length > 254) return t('fieldValidation.emailTooLong');
        break;
      }

      case 'phone': {
        // Value is stored as dialCode+localNumber e.g. "+96650123456"
        const digits = v.replace(/\D/g, '');
        // Find matching dial code
        const sortedCodes = Object.keys(PHONE_PATTERNS).sort((a, b) => b.length - a.length);
        let matched: string | null = null;
        for (const code of sortedCodes) {
          if (digits.startsWith(code)) { matched = code; break; }
        }
        if (!matched) {
          // Unknown code — just check non-empty (backend will validate fully)
          if (digits.length < 7) return t('fieldValidation.phoneTooShort');
          if (digits.length > 15) return t('fieldValidation.phoneTooLong');
        } else {
          let local = digits.slice(matched.length);
          if (local.startsWith('0')) local = local.slice(1);
          const pattern = PHONE_PATTERNS[matched];
          if (local.length < pattern.min) return t('fieldValidation.phoneTooShort');
          if (local.length > pattern.max) return t('fieldValidation.phoneTooLong');
        }

        // Provider config: restrict to specific country codes
        if (validationConfig?.phone_country_codes?.allowed_codes) {
          const allowed: string[] = validationConfig.phone_country_codes.allowed_codes;
          const normAllowed = allowed.map(c => c.replace(/\D/g, ''));
          const hasMatch = normAllowed.some(code => digits.startsWith(code));
          if (!hasMatch) {
            return t('fieldValidation.phoneCountryRestricted', { countries: allowed.join(', ') });
          }
        }
        break;
      }

      case 'id_iqama_number': {
        if (!ID_SAUDI_RE.test(v) && !ID_IQAMA_RE.test(v)) {
          return t('fieldValidation.idInvalid');
        }
        break;
      }

      case 'passport_number': {
        if (!PASSPORT_RE.test(v.toUpperCase())) {
          return t('fieldValidation.passportInvalid');
        }
        break;
      }

      case 'date_of_birth': {
        const parts = v.split('-');
        if (parts.length !== 3) return t('fieldValidation.dobInvalid');
        const d = new Date(`${v}T12:00:00`);
        if (isNaN(d.getTime())) return t('fieldValidation.dobInvalid');
        if (d >= new Date()) return t('fieldValidation.dobFuture');

        // Provider config: min_age / max_age
        if (validationConfig?.min_age?.min_value != null) {
          const minAge = validationConfig.min_age.min_value;
          const today = new Date();
          const age = today.getFullYear() - d.getFullYear()
            - ((today.getMonth() * 100 + today.getDate()) < (d.getMonth() * 100 + d.getDate()) ? 1 : 0);
          if (age < minAge) return t('fieldValidation.minAge', { age: minAge });
        }
        if (validationConfig?.max_age?.max_value != null) {
          const maxAge = validationConfig.max_age.max_value;
          const today = new Date();
          const age = today.getFullYear() - d.getFullYear()
            - ((today.getMonth() * 100 + today.getDate()) < (d.getMonth() * 100 + d.getDate()) ? 1 : 0);
          if (age > maxAge) return t('fieldValidation.maxAge', { age: maxAge });
        }
        break;
      }

      case 'nationality': {
        if (knownValues && knownValues.length > 0 && !knownValues.includes(v.toUpperCase())) {
          return t('fieldValidation.nationalityInvalid');
        }
        // Provider restriction
        if (validationConfig?.nationality_restriction?.allowed_nationalities) {
          const allowed: string[] = validationConfig.nationality_restriction.allowed_nationalities;
          if (!allowed.map(n => n.toUpperCase()).includes(v.toUpperCase())) {
            return t('fieldValidation.nationalityRestricted', { nationalities: allowed.join(', ') });
          }
        }
        break;
      }

      case 'gender': {
        if (!['male', 'female'].includes(v)) return t('fieldValidation.genderInvalid');
        // Provider restriction
        if (validationConfig?.gender_restrictions?.allowed_genders) {
          const allowed: string[] = validationConfig.gender_restrictions.allowed_genders;
          if (!allowed.includes(v)) {
            return t('fieldValidation.genderRestricted', { genders: allowed.join(', ') });
          }
        }
        break;
      }

      case 'address': {
        if (v.length > 300) return t('fieldValidation.addressTooLong');
        break;
      }

      case 'medical_conditions': {
        if (v.length > 500) return t('fieldValidation.medicalTooLong');
        break;
      }

      case 'allergies': {
        if (v.length > 500) return t('fieldValidation.allergiesTooLong');
        break;
      }
    }

    return null;
  };

  /**
   * Validates all participants for all required fields.
   * Returns a map: participantIndex -> fieldType -> errorString
   * Empty map = all valid.
   */
  const validateAllParticipants = (
    participants: Array<Record<string, string | undefined>>,
    fieldDefs: Array<{ field_type: FieldType; is_required: boolean; validation_config: Record<string, any> | null }>,
    nationalityCodes?: string[],
  ): Record<number, Record<string, string>> => {
    const errors: Record<number, Record<string, string>> = {};
    participants.forEach((participant, idx) => {
      fieldDefs.forEach(({ field_type, is_required, validation_config }) => {
        const error = validateField(field_type, participant[field_type], {
          isRequired: is_required,
          validationConfig: validation_config,
          knownValues: field_type === 'nationality' ? nationalityCodes : undefined,
        });
        if (error) {
          if (!errors[idx]) errors[idx] = {};
          errors[idx][field_type] = error;
        }
      });
    });
    return errors;
  };

  return { validateField, validateAllParticipants };
}
