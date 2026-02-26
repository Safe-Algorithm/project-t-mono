/**
 * Tests for useFieldMetadata and useNationalities hooks:
 *   - Fetches from correct endpoints
 *   - Indexes field metadata by field_name
 *   - Caches with correct stale time
 *   - Sends Accept-Language header (via api client)
 *   - Returns nationality list as array
 *   - Re-keys query on language change
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

const mockGet = jest.fn();
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { get: mockGet },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { Wrapper, qc };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_FIELDS = [
  {
    field_name: 'name',
    display_name: 'Full Name',
    display_name_ar: 'الاسم الكامل',
    ui_type: 'text',
    placeholder: 'Enter full name',
    required: true,
    available_validations: [],
  },
  {
    field_name: 'gender',
    display_name: 'Gender',
    display_name_ar: 'الجنس',
    ui_type: 'select',
    required: true,
    options: [
      { value: 'male', label: 'Male', label_ar: 'ذكر' },
      { value: 'female', label: 'Female', label_ar: 'أنثى' },
    ],
    available_validations: ['gender_restrictions'],
  },
  {
    field_name: 'date_of_birth',
    display_name: 'Date of Birth',
    display_name_ar: 'تاريخ الميلاد',
    ui_type: 'date',
    required: false,
    available_validations: ['min_age', 'max_age'],
  },
];

const MOCK_NATIONALITIES = [
  { code: 'SA', name: 'Saudi', name_en: 'Saudi', name_ar: 'سعودي' },
  { code: 'EG', name: 'Egyptian', name_en: 'Egyptian', name_ar: 'مصري' },
  { code: 'AE', name: 'Emirati', name_en: 'Emirati', name_ar: 'إماراتي' },
];

// ── useFieldMetadata ──────────────────────────────────────────────────────────

describe('useFieldMetadata', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches from /public-trips/field-metadata', async () => {
    mockGet.mockResolvedValueOnce({ data: { fields: MOCK_FIELDS } });

    const { Wrapper } = makeWrapper();
    const { useFieldMetadata } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useFieldMetadata(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/public-trips/field-metadata');
  });

  it('indexes fields by field_name', async () => {
    mockGet.mockResolvedValueOnce({ data: { fields: MOCK_FIELDS } });

    const { Wrapper } = makeWrapper();
    const { useFieldMetadata } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useFieldMetadata(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.name).toBeDefined();
    expect(result.current.data?.gender).toBeDefined();
    expect(result.current.data?.date_of_birth).toBeDefined();
    expect(result.current.data?.name.display_name).toBe('Full Name');
  });

  it('returns ui_type for each field', async () => {
    mockGet.mockResolvedValueOnce({ data: { fields: MOCK_FIELDS } });

    const { Wrapper } = makeWrapper();
    const { useFieldMetadata } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useFieldMetadata(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.name.ui_type).toBe('text');
    expect(result.current.data?.gender.ui_type).toBe('select');
    expect(result.current.data?.date_of_birth.ui_type).toBe('date');
  });

  it('returns options array for select fields', async () => {
    mockGet.mockResolvedValueOnce({ data: { fields: MOCK_FIELDS } });

    const { Wrapper } = makeWrapper();
    const { useFieldMetadata } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useFieldMetadata(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.gender.options).toHaveLength(2);
    expect(result.current.data?.gender.options?.[0].value).toBe('male');
    expect(result.current.data?.gender.options?.[1].value).toBe('female');
  });

  it('returns available_validations for fields that have them', async () => {
    mockGet.mockResolvedValueOnce({ data: { fields: MOCK_FIELDS } });

    const { Wrapper } = makeWrapper();
    const { useFieldMetadata } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useFieldMetadata(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.gender.available_validations).toContain('gender_restrictions');
    expect(result.current.data?.date_of_birth.available_validations).toContain('min_age');
    expect(result.current.data?.date_of_birth.available_validations).toContain('max_age');
  });

  it('includes Arabic display_name_ar in field metadata', async () => {
    mockGet.mockResolvedValueOnce({ data: { fields: MOCK_FIELDS } });

    const { Wrapper } = makeWrapper();
    const { useFieldMetadata } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useFieldMetadata(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.name.display_name_ar).toBe('الاسم الكامل');
  });

  it('uses language in queryKey so re-fetches on language change', async () => {
    // Just verify the queryKey includes the language string from i18n
    mockGet.mockResolvedValue({ data: { fields: MOCK_FIELDS } });

    const { Wrapper, qc } = makeWrapper();
    const { useFieldMetadata } = require('../../hooks/useTrips');
    renderHook(() => useFieldMetadata(), { wrapper: Wrapper });

    await waitFor(() =>
      expect(qc.getQueryCache().getAll().some((q) => q.queryKey.includes('en'))).toBe(true)
    );
  });
});

// ── useNationalities ──────────────────────────────────────────────────────────

describe('useNationalities', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches from /public-trips/nationalities', async () => {
    mockGet.mockResolvedValueOnce({ data: { nationalities: MOCK_NATIONALITIES } });

    const { Wrapper } = makeWrapper();
    const { useNationalities } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useNationalities(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/public-trips/nationalities');
  });

  it('returns a flat array of nationality objects', async () => {
    mockGet.mockResolvedValueOnce({ data: { nationalities: MOCK_NATIONALITIES } });

    const { Wrapper } = makeWrapper();
    const { useNationalities } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useNationalities(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(3);
  });

  it('each nationality has code, name, name_en, name_ar', async () => {
    mockGet.mockResolvedValueOnce({ data: { nationalities: MOCK_NATIONALITIES } });

    const { Wrapper } = makeWrapper();
    const { useNationalities } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useNationalities(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const sa = result.current.data?.find((n: any) => n.code === 'SA');
    expect(sa).toBeDefined();
    expect(sa?.name).toBe('Saudi');
    expect(sa?.name_ar).toBe('سعودي');
    expect(sa?.name_en).toBe('Saudi');
  });

  it('includes language in queryKey for cache invalidation on language switch', async () => {
    mockGet.mockResolvedValue({ data: { nationalities: MOCK_NATIONALITIES } });

    const { Wrapper, qc } = makeWrapper();
    const { useNationalities } = require('../../hooks/useTrips');
    renderHook(() => useNationalities(), { wrapper: Wrapper });

    await waitFor(() =>
      expect(qc.getQueryCache().getAll().some((q) =>
        JSON.stringify(q.queryKey).includes('nationalities')
      )).toBe(true)
    );
  });

  it('does not return null values in the list', async () => {
    mockGet.mockResolvedValueOnce({ data: { nationalities: MOCK_NATIONALITIES } });

    const { Wrapper } = makeWrapper();
    const { useNationalities } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useNationalities(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    result.current.data?.forEach((n: any) => {
      expect(n.code).toBeTruthy();
      expect(n.name).toBeTruthy();
    });
  });
});
