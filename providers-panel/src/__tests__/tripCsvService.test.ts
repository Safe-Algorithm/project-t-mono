/**
 * Unit tests for tripCsvService — export + import round-trip coverage for all trip types.
 */

import {
  exportTripToCsv,
  parseTripCsv,
  parseCsvRaw,
  TripCsvImport,
  CsvFieldError,
} from '../services/tripCsvService';
import { Trip, TripType, TripAmenity } from '../types/trip';

// ─── Minimal trip fixtures ────────────────────────────────────────────────

const BASE_TRIP: Trip = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  name_en: 'Desert Safari',
  name_ar: 'سفاري الصحراء',
  description_en: 'A guided desert trip',
  description_ar: 'رحلة صحراوية',
  start_date: '2025-06-01T08:00',
  end_date: '2025-06-05T18:00',
  registration_deadline: '2025-05-25T00:00',
  max_participants: 20,
  is_active: true,
  is_packaged_trip: false,
  trip_type: TripType.GUIDED,
  price: 350,
  is_refundable: true,
  amenities: [TripAmenity.HOTEL, TripAmenity.MEALS],
  has_meeting_place: true,
  meeting_place_name: 'Riyadh Gate',
  meeting_place_name_ar: 'بوابة الرياض',
  meeting_location: '24.7136,46.6753',
  packages: [],
  provider_id: 'prov-1',
};

const PACKAGED_TRIP: Trip = {
  ...BASE_TRIP,
  id: 'aaaaaaaa-0000-0000-0000-000000000002',
  name_en: 'Jordan Tour',
  name_ar: 'جولة الأردن',
  is_packaged_trip: true,
  trip_type: TripType.SELF_ARRANGED,
  price: null,
  is_refundable: false,
  amenities: [],
  has_meeting_place: false,
  meeting_place_name: '',
  meeting_place_name_ar: '',
  meeting_location: '',
  packages: [
    {
      id: 'pkg-1',
      trip_id: 'aaaaaaaa-0000-0000-0000-000000000002',
      name_en: 'Budget',
      name_ar: 'اقتصادي',
      description_en: 'Budget option',
      description_ar: 'خيار اقتصادي',
      price: 500,
      currency: 'SAR',
      is_active: true,
      max_participants: 10,
      is_refundable: true,
      amenities: [TripAmenity.BUS],
      required_fields: [],
      use_flexible_pricing: false,
      pricing_tiers: [],
    },
    {
      id: 'pkg-2',
      trip_id: 'aaaaaaaa-0000-0000-0000-000000000002',
      name_en: 'Premium',
      name_ar: 'مميز',
      description_en: 'Premium option',
      description_ar: 'خيار مميز',
      price: 0,
      currency: 'SAR',
      is_active: true,
      max_participants: 5,
      is_refundable: false,
      amenities: [TripAmenity.HOTEL, TripAmenity.FLIGHT_TICKETS],
      required_fields: [],
      use_flexible_pricing: true,
      pricing_tiers: [
        { from_participant: 1, price_per_person: 900 },
        { from_participant: 5, price_per_person: 750 },
      ],
    },
  ],
};

