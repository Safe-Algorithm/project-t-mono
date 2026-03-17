/**
 * Tests for ParticipantField component:
 *   - Renders correct UI per field type (text, email, phone, date, select, textarea, searchable-select)
 *   - Uses localized display_name from metadata
 *   - Falls back to humanised field_type when no metadata
 *   - Shows required asterisk when isRequired=true
 *   - Gender select filters options by allowedGenders
 *   - Nationality searchable select searches both EN and AR names
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('../../lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (k: string) => k },
}));

jest.mock('../../store/languageStore', () => ({
  useLanguageStore: () => ({ language: 'en', setLanguage: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: any) => (typeof fallback === 'string' ? fallback : k),
    i18n: { language: 'en' },
  }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#F8FAFC', surface: '#FFFFFF', primary: '#0EA5E9',
      primarySurface: '#E0F2FE', textPrimary: '#0F172A', textSecondary: '#475569',
      textTertiary: '#94A3B8', border: '#E2E8F0', error: '#EF4444',
      success: '#22C55E', gray200: '#E2E8F0', white: '#FFFFFF',
    },
  }),
}));

import ParticipantField from '../../components/booking/ParticipantField';
import type { FieldMetadata, NationalityOption } from '../../hooks/useTrips';

const makeMetadata = (overrides: Partial<FieldMetadata> = {}): FieldMetadata => ({
  field_name: 'name',
  display_name: 'Full Name',
  ui_type: 'text',
  required: true,
  ...overrides,
});

// ── Label display ─────────────────────────────────────────────────────────────

describe('ParticipantField — label display', () => {
  it('shows display_name from metadata', () => {
    const { getByText } = render(
      <ParticipantField
        fieldType="name"
        value=""
        onChange={jest.fn()}
        metadata={makeMetadata({ display_name: 'Full Name' })}
      />
    );
    expect(getByText('Full Name')).toBeTruthy();
  });

  it('falls back to humanised field_type when no metadata', () => {
    const { getByText } = render(
      <ParticipantField fieldType="date_of_birth" value="" onChange={jest.fn()} />
    );
    expect(getByText('date of birth')).toBeTruthy();
  });

  it('shows required asterisk when isRequired=true', () => {
    const { getByText } = render(
      <ParticipantField
        fieldType="name"
        value=""
        onChange={jest.fn()}
        isRequired
        metadata={makeMetadata()}
      />
    );
    expect(getByText('*')).toBeTruthy();
  });

  it('does not show asterisk when isRequired=false', () => {
    const { queryByText } = render(
      <ParticipantField
        fieldType="name"
        value=""
        onChange={jest.fn()}
        isRequired={false}
        metadata={makeMetadata()}
      />
    );
    expect(queryByText('*')).toBeNull();
  });
});

// ── Plain text inputs ─────────────────────────────────────────────────────────

describe('ParticipantField — text inputs', () => {
  it('renders a TextInput for name field', () => {
    const { UNSAFE_getByType } = render(
      <ParticipantField fieldType="name" value="Alice" onChange={jest.fn()} metadata={makeMetadata()} />
    );
    const { TextInput } = require('react-native');
    expect(UNSAFE_getByType(TextInput)).toBeTruthy();
  });

  it('calls onChange when text changes', () => {
    const onChange = jest.fn();
    const { UNSAFE_getByType } = render(
      <ParticipantField fieldType="name" value="" onChange={onChange} metadata={makeMetadata()} />
    );
    const { TextInput } = require('react-native');
    fireEvent.changeText(UNSAFE_getByType(TextInput), 'Bob');
    expect(onChange).toHaveBeenCalledWith('Bob');
  });

  it('uses email-address keyboardType for email field', () => {
    const { UNSAFE_getByType } = render(
      <ParticipantField
        fieldType="email"
        value=""
        onChange={jest.fn()}
        metadata={makeMetadata({ field_name: 'email', ui_type: 'email', display_name: 'Email' })}
      />
    );
    const { TextInput } = require('react-native');
    expect(UNSAFE_getByType(TextInput).props.keyboardType).toBe('email-address');
  });

  it('uses phone-pad keyboardType for phone field', () => {
    const { UNSAFE_getByType } = render(
      <ParticipantField
        fieldType="phone"
        value=""
        onChange={jest.fn()}
        metadata={makeMetadata({ field_name: 'phone', ui_type: 'phone', display_name: 'Phone' })}
      />
    );
    const { TextInput } = require('react-native');
    expect(UNSAFE_getByType(TextInput).props.keyboardType).toBe('phone-pad');
  });

  it('uses autoCapitalize=characters for id_iqama_number', () => {
    const { UNSAFE_getByType } = render(
      <ParticipantField
        fieldType="id_iqama_number"
        value=""
        onChange={jest.fn()}
        metadata={makeMetadata({ field_name: 'id_iqama_number', ui_type: 'text', display_name: 'ID/Iqama' })}
      />
    );
    const { TextInput } = require('react-native');
    expect(UNSAFE_getByType(TextInput).props.autoCapitalize).toBe('characters');
  });

  it('uses autoCapitalize=characters for passport_number', () => {
    const { UNSAFE_getByType } = render(
      <ParticipantField
        fieldType="passport_number"
        value=""
        onChange={jest.fn()}
        metadata={makeMetadata({ field_name: 'passport_number', ui_type: 'text', display_name: 'Passport' })}
      />
    );
    const { TextInput } = require('react-native');
    expect(UNSAFE_getByType(TextInput).props.autoCapitalize).toBe('characters');
  });
});

// ── Textarea ──────────────────────────────────────────────────────────────────

describe('ParticipantField — textarea', () => {
  it('renders multiline TextInput for textarea ui_type', () => {
    const { UNSAFE_getByType } = render(
      <ParticipantField
        fieldType="medical_conditions"
        value=""
        onChange={jest.fn()}
        metadata={makeMetadata({ field_name: 'medical_conditions', ui_type: 'textarea', display_name: 'Medical Conditions' })}
      />
    );
    const { TextInput } = require('react-native');
    expect(UNSAFE_getByType(TextInput).props.multiline).toBe(true);
  });
});

// ── Gender select ─────────────────────────────────────────────────────────────

describe('ParticipantField — gender select', () => {
  const genderMetadata = makeMetadata({
    field_name: 'gender',
    ui_type: 'select',
    display_name: 'Gender',
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
    ],
  });

  it('renders both options when no allowedGenders filter', () => {
    const { getByText, UNSAFE_getByType } = render(
      <ParticipantField
        fieldType="gender"
        value=""
        onChange={jest.fn()}
        metadata={genderMetadata}
      />
    );
    // Tap the selector to open modal
    const { TouchableOpacity } = require('react-native');
    fireEvent.press(UNSAFE_getByType(TouchableOpacity));
    expect(getByText('Male')).toBeTruthy();
    expect(getByText('Female')).toBeTruthy();
  });

  it('filters options to only female when allowedGenders=["female"]', () => {
    const { queryByText, UNSAFE_getByType } = render(
      <ParticipantField
        fieldType="gender"
        value=""
        onChange={jest.fn()}
        metadata={genderMetadata}
        allowedGenders={['female']}
      />
    );
    const { TouchableOpacity } = require('react-native');
    fireEvent.press(UNSAFE_getByType(TouchableOpacity));
    expect(queryByText('Male')).toBeNull();
    expect(queryByText('Female')).toBeTruthy();
  });

  it('calls onChange with selected gender value', () => {
    const onChange = jest.fn();
    const { getByText, UNSAFE_getByType } = render(
      <ParticipantField
        fieldType="gender"
        value=""
        onChange={onChange}
        metadata={genderMetadata}
      />
    );
    const { TouchableOpacity } = require('react-native');
    fireEvent.press(UNSAFE_getByType(TouchableOpacity));
    fireEvent.press(getByText('Female'));
    expect(onChange).toHaveBeenCalledWith('female');
  });
});

// ── Nationality searchable select ─────────────────────────────────────────────

describe('ParticipantField — nationality searchable select', () => {
  const nationalities: NationalityOption[] = [
    { code: 'SA', name: 'Saudi', name_en: 'Saudi', name_ar: 'سعودي' },
    { code: 'EG', name: 'Egyptian', name_en: 'Egyptian', name_ar: 'مصري' },
  ];

  const natMetadata = makeMetadata({
    field_name: 'nationality',
    ui_type: 'select',
    display_name: 'Nationality',
  });

  it('renders nationality options in the search list', () => {
    const { getByText, UNSAFE_getAllByType } = render(
      <ParticipantField
        fieldType="nationality"
        value=""
        onChange={jest.fn()}
        metadata={natMetadata}
        nationalityOptions={nationalities}
      />
    );
    const { TouchableOpacity } = require('react-native');
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(getByText('Saudi')).toBeTruthy();
    expect(getByText('Egyptian')).toBeTruthy();
  });

  it('calls onChange with ISO code when nationality is selected', () => {
    const onChange = jest.fn();
    const { getByText, UNSAFE_getAllByType } = render(
      <ParticipantField
        fieldType="nationality"
        value=""
        onChange={onChange}
        metadata={natMetadata}
        nationalityOptions={nationalities}
      />
    );
    const { TouchableOpacity } = require('react-native');
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    fireEvent.press(getByText('Saudi'));
    expect(onChange).toHaveBeenCalledWith('SA');
  });

  it('filters by Arabic name when searching in Arabic', () => {
    const { queryByText, UNSAFE_getAllByType, UNSAFE_getByType } = render(
      <ParticipantField
        fieldType="nationality"
        value=""
        onChange={jest.fn()}
        metadata={natMetadata}
        nationalityOptions={nationalities}
      />
    );
    const { TouchableOpacity, TextInput } = require('react-native');
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    // Type Arabic search term matching only Saudi
    fireEvent.changeText(UNSAFE_getByType(TextInput), 'سعودي');
    expect(queryByText('Saudi')).toBeTruthy();
    expect(queryByText('Egyptian')).toBeNull();
  });
});
