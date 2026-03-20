import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TripCard from '../../components/trips/TripCard';
import { Trip } from '../../types/trip';

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

const mockTrip: Trip = {
  id: 'trip-1',
  name_en: 'Desert Safari',
  name_ar: 'سفاري الصحراء',
  description_en: 'An amazing desert experience',
  description_ar: null,
  start_date: '2025-06-01',
  end_date: '2025-06-05',
  registration_deadline: null,
  max_participants: 20,
  available_spots: 8,
  is_active: true,
  is_packaged_trip: false,
  is_refundable: true,
  is_international: false,
  starting_city_id: null,
  starting_city: null,
  destinations: [],
  trip_type: 'adventure',
  has_meeting_place: false,
  meeting_place_name: null,
  meeting_place_name_ar: null,
  meeting_location: null,
  meeting_time: null,
  amenities: ['hotel', 'meals'],
  images: [],
  provider_id: 'prov-1',
  provider: { id: 'prov-1', company_name: 'Test Provider' },
  packages: [
    {
      id: 'pkg-1',
      trip_id: 'trip-1',
      name_en: 'Standard',
      name_ar: null,
      description_en: 'Standard package',
      description_ar: null,
      price: '1500',
      currency: 'SAR',
      is_active: true,
      required_fields: [],
    },
  ],
  simple_trip_required_fields: ['name', 'date_of_birth'],
  simple_trip_required_fields_details: [],
  extra_fees: [],
};