const SIMPLE_FLEXIBLE_TRIP: Trip = {
  ...BASE_TRIP,
  id: 'aaaaaaaa-0000-0000-0000-000000000003',
  name_en: 'Group Hike',
  name_ar: 'رحلة المجموعة',
  price: 0,
  simple_trip_use_flexible_pricing: true,
  simple_trip_pricing_tiers: [
    { from_participant: 1, price_per_person: 300 },
    { from_participant: 5, price_per_person: 200 },
    { from_participant: 10, price_per_person: 150 },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function roundTrip(trip: Trip): { data: TripCsvImport } | { errors: CsvFieldError[] } {
  const csv = exportTripToCsv(trip);
  return parseTripCsv(csv);
}

// ─── parseCsvRaw ──────────────────────────────────────────────────────────

describe('parseCsvRaw', () => {
  it('parses a simple 2-row CSV', () => {
    const rows = parseCsvRaw('a,b,c\n1,2,3\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(['a', 'b', 'c']);
    expect(rows[1]).toEqual(['1', '2', '3']);
  });

  it('handles quoted cells with embedded commas', () => {
    const rows = parseCsvRaw('"hello, world","foo""bar"\n');
    expect(rows[0][0]).toBe('hello, world');
    expect(rows[0][1]).toBe('foo"bar');
  });

  it('handles embedded newlines inside quotes', () => {
    const rows = parseCsvRaw('"line1\nline2",end\n');
    expect(rows[0][0]).toBe('line1\nline2');
    expect(rows[0][1]).toBe('end');
  });

  it('skips fully blank rows', () => {
    const rows = parseCsvRaw('a,b\n\n1,2\n');
    expect(rows).toHaveLength(2);
  });
});

// ─── Export ───────────────────────────────────────────────────────────────

describe('exportTripToCsv', () => {
  it('starts with a header row containing all required columns', () => {
    const csv = exportTripToCsv(BASE_TRIP);
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toContain('row_type');
    expect(firstLine).toContain('use_flexible_pricing');
    expect(firstLine).toContain('flexible_tiers');
    expect(firstLine).toContain('has_meeting_place');
    expect(firstLine).toContain('meeting_place_name');
  });

  it('simple trip: exports a trip row with tier_structure=single', () => {
    const csv = exportTripToCsv(BASE_TRIP);
    expect(csv).toContain('"single"');
    expect(csv).toContain('"trip"');
    expect(csv).not.toContain('"package"');
  });

  it('simple trip: exports price and amenities', () => {
    const csv = exportTripToCsv(BASE_TRIP);
    expect(csv).toContain('"350"');
    expect(csv).toContain('hotel|meals');
  });

  it('simple flexible trip: exports use_flexible_pricing=true and tiers', () => {
    const csv = exportTripToCsv(SIMPLE_FLEXIBLE_TRIP);
    expect(csv).toContain('"true"');
    expect(csv).toContain('1:300|5:200|10:150');
  });

  it('packaged trip: exports one package row per package', () => {
    const csv = exportTripToCsv(PACKAGED_TRIP);
    const rows = csv.split('\n').filter(r => r.includes('"package"'));
    expect(rows).toHaveLength(2);
  });

  it('packaged trip: exports flexible tiers for flexible package', () => {
    const csv = exportTripToCsv(PACKAGED_TRIP);
    expect(csv).toContain('1:900|5:750');
  });

  it('packaged trip: exports flat price for flat package', () => {
    const csv = exportTripToCsv(PACKAGED_TRIP);
    expect(csv).toContain('"500"');
  });

  it('exports meeting place fields', () => {
    const csv = exportTripToCsv(BASE_TRIP);
    expect(csv).toContain('"true"');           // has_meeting_place
    expect(csv).toContain('Riyadh Gate');
    expect(csv).toContain('24.7136,46.6753');
  });
});

// ─── Round-trip: simple flat trip ─────────────────────────────────────────

describe('round-trip: simple flat trip', () => {
  it('parses without errors', () => {
    const result = roundTrip(BASE_TRIP);
    expect('errors' in result).toBe(false);
  });

  it('preserves trip name', () => {
    const result = roundTrip(BASE_TRIP) as { data: TripCsvImport };
    expect(result.data.name_en).toBe('Desert Safari');
    expect(result.data.name_ar).toBe('سفاري الصحراء');
  });

  it('preserves trip_nature=guided', () => {
    const result = roundTrip(BASE_TRIP) as { data: TripCsvImport };
    expect(result.data.trip_nature).toBe(TripType.GUIDED);
  });

  it('preserves tier_structure=single and price', () => {
    const result = roundTrip(BASE_TRIP) as { data: TripCsvImport };
    expect(result.data.tier_structure).toBe('single');
    expect(result.data.price_sar).toBe(350);
  });

  it('preserves amenities', () => {
    const result = roundTrip(BASE_TRIP) as { data: TripCsvImport };
    expect(result.data.amenities).toContain(TripAmenity.HOTEL);
    expect(result.data.amenities).toContain(TripAmenity.MEALS);
  });

  it('preserves meeting place', () => {
    const result = roundTrip(BASE_TRIP) as { data: TripCsvImport };
    expect(result.data.has_meeting_place).toBe(true);
    expect(result.data.meeting_place_name).toBe('Riyadh Gate');
    expect(result.data.meeting_location).toBe('24.7136,46.6753');
  });

  it('use_flexible_pricing is false', () => {
    const result = roundTrip(BASE_TRIP) as { data: TripCsvImport };
    expect(result.data.use_flexible_pricing).toBe(false);
    expect(result.data.flexible_tiers).toHaveLength(0);
  });

  it('packages array is empty for simple trip', () => {
    const result = roundTrip(BASE_TRIP) as { data: TripCsvImport };
    expect(result.data.packages).toHaveLength(0);
  });
});

// ─── Round-trip: simple flexible trip ─────────────────────────────────────

describe('round-trip: simple flexible trip', () => {
  it('parses without errors', () => {
    const result = roundTrip(SIMPLE_FLEXIBLE_TRIP);
    expect('errors' in result).toBe(false);
  });

  it('preserves use_flexible_pricing=true', () => {
    const result = roundTrip(SIMPLE_FLEXIBLE_TRIP) as { data: TripCsvImport };
    expect(result.data.use_flexible_pricing).toBe(true);
  });

  it('preserves all three pricing tiers', () => {
    const result = roundTrip(SIMPLE_FLEXIBLE_TRIP) as { data: TripCsvImport };
    expect(result.data.flexible_tiers).toHaveLength(3);
    expect(result.data.flexible_tiers[0]).toEqual({ from_participant: 1, price_per_person: 300 });
    expect(result.data.flexible_tiers[1]).toEqual({ from_participant: 5, price_per_person: 200 });
    expect(result.data.flexible_tiers[2]).toEqual({ from_participant: 10, price_per_person: 150 });
  });

  it('price_sar is null (flexible overrides flat)', () => {
    const result = roundTrip(SIMPLE_FLEXIBLE_TRIP) as { data: TripCsvImport };
    expect(result.data.price_sar).toBeNull();
  });
});

// ─── Round-trip: packaged trip ─────────────────────────────────────────────

describe('round-trip: packaged trip', () => {
  it('parses without errors', () => {
    const result = roundTrip(PACKAGED_TRIP);
    expect('errors' in result).toBe(false);
  });

  it('tier_structure=multiple and trip_nature=self_arranged', () => {
    const result = roundTrip(PACKAGED_TRIP) as { data: TripCsvImport };
    expect(result.data.tier_structure).toBe('multiple');
    expect(result.data.trip_nature).toBe(TripType.SELF_ARRANGED);
  });

  it('imports 2 packages', () => {
    const result = roundTrip(PACKAGED_TRIP) as { data: TripCsvImport };
    expect(result.data.packages).toHaveLength(2);
  });

  it('Budget package: flat pricing, correct price', () => {
    const result = roundTrip(PACKAGED_TRIP) as { data: TripCsvImport };
    const budget = result.data.packages[0];
    expect(budget.name_en).toBe('Budget');
    expect(budget.use_flexible_pricing).toBe(false);
    expect(budget.price_sar).toBe(500);
    expect(budget.flexible_tiers).toHaveLength(0);
  });

  it('Premium package: flexible pricing, correct tiers', () => {
    const result = roundTrip(PACKAGED_TRIP) as { data: TripCsvImport };
    const premium = result.data.packages[1];
    expect(premium.name_en).toBe('Premium');
    expect(premium.use_flexible_pricing).toBe(true);
    expect(premium.flexible_tiers).toHaveLength(2);
    expect(premium.flexible_tiers[0]).toEqual({ from_participant: 1, price_per_person: 900 });
    expect(premium.flexible_tiers[1]).toEqual({ from_participant: 5, price_per_person: 750 });
  });

  it('Budget package: amenities preserved', () => {
    const result = roundTrip(PACKAGED_TRIP) as { data: TripCsvImport };
    expect(result.data.packages[0].amenities).toContain(TripAmenity.BUS);
  });

  it('Premium package: amenities preserved', () => {
    const result = roundTrip(PACKAGED_TRIP) as { data: TripCsvImport };
    expect(result.data.packages[1].amenities).toContain(TripAmenity.HOTEL);
    expect(result.data.packages[1].amenities).toContain(TripAmenity.FLIGHT_TICKETS);
  });

  it('max_participants preserved for Budget package', () => {
    const result = roundTrip(PACKAGED_TRIP) as { data: TripCsvImport };
    expect(result.data.packages[0].max_participants).toBe(10);
  });
});

// ─── Import validation errors ──────────────────────────────────────────────

describe('parseTripCsv: validation errors', () => {
  const VALID_SIMPLE_CSV = exportTripToCsv(BASE_TRIP);

  it('returns error for empty file', () => {
    const result = parseTripCsv('');
    expect('errors' in result).toBe(true);
  });

  it('returns error for missing column', () => {
    // Strip the 'flexible_tiers' column entirely from header + all data rows
    const lines = VALID_SIMPLE_CSV.split('\n').filter(l => l.trim() !== '');
    const headerCells = lines[0].split(',');
    const colIdx = headerCells.findIndex(c => c.replace(/"/g, '') === 'flexible_tiers');
    const stripped = lines
      .map(line => line.split(',').filter((_, i) => i !== colIdx).join(','))
      .join('\n') + '\n';
    const result = parseTripCsv(stripped);
    expect('errors' in result).toBe(true);
    if ('errors' in result) {
      expect(result.errors.some(e => e.messageKey === 'csv.error.missingColumn')).toBe(true);
    }
  });

  it('returns error when both name_en and name_ar are blank', () => {
    const csv = exportTripToCsv({ ...BASE_TRIP, name_en: '', name_ar: '' });
    const result = parseTripCsv(csv);
    expect('errors' in result).toBe(true);
    if ('errors' in result) {
      expect(result.errors.some(e => e.messageKey === 'csv.error.nameRequired')).toBe(true);
    }
  });

  it('returns error for invalid trip_nature', () => {
    const csv = VALID_SIMPLE_CSV.replace('"guided"', '"spaceship"');
    const result = parseTripCsv(csv);
    expect('errors' in result).toBe(true);
    if ('errors' in result) {
      expect(result.errors.some(e => e.field === 'trip_nature')).toBe(true);
    }
  });

  it('returns error for invalid date format', () => {
    const csv = VALID_SIMPLE_CSV.replace(/"2025-06-01T08:00"/, '"not-a-date"');
    const result = parseTripCsv(csv);
    expect('errors' in result).toBe(true);
  });

  it('returns error for price < 1 on simple trip', () => {
    const csv = exportTripToCsv({ ...BASE_TRIP, price: 0 });
    const result = parseTripCsv(csv);
    expect('errors' in result).toBe(true);
    if ('errors' in result) {
      expect(result.errors.some(e => e.field === 'price_sar')).toBe(true);
    }
  });

  it('packaged trip with only 1 package row returns error', () => {
    // Export a trip with 2 packages then strip one package row
    const csv = exportTripToCsv(PACKAGED_TRIP);
    const lines = csv.split('\n');
    // Keep header + trip row + first package row only
    const trimmed = lines.slice(0, 3).join('\n') + '\n';
    const result = parseTripCsv(trimmed);
    expect('errors' in result).toBe(true);
    if ('errors' in result) {
      expect(result.errors.some(e => e.messageKey === 'csv.error.packagesRequired')).toBe(true);
    }
  });

  it('accepts a name with only Arabic (no English)', () => {
    const csv = exportTripToCsv({ ...BASE_TRIP, name_en: '', name_ar: 'رحلة' });
    const result = parseTripCsv(csv);
    // Should NOT error on name — backend allows either language
    if ('errors' in result) {
      expect(result.errors.every(e => e.field !== 'name_en')).toBe(true);
    }
  });

  it('silently ignores unknown amenity values', () => {
    // Inject a bad amenity key into the CSV
    const csv = VALID_SIMPLE_CSV.replace('hotel|meals', 'hotel|totally_fake_amenity|meals');
    const result = parseTripCsv(csv);
    if ('data' in result) {
      expect(result.data.amenities).toContain(TripAmenity.HOTEL);
      expect(result.data.amenities).toContain(TripAmenity.MEALS);
      expect(result.data.amenities).not.toContain('totally_fake_amenity');
    }
  });
});
