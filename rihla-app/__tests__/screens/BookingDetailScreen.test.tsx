/**
 * Tests for the booking detail screen logic:
 *   - Displays booking reference (BOOK-XXXXXXXX)
 *   - Displays registration status badge
 *   - Displays trip name (bilingual fallback)
 *   - Displays participant count and total amount
 *   - Renders trip updates list (unread / read states)
 *   - Copy-to-clipboard interaction
 *   - Shows empty state when no updates
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Clipboard } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ registrationId: 'abcdef12-0000-0000-0000-000000000000', autoPayment: undefined })),
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockUseRegistration = jest.fn();
const mockUseTripUpdates = jest.fn();
const mockUseMarkUpdateRead = jest.fn();
const mockUsePreparePayment = jest.fn();
const mockUseConfirmPayment = jest.fn();

jest.mock('../../hooks/useTrips', () => ({
  useRegistration: (...args: any[]) => mockUseRegistration(...args),
  useTripUpdates: (...args: any[]) => mockUseTripUpdates(...args),
  useMarkUpdateRead: () => mockUseMarkUpdateRead(),
  usePreparePayment: () => mockUsePreparePayment(),
  useConfirmPayment: () => mockUseConfirmPayment(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      const map: Record<string, string> = {
        'trip.details': 'Trip Details',
        'trip.updates': 'Trip Updates',
        'trip.noUpdates': 'No updates yet',
        'trip.notFound': 'Trip not found',
        'trip.goBack': 'Go Back',
        'booking.participants': 'Participants',
        'booking.totalAmount': 'Total',
        'booking.participantDetails': 'Participant Details',
        'booking.participant': `Participant ${opts?.number ?? ''}`,
      };
      return map[key] ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#F8FAFC',
      surface: '#FFFFFF',
      primary: '#0EA5E9',
      primarySurface: '#E0F2FE',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      textTertiary: '#94A3B8',
      border: '#E2E8F0',
      error: '#EF4444',
      success: '#22C55E',
      warning: '#F59E0B',
      gray300: '#CBD5E1',
      white: '#FFFFFF',
    },
  }),
}));

jest.mock('../../components/ui/SkeletonLoader', () => ({
  Skeleton: ({ height, width }: any) =>
    require('react').createElement('View', { testID: 'skeleton', style: { height, width } }),
}));

jest.mock('../../components/ui/Badge', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ label }: any) => React.createElement(Text, { testID: 'badge' }, label);
});

jest.mock('../../components/ui/Button', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return ({ title, onPress }: any) =>
    React.createElement(TouchableOpacity, { onPress, testID: 'button' },
      React.createElement(Text, null, title));
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const REGISTRATION_ID = 'abcdef12-0000-0000-0000-000000000000';

const MOCK_REGISTRATION = {
  id: REGISTRATION_ID,
  trip_id: 'trip-001',
  user_id: 'user-001',
  status: 'pending_payment',
  total_participants: 2,
  total_amount: '1500.00',
  spot_reserved_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  registration_date: '2025-06-01T10:00:00',
  participants: [
    { id: 'p1', name: 'Alice Smith', email: 'alice@test.com', phone: null, date_of_birth: null, gender: null, passport_number: null, national_id: null },
  ],
  trip: {
    id: 'trip-001',
    name_en: 'Desert Safari',
    name_ar: 'سفاري الصحراء',
    start_date: '2025-08-01',
    end_date: '2025-08-05',
    provider: { company_name: 'Rihla Tours' },
  },
};

const MOCK_UPDATES = [
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
    registration_id: REGISTRATION_ID,
    title: 'Personal note',
    body: 'Your seat has been upgraded.',
    read: true,
    created_at: new Date().toISOString(),
  },
];

const mutate = jest.fn();

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMarkUpdateRead.mockReturnValue({ mutate });
  mockUsePreparePayment.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  mockUseConfirmPayment.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
});

function setupHooks(overrides: { registration?: any; updates?: any } = {}) {
  const reg = overrides.registration ?? MOCK_REGISTRATION;
  const upd = overrides.updates ?? MOCK_UPDATES;

  mockUseRegistration.mockReturnValue({
    data: reg,
    isLoading: false,
  });
  mockUseTripUpdates.mockReturnValue({
    data: upd,
    isLoading: false,
  });
}

// Lazy-require the screen so mocks are applied first
function renderScreen() {
  const BookingDetailScreen =
    require('../../app/booking/[registrationId]').default;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BookingDetailScreen />
    </QueryClientProvider>
  );
}

describe('BookingDetailScreen — booking reference', () => {
  it('displays BOOK-XXXXXXXX format derived from registrationId', () => {
    setupHooks();
    const { getByText } = renderScreen();
    // First 8 chars of REGISTRATION_ID uppercased
    expect(getByText(/BOOK-ABCDEF12/i)).toBeTruthy();
  });

  it('copies booking reference to clipboard when tapped', () => {
    setupHooks();
    const spy = jest.spyOn(Clipboard, 'setString');
    const { getByText } = renderScreen();
    const refEl = getByText(/BOOK-ABCDEF12/i);
    fireEvent.press(refEl);
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/BOOK-ABCDEF12/i));
  });
});

describe('BookingDetailScreen — status badge', () => {
  it('shows pending_payment status', () => {
    setupHooks();
    const { getAllByTestId } = renderScreen();
    const badges = getAllByTestId('badge');
    const labels = badges.map((b: any) => b.props.children ?? b.children);
    expect(labels.some((l: string) => /pending_payment/i.test(l))).toBe(true);
  });

  it('shows confirmed status when registration is confirmed', () => {
    setupHooks({ registration: { ...MOCK_REGISTRATION, status: 'confirmed' } });
    const { getAllByTestId } = renderScreen();
    const badges = getAllByTestId('badge');
    const labels = badges.map((b: any) => b.props.children ?? b.children);
    expect(labels.some((l: string) => /confirmed/i.test(l))).toBe(true);
  });
});

describe('BookingDetailScreen — trip info', () => {
  it('renders the English trip name', () => {
    setupHooks();
    const { getAllByText } = renderScreen();
    expect(getAllByText('Desert Safari').length).toBeGreaterThan(0);
  });

  it('falls back to Arabic name when name_en is null', () => {
    setupHooks({
      registration: {
        ...MOCK_REGISTRATION,
        trip: { ...MOCK_REGISTRATION.trip, name_en: null },
      },
    });
    const { getAllByText } = renderScreen();
    expect(getAllByText('سفاري الصحراء').length).toBeGreaterThan(0);
  });

  it('renders provider company name', () => {
    setupHooks();
    const { getByText } = renderScreen();
    expect(getByText('Rihla Tours')).toBeTruthy();
  });

  it('renders total participants count', () => {
    setupHooks();
    const { getByText } = renderScreen();
    expect(getByText('2')).toBeTruthy();
  });

  it('renders total amount with SAR', () => {
    setupHooks();
    const { getByText } = renderScreen();
    expect(getByText(/1,500|1500.*SAR|SAR.*1500/i)).toBeTruthy();
  });
});

describe('BookingDetailScreen — participant details', () => {
  it('renders participant name', () => {
    setupHooks();
    const { getByText } = renderScreen();
    expect(getByText('Alice Smith')).toBeTruthy();
  });

  it('renders participant email', () => {
    setupHooks();
    const { getByText } = renderScreen();
    expect(getByText('alice@test.com')).toBeTruthy();
  });
});

describe('BookingDetailScreen — trip updates', () => {
  it('renders all updates', () => {
    setupHooks();
    const { getByText } = renderScreen();
    expect(getByText('Departure time changed')).toBeTruthy();
    expect(getByText('Personal note')).toBeTruthy();
  });

  it('shows empty state when there are no updates', () => {
    setupHooks({ updates: [] });
    const { getByText } = renderScreen();
    expect(getByText('No updates yet')).toBeTruthy();
  });

  it('calls markRead mutation when an unread update is pressed', () => {
    setupHooks();
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Departure time changed'));
    expect(mutate).toHaveBeenCalledWith('upd-001');
  });

  it('does not call markRead when a read update is pressed', () => {
    setupHooks();
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Personal note'));
    expect(mutate).not.toHaveBeenCalled();
  });

  it('shows unread count badge when there are unread updates', () => {
    setupHooks();
    const { getByText } = renderScreen();
    // 1 unread update → badge shows "1"
    expect(getByText('1')).toBeTruthy();
  });
});

describe('BookingDetailScreen — loading state', () => {
  it('renders skeleton loaders while loading', () => {
    mockUseRegistration.mockReturnValue({ data: undefined, isLoading: true });
    mockUseTripUpdates.mockReturnValue({ data: undefined, isLoading: true });
    const { getAllByTestId } = renderScreen();
    expect(getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });
});

describe('BookingDetailScreen — error state', () => {
  it('renders not-found message when registration is undefined after load', () => {
    mockUseRegistration.mockReturnValue({ data: undefined, isLoading: false });
    mockUseTripUpdates.mockReturnValue({ data: [], isLoading: false });
    const { getByText } = renderScreen();
    expect(getByText('Trip not found')).toBeTruthy();
  });
});