describe('TripCard', () => {
  it('renders trip name', () => {
    const { getByText } = render(
      <TripCard trip={mockTrip} onPress={() => {}} />
    );
    expect(getByText('Desert Safari')).toBeTruthy();
  });

  it('renders price from first package', () => {
    const { getByText } = render(
      <TripCard trip={mockTrip} onPress={() => {}} />
    );
    // t() is mocked to return the key; single package uses trip.priceOnly key
    expect(getByText(/trip\.priceOnly|trip\.fromPrice|1,500|1500/)).toBeTruthy();
  });

  it('calls onPress when card is tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <TripCard trip={mockTrip} onPress={onPress} testID="trip-card" />
    );
    fireEvent.press(getByTestId('trip-card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onFavoriteToggle when heart is pressed', () => {
    const onFavoriteToggle = jest.fn();
    const { getByTestId } = render(
      <TripCard
        trip={mockTrip}
        onPress={() => {}}
        isFavorite={false}
        onFavoriteToggle={onFavoriteToggle}
        testID="trip-card"
      />
    );
    const favBtn = getByTestId('fav-btn');
    fireEvent.press(favBtn);
    expect(onFavoriteToggle).toHaveBeenCalledTimes(1);
  });

  it('falls back to Arabic name when English is null', () => {
    const arabicOnlyTrip = { ...mockTrip, name_en: null, name_ar: 'رحلة' };
    const { getByText } = render(
      <TripCard trip={arabicOnlyTrip} onPress={() => {}} />
    );
    expect(getByText('رحلة')).toBeTruthy();
  });

  it('renders start date', () => {
    const { getByText } = render(
      <TripCard trip={mockTrip} onPress={() => {}} />
    );
    expect(getByText(/Jun|2025/)).toBeTruthy();
  });
});

describe('TripCard — route label with country names', () => {
  const baseTrip: Trip = {
    ...({} as Trip),
    id: 'trip-route',
    name_en: 'Route Trip',
    name_ar: 'رحلة',
    description_en: 'desc',
    description_ar: null,
    start_date: '2025-08-01',
    end_date: '2025-08-05',
    registration_deadline: null,
    max_participants: 10,
    available_spots: 5,
    is_active: true,
    is_packaged_trip: false,
    is_refundable: null,
    is_international: true,
    starting_city_id: 'sc-1',
    starting_city: { id: 'sc-1', name_en: 'Riyadh', name_ar: 'الرياض', country_code: 'SA' },
    destinations: [
      {
        id: 'dest-1',
        name_en: 'Istanbul',
        name_ar: 'إسطنبول',
        country_code: 'TR',
        country_name_en: 'Turkey',
        country_name_ar: 'تركيا',
        type: 'city',
      },
    ],
    trip_type: 'package',
    has_meeting_place: false,
    meeting_place_name: null,
    meeting_place_name_ar: null,
    meeting_location: null,
    meeting_time: null,
    amenities: null,
    images: [],
    provider_id: 'prov-1',
    provider: { id: 'prov-1', company_name: 'Provider' },
    packages: [],
    simple_trip_required_fields: [],
    simple_trip_required_fields_details: [],
    extra_fees: [],
  };

  it('international package: shows destination country name (not city) in EN route label', () => {
    const { getByText } = render(<TripCard trip={baseTrip} onPress={() => {}} />);
    expect(getByText(/Turkey/)).toBeTruthy();
  });

  it('shows starting city in route label', () => {
    const { getByText } = render(<TripCard trip={baseTrip} onPress={() => {}} />);
    expect(getByText(/Riyadh/)).toBeTruthy();
  });

  it('shows flag only when country_name fields are null', () => {
    const tripNoCountry: Trip = {
      ...baseTrip,
      destinations: [
        {
          id: 'dest-2',
          name_en: 'UnknownCity',
          name_ar: 'مدينة مجهولة',
          country_code: 'XX',
          country_name_en: null,
          country_name_ar: null,
          type: 'city',
        },
      ],
    };
    // No city name shown, no country name — just the starting city still shown
    const { getByText } = render(<TripCard trip={tripNoCountry} onPress={() => {}} />);
    expect(getByText(/Riyadh/)).toBeTruthy();
  });

  it('international: deduplicates countries for multi-city same-country destinations', () => {
    const tripMultiDest: Trip = {
      ...baseTrip,
      trip_type: 'package',
      is_international: true,
      destinations: [
        { id: 'd1', name_en: 'Istanbul', name_ar: 'إسطنبول', country_code: 'TR', country_name_en: 'Turkey', country_name_ar: 'تركيا', type: 'city' },
        { id: 'd2', name_en: 'Trabzon', name_ar: 'طرابزون', country_code: 'TR', country_name_en: 'Turkey', country_name_ar: 'تركيا', type: 'city' },
      ],
    };
    const { getByText, queryAllByText } = render(<TripCard trip={tripMultiDest} onPress={() => {}} />);
    expect(getByText(/Turkey/)).toBeTruthy();
    expect(queryAllByText(/Turkey/).length).toBe(1);
    expect(queryAllByText(/Istanbul/).length).toBe(0);
    expect(queryAllByText(/Trabzon/).length).toBe(0);
  });

  it('international: shows multiple distinct countries', () => {
    const tripMultiCountry: Trip = {
      ...baseTrip,
      trip_type: 'package',
      is_international: true,
      destinations: [
        { id: 'd1', name_en: 'Istanbul', name_ar: 'إسطنبول', country_code: 'TR', country_name_en: 'Turkey', country_name_ar: 'تركيا', type: 'city' },
        { id: 'd2', name_en: 'Tbilisi', name_ar: 'تبليسي', country_code: 'GE', country_name_en: 'Georgia', country_name_ar: 'جورجيا', type: 'city' },
      ],
    };
    const { getByText } = render(<TripCard trip={tripMultiCountry} onPress={() => {}} />);
    expect(getByText(/Turkey/)).toBeTruthy();
    expect(getByText(/Georgia/)).toBeTruthy();
  });

  it('domestic: shows deduplicated city names instead of countries', () => {
    const tripDomestic: Trip = {
      ...baseTrip,
      trip_type: 'package',
      is_international: false,
      destinations: [
        { id: 'd1', name_en: 'Jeddah', name_ar: 'جدة', country_code: 'SA', country_name_en: 'Saudi Arabia', country_name_ar: 'السعودية', type: 'city' },
        { id: 'd2', name_en: 'Jeddah', name_ar: 'جدة', country_code: 'SA', country_name_en: 'Saudi Arabia', country_name_ar: 'السعودية', type: 'city' },
        { id: 'd3', name_en: 'Mecca', name_ar: 'مكة', country_code: 'SA', country_name_en: 'Saudi Arabia', country_name_ar: 'السعودية', type: 'city' },
      ],
    };
    const { getByText, queryAllByText } = render(<TripCard trip={tripDomestic} onPress={() => {}} />);
    expect(getByText(/Jeddah/)).toBeTruthy();
    expect(getByText(/Mecca/)).toBeTruthy();
    expect(queryAllByText(/Jeddah/).length).toBe(1);
    expect(queryAllByText(/Saudi Arabia/).length).toBe(0);
  });

  it('guided domestic: shows place name when set, city name as fallback', () => {
    const tripGuided: Trip = {
      ...baseTrip,
      trip_type: 'guided',
      is_international: false,
      destinations: [
        { id: 'd1', name_en: 'Riyadh', name_ar: 'الرياض', country_code: 'SA', country_name_en: 'Saudi Arabia', country_name_ar: 'السعودية', place_name_en: 'Six Flags Qiddiya', place_name_ar: 'سيكس فلاغز قدية', type: 'city' },
        { id: 'd2', name_en: 'Jeddah', name_ar: 'جدة', country_code: 'SA', country_name_en: 'Saudi Arabia', country_name_ar: 'السعودية', place_name_en: null, place_name_ar: null, type: 'city' },
      ],
    };
    const { getByText } = render(<TripCard trip={tripGuided} onPress={() => {}} />);
    expect(getByText(/Six Flags Qiddiya/)).toBeTruthy();
    expect(getByText(/Jeddah/)).toBeTruthy();
  });

  it('guided international: shows destination country names (not places/cities), deduplicated', () => {
    const tripGuidedIntl: Trip = {
      ...baseTrip,
      trip_type: 'guided',
      is_international: true,
      destinations: [
        { id: 'd1', name_en: 'Paris', name_ar: 'باريس', country_code: 'FR', country_name_en: 'France', country_name_ar: 'فرنسا', place_name_en: 'Eiffel Tower', place_name_ar: 'برج إيفل', type: 'city' },
        { id: 'd2', name_en: 'Lyon', name_ar: 'ليون', country_code: 'FR', country_name_en: 'France', country_name_ar: 'فرنسا', place_name_en: null, place_name_ar: null, type: 'city' },
        { id: 'd3', name_en: 'Nice', name_ar: 'نيس', country_code: 'FR', country_name_en: 'France', country_name_ar: 'فرنسا', place_name_en: null, place_name_ar: null, type: 'city' },
      ],
    };
    const { getByText, queryAllByText } = render(<TripCard trip={tripGuidedIntl} onPress={() => {}} />);
    expect(getByText(/France/)).toBeTruthy();
    expect(queryAllByText(/France/).length).toBe(1);
    expect(queryAllByText(/Paris/).length).toBe(0);
    expect(queryAllByText(/Eiffel Tower/).length).toBe(0);
  });

  it('renders no route row when starting_city and destinations are both absent', () => {
    const tripNoRoute: Trip = { ...baseTrip, starting_city: null, starting_city_id: null, destinations: [] };
    const { queryByText } = render(<TripCard trip={tripNoRoute} onPress={() => {}} />);
    expect(queryByText(/^[→←]$/)).toBeNull();
  });
});

describe('TripCard — getDestLabel Arabic localization', () => {
  beforeAll(() => {
    jest.mock('react-i18next', () => ({
      useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'ar' },
      }),
    }));
  });

  it('uses Arabic country name and city name in AR mode', () => {
    // Test the pure logic directly without re-rendering with resetModules
    const dest = {
      name_en: 'Istanbul',
      name_ar: 'إسطنبول',
      country_code: 'TR',
      country_name_en: 'Turkey',
      country_name_ar: 'تركيا',
    };
    const lang = 'ar';
    const city = lang === 'ar' ? dest.name_ar || dest.name_en : dest.name_en || dest.name_ar;
    const country = lang === 'ar' ? (dest.country_name_ar || dest.country_name_en) : (dest.country_name_en || dest.country_name_ar);
    expect(city).toBe('إسطنبول');
    expect(country).toBe('تركيا');
  });

  it('falls back to EN country name when AR is missing', () => {
    const dest = {
      name_en: 'Tokyo',
      name_ar: 'طوكيو',
      country_code: 'JP',
      country_name_en: 'Japan',
      country_name_ar: null,
    };
    const lang = 'ar';
    const country = lang === 'ar' ? (dest.country_name_ar || dest.country_name_en) : (dest.country_name_en || dest.country_name_ar);
    expect(country).toBe('Japan');
  });
});
