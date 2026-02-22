/**
 * Tests for new hooks added in the trip registration payment flow:
 *   useRegistration, useCreatePayment, useTripUpdates,
 *   useMarkUpdateRead, useAllMyTripUpdates
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

jest.mock('../../lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (k: string) => k },
}));

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { get: mockGet, post: mockPost },
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

const MOCK_REGISTRATION = {
  id: 'reg-001',
  trip_id: 'trip-001',
  user_id: 'user-001',
  status: 'pending_payment',
  total_participants: 2,
  total_amount: '1000.00',
  spot_reserved_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  registration_date: new Date().toISOString(),
  participants: [],
};

const MOCK_UPDATES: any[] = [
  {
    id: 'upd-001',
    trip_id: 'trip-001',
    registration_id: null,
    title: 'Departure time changed',
    body: 'We depart at 8am instead of 9am.',
    read: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'upd-002',
    trip_id: 'trip-001',
    registration_id: 'reg-001',
    title: 'Personal note',
    body: 'Your seat has been upgraded.',
    read: true,
    created_at: new Date().toISOString(),
  },
];

// ── useRegistration ───────────────────────────────────────────────────────────

describe('useRegistration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches registration by ID when registrationId is provided', async () => {
    mockGet.mockResolvedValueOnce({ data: MOCK_REGISTRATION });

    const { Wrapper } = makeWrapper();
    const { useRegistration } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useRegistration('reg-001'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/trips/registrations/reg-001');
    expect(result.current.data?.id).toBe('reg-001');
    expect(result.current.data?.status).toBe('pending_payment');
  });

  it('does not fetch when registrationId is null', () => {
    const { Wrapper } = makeWrapper();
    const { useRegistration } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useRegistration(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('exposes spot_reserved_until from the registration', async () => {
    mockGet.mockResolvedValueOnce({ data: MOCK_REGISTRATION });

    const { Wrapper } = makeWrapper();
    const { useRegistration } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useRegistration('reg-001'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.spot_reserved_until).toBeTruthy();
  });
});

// ── useCreatePayment ──────────────────────────────────────────────────────────

describe('useCreatePayment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts to /payments/create with correct payload', async () => {
    const mockResponse = {
      payment_id: 'pay-001',
      moyasar_payment_id: 'moy-001',
      amount: 1000,
      currency: 'SAR',
      status: 'initiated',
      source: { type: 'creditcard', transaction_url: 'https://moyasar.com/pay/123' },
    };
    mockPost.mockResolvedValueOnce({ data: mockResponse });

    const { Wrapper } = makeWrapper();
    const { useCreatePayment } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useCreatePayment(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        registrationId: 'reg-001',
        paymentMethod: 'creditcard',
        callbackUrl: 'rihla://payment-callback?registrationId=reg-001',
      });
    });

    expect(mockPost).toHaveBeenCalledWith('/payments/create', {
      registration_id: 'reg-001',
      payment_method: 'creditcard',
      callback_url: 'rihla://payment-callback?registrationId=reg-001',
    });
    await waitFor(() =>
      expect(result.current.data?.source.transaction_url).toBe(
        'https://moyasar.com/pay/123'
      )
    );
  });

  it('surfaces errors from the API', async () => {
    mockPost.mockRejectedValueOnce(new Error('Payment failed'));

    const { Wrapper } = makeWrapper();
    const { useCreatePayment } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useCreatePayment(), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          registrationId: 'reg-001',
          paymentMethod: 'creditcard',
          callbackUrl: 'rihla://payment-callback',
        })
      ).rejects.toThrow('Payment failed');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useTripUpdates ────────────────────────────────────────────────────────────

describe('useTripUpdates', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches updates for a given tripId', async () => {
    mockGet.mockResolvedValueOnce({ data: MOCK_UPDATES });

    const { Wrapper } = makeWrapper();
    const { useTripUpdates } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useTripUpdates('trip-001'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/trips/trip-001/updates');
    expect(result.current.data).toHaveLength(2);
  });

  it('does not fetch when tripId is null', () => {
    const { Wrapper } = makeWrapper();
    const { useTripUpdates } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useTripUpdates(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('distinguishes targeted vs broadcast updates via registration_id', async () => {
    mockGet.mockResolvedValueOnce({ data: MOCK_UPDATES });

    const { Wrapper } = makeWrapper();
    const { useTripUpdates } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useTripUpdates('trip-001'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const broadcast = result.current.data?.filter((u: any) => !u.registration_id);
    const targeted = result.current.data?.filter((u: any) => !!u.registration_id);
    expect(broadcast).toHaveLength(1);
    expect(targeted).toHaveLength(1);
  });
});

// ── useMarkUpdateRead ─────────────────────────────────────────────────────────

describe('useMarkUpdateRead', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts to /updates/{id}/mark-read', async () => {
    mockPost.mockResolvedValueOnce({ data: {} });

    const { Wrapper, qc } = makeWrapper();
    const { useMarkUpdateRead } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useMarkUpdateRead(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync('upd-001');
    });

    expect(mockPost).toHaveBeenCalledWith('/updates/upd-001/mark-read', {});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('surfaces errors from the API', async () => {
    mockPost.mockRejectedValueOnce(new Error('Not found'));

    const { Wrapper } = makeWrapper();
    const { useMarkUpdateRead } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useMarkUpdateRead(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('bad-id')).rejects.toThrow(
        'Not found'
      );
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useAllMyTripUpdates ───────────────────────────────────────────────────────

describe('useAllMyTripUpdates', () => {
  beforeEach(() => jest.clearAllMocks());

  it('aggregates updates from all active registrations sorted newest-first', async () => {
    const older: any = {
      ...MOCK_UPDATES[0],
      id: 'upd-old',
      created_at: new Date(Date.now() - 60_000).toISOString(),
    };
    const newer: any = {
      ...MOCK_UPDATES[1],
      id: 'upd-new',
      created_at: new Date(Date.now()).toISOString(),
    };

    // First call: useMyRegistrations
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 'reg-001', trip_id: 'trip-001', status: 'confirmed' },
        { id: 'reg-002', trip_id: 'trip-002', status: 'pending_payment' },
      ],
    });
    // Second + third calls: per-trip updates
    mockGet.mockResolvedValueOnce({ data: [older] });
    mockGet.mockResolvedValueOnce({ data: [newer] });

    const { Wrapper } = makeWrapper();
    const { useAllMyTripUpdates } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useAllMyTripUpdates(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), {
      timeout: 3000,
    });

    const ids = result.current.data?.map((u: any) => u.id);
    // newer should come first
    expect(ids?.[0]).toBe('upd-new');
    expect(ids?.[1]).toBe('upd-old');
  });

  it('excludes cancelled registrations from the update fetch', async () => {
    // useMyRegistrations returns one cancelled + one confirmed
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 'reg-c', trip_id: 'trip-cancelled', status: 'cancelled' },
        { id: 'reg-a', trip_id: 'trip-active', status: 'confirmed' },
      ],
    });
    mockGet.mockResolvedValueOnce({ data: MOCK_UPDATES });

    const { Wrapper } = makeWrapper();
    const { useAllMyTripUpdates } = require('../../hooks/useTrips');
    const { result } = renderHook(() => useAllMyTripUpdates(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), {
      timeout: 3000,
    });

    // Only one trip-updates call (for the confirmed trip, not the cancelled one)
    const updateCalls = mockGet.mock.calls.filter((c: string[]) =>
      c[0].includes('/updates')
    );
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0][0]).toContain('trip-active');
  });
});
