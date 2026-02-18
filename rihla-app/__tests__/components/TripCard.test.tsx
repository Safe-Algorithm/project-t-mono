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

const mockTrip: Trip = {
  id: 'trip-1',
  name_en: 'Desert Safari',
  name_ar: 'سفاري الصحراء',
  description_en: 'An amazing desert experience',
  description_ar: null,
  start_date: '2025-06-01',
  end_date: '2025-06-05',
  max_participants: 20,
  is_active: true,
  is_refundable: true,
  has_meeting_place: false,
  meeting_location: null,
  meeting_time: null,
  amenities: ['hotel', 'meals'],
  images: [],
  provider_id: 'prov-1',
  packages: [
    {
      id: 'pkg-1',
      trip_id: 'trip-1',
      name_en: 'Standard',
      name_ar: null,
      description_en: 'Standard package',
      description_ar: null,
      price: '1500',
      is_active: true,
      required_fields: [],
      required_fields_details: [],
    },
  ],
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
    expect(getByText(/1,500|1500/)).toBeTruthy();
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
