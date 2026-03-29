/**
 * Trip CSV Export / Import Service
 *
 * ── Schema ──────────────────────────────────────────────────────────────────
 * The CSV uses a multi-row format.  Every row has ALL columns; unused cells
 * are left blank.  The `row_type` column disambiguates row intent:
 *
 *   row_type = "trip"    — one row, always present, carries trip-level fields.
 *   row_type = "package" — one row per package (packaged trips only).
 *
 * Columns (in order):
 *   row_type             trip | package
 *   name_en              Trip or package name (English)
 *   name_ar              Trip or package name (Arabic)
 *   description_en       Description (English)
 *   description_ar       Description (Arabic)
 *   trip_nature          guided | self_arranged          (trip row only)
 *   tier_structure       single | multiple               (trip row only)
 *   start_date           YYYY-MM-DDTHH:mm                (trip row only)
 *   end_date             YYYY-MM-DDTHH:mm                (trip row only)
 *   registration_deadline YYYY-MM-DDTHH:mm               (trip row only)
 *   max_participants     integer                         (trip row only)
 *   max_participants_pkg integer                         (package row only)
 *   price_sar            flat price (simple trip or package with flat pricing)
 *   use_flexible_pricing true | false
 *   flexible_tiers       "1:300|5:200" — from_participant:price_per_person pairs
 *   is_refundable        true | false
 *   amenities            pipe-separated amenity keys (e.g. hotel|meals|bus)
 *   has_meeting_place    true | false                    (trip row only)
 *   meeting_place_name   string                          (trip row only)
 *   meeting_place_name_ar string                         (trip row only)
 *   meeting_location     lat,lng or URL                  (trip row only)
 *   starting_city_name   human-readable hint             (trip row only)
 *
 * Security:
 *   - All string values are escaped (quotes doubled) before writing.
 *   - On import, every field is validated/sanitised before being applied to
 *     the form.  Numbers are clamped; dates are range-checked; enums are
 *     allow-listed.  Flexible tier strings are parsed and validated.
 *   - No eval / innerHTML / script injection paths exist.
 */

import { Trip, TripType, TripAmenity, PricingTier } from '../types/trip';

// ─── Column definitions ────────────────────────────────────────────────────

export const CSV_COLUMNS = [
  'row_type',
  'name_en',
  'name_ar',
  'description_en',
  'description_ar',
  'trip_nature',
  'tier_structure',
  'start_date',
  'end_date',
  'registration_deadline',
  'max_participants',
  'max_participants_pkg',
  'price_sar',
  'use_flexible_pricing',
  'flexible_tiers',
  'is_refundable',
  'amenities',
  'has_meeting_place',
  'meeting_place_name',
  'meeting_place_name_ar',
  'meeting_location',
  'starting_city_name',
  'starting_city_id',
  'destination_ids',
] as const;

export type CsvColumn = typeof CSV_COLUMNS[number];

// ─── Imported-data types ───────────────────────────────────────────────────

export interface CsvImportPackage {
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  price_sar: number;
  use_flexible_pricing: boolean;
  flexible_tiers: PricingTier[];
  is_refundable: boolean;
  amenities: string[];
  max_participants: number | null;
}

/** The structured object produced by a successful CSV import. */
export interface TripCsvImport {
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  trip_nature: TripType;
  tier_structure: 'single' | 'multiple';
  start_date: string;
  end_date: string;
  registration_deadline: string;
  max_participants: number;
  // Simple-trip pricing
  price_sar: number | null;
  use_flexible_pricing: boolean;
  flexible_tiers: PricingTier[];
  is_refundable: boolean;
  amenities: string[];
  // Meeting place
  has_meeting_place: boolean;
  meeting_place_name: string;
  meeting_place_name_ar: string;
  meeting_location: string;
  starting_city_name: string;
  starting_city_id: string;
  destination_ids: string[];
  // Packaged trip packages (populated from package rows)
  packages: CsvImportPackage[];
}

/** A validation error during import. */
export interface CsvFieldError {
  field: CsvColumn;
  messageKey: string;
  params?: Record<string, string | number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function escapeCell(value: string | number | boolean | null | undefined): string {
  const str = value == null ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCsvRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(escapeCell).join(',');
}

/** Serialise pricing tiers to "from:price|from:price" notation. */
function tiersToString(tiers: PricingTier[] | undefined | null): string {
  if (!tiers || tiers.length === 0) return '';
  return tiers
    .slice()
    .sort((a, b) => a.from_participant - b.from_participant)
    .map(t => `${t.from_participant}:${Number(t.price_per_person)}`)
    .join('|');
}

/** Parse "from:price|from:price" back to PricingTier[]. Returns [] on any error. */
function parseTiersString(raw: string): PricingTier[] {
  if (!raw.trim()) return [];
  try {
    const tiers = raw.split('|').map(part => {
      const [from, price] = part.split(':');
      const fp = parseInt(from, 10);
      const pp = parseFloat(price);
      if (isNaN(fp) || isNaN(pp) || fp < 1 || pp <= 0) throw new Error('invalid');
      return { from_participant: fp, price_per_person: pp };
    });
    // Must start at 1
    const sorted = tiers.sort((a, b) => a.from_participant - b.from_participant);
    if (sorted[0].from_participant !== 1) throw new Error('must start at 1');
    return sorted;
  } catch {
    return [];
  }
}

function parsePipeList(raw: string, allowed: Set<string>): string[] {
  if (!raw.trim()) return [];
  return raw.split('|').map(a => a.trim().toLowerCase()).filter(a => allowed.has(a));
}

/** Parse a raw CSV string into an array of rows, each an array of string cells.
 *  Handles quoted cells, embedded commas, and embedded newlines. */
export function parseCsvRaw(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let cell = '';
  let i = 0;
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i += 2; }
      else if (ch === '"') { inQuotes = false; i++; }
      else { cell += ch; i++; }
    } else {
      if (ch === '"') { inQuotes = true; i++; }
      else if (ch === ',') { row.push(cell); cell = ''; i++; }
      else if (ch === '\n') {
        row.push(cell); cell = '';
        if (row.some(c => c !== '')) rows.push(row);
        row = []; i++;
      } else { cell += ch; i++; }
    }
  }
  row.push(cell);
  if (row.some(c => c !== '')) rows.push(row);
  return rows;
}

// ─── Trim ISO datetime to YYYY-MM-DDTHH:mm ─────────────────────────────────
// Dates are stored as UTC ISO strings representing the provider's local wall-clock
// time (via localToUtcIso in TripForm). We must NOT re-convert through Date here.
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const bare = iso.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  return bare.substring(0, 16);
}

// ─── Export ───────────────────────────────────────────────────────────────

/** Serialise a Trip object to a multi-row CSV string. */
export function exportTripToCsv(trip: Trip): string {
  const header = buildCsvRow([...CSV_COLUMNS]);

  const isPackaged = trip.is_packaged_trip ?? false;
  const tripNature: string = (trip.trip_type as string) === 'self_arranged' ? 'self_arranged' : 'guided';
  const tierStructure = isPackaged ? 'multiple' : 'single';
  const cityName = (trip as any).starting_city?.name_en ?? '';
  const cityId = trip.starting_city_id ?? '';
  const destIds = ((trip as any).destinations ?? []).map((d: any) => d.id as string).join('|');

  // For simple trips: trip-level amenities; for packaged trips: blank (each package has its own)
  const tripAmenities = !isPackaged ? (trip.amenities ?? []).join('|') : '';

  // Simple-trip flexible pricing
  const simpleFlex = !isPackaged && (trip.simple_trip_use_flexible_pricing ?? false);
  const simpleFlexTiers = !isPackaged ? tiersToString(trip.simple_trip_pricing_tiers) : '';
  const simplePrice = !isPackaged ? (trip.price ?? '') : '';

  const tripRow = buildCsvRow([
    'trip',
    trip.name_en ?? '',
    trip.name_ar ?? '',
    trip.description_en ?? '',
    trip.description_ar ?? '',
    tripNature,
    tierStructure,
    fmtDate(trip.start_date),
    fmtDate(trip.end_date),
    fmtDate(trip.registration_deadline),
    trip.max_participants ?? '',
    '',                                    // max_participants_pkg — trip row blank
    simplePrice,
    simpleFlex,
    simpleFlexTiers,
    trip.is_refundable ?? true,
    tripAmenities,
    trip.has_meeting_place ?? false,
    trip.meeting_place_name ?? '',
    trip.meeting_place_name_ar ?? '',
    trip.meeting_location ?? '',
    cityName,
    cityId,
    destIds,
  ]);

  const rows: string[] = [header, tripRow];

  // Package rows (packaged trips)
  if (isPackaged && trip.packages && trip.packages.length > 0) {
    for (const pkg of trip.packages) {
      const pkgFlex = pkg.use_flexible_pricing ?? false;
      const pkgTiers = pkgFlex ? tiersToString(pkg.pricing_tiers) : '';
      const pkgPrice = pkgFlex ? '' : (pkg.price ?? '');
      const pkgAmenities = (pkg.amenities ?? []).join('|');
      rows.push(buildCsvRow([
        'package',
        pkg.name_en ?? '',
        pkg.name_ar ?? '',
        pkg.description_en ?? '',
        pkg.description_ar ?? '',
        '', '', '', '', '',            // trip-level fields blank
        '',                            // max_participants (trip)
        pkg.max_participants ?? '',    // max_participants_pkg
        pkgPrice,
        pkgFlex,
        pkgTiers,
        pkg.is_refundable ?? true,
        pkgAmenities,
        '', '', '', '', '',            // meeting place + city blank
        '', '',                        // starting_city_id + destination_ids blank
      ]));
    }
  }

  return rows.join('\n') + '\n';
}

/** Trigger a browser download of the CSV file. */
export function downloadTripCsv(trip: Trip): void {
  const csv = exportTripToCsv(trip);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const tripName = (trip.name_en || trip.name_ar || 'trip')
    .replace(/[^a-zA-Z0-9\u0600-\u06FF _-]/g, '').trim().replace(/\s+/g, '_');
  a.href = url;
  a.download = `trip_${tripName}_${trip.id.substring(0, 8)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Import / validation ──────────────────────────────────────────────────

const ALLOWED_TRIP_NATURES_LIST = ['guided', 'self_arranged'];
const ALLOWED_TRIP_NATURES = new Set(ALLOWED_TRIP_NATURES_LIST);
const ALLOWED_TIER_STRUCTURES_LIST = ['single', 'multiple'];
const ALLOWED_TIER_STRUCTURES = new Set(ALLOWED_TIER_STRUCTURES_LIST);
const ALLOWED_AMENITIES = new Set<string>(Object.values(TripAmenity));
const ALLOWED_ROW_TYPES = new Set(['trip', 'package']);

function validateDateField(
  value: string,
  field: CsvColumn,
  errors: CsvFieldError[],
  required = true,
): string {
  if (!value) {
    if (required) errors.push({ field, messageKey: 'csv.error.dateRequired', params: { field } });
    return '';
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
  if (!dateRegex.test(value)) {
    errors.push({ field, messageKey: 'csv.error.dateFormat', params: { field } });
    return '';
  }
  const d = new Date(value.length === 10 ? value + 'T00:00' : value);
  if (isNaN(d.getTime())) {
    errors.push({ field, messageKey: 'csv.error.dateInvalid', params: { field } });
    return '';
  }
  const year = d.getFullYear();
  if (year < 2020 || year > 2100) {
    errors.push({ field, messageKey: 'csv.error.dateRange', params: { field } });
    return '';
  }
  return value.length === 10 ? value + 'T00:00' : value;
}

/** Validate and parse a raw CSV file text.
 *  Returns either parsed data or an array of field errors. */
export function parseTripCsv(
  rawText: string,
): { data: TripCsvImport } | { errors: CsvFieldError[] } {
  const rows = parseCsvRaw(rawText);

  if (rows.length < 2) {
    return { errors: [{ field: 'name_en', messageKey: 'csv.error.emptyFile' }] };
  }

  const headerRow = rows[0].map(h => h.trim().toLowerCase());

  // Verify all required columns are present
  for (const col of CSV_COLUMNS) {
    if (!headerRow.includes(col)) {
      return {
        errors: [{ field: col as CsvColumn, messageKey: 'csv.error.missingColumn', params: { col } }],
      };
    }
  }

  const errors: CsvFieldError[] = [];

  // Helper to get a cell value by column name for a given data row
  const getCell = (row: string[], col: CsvColumn): string => {
    const idx = headerRow.indexOf(col);
    return idx >= 0 ? (row[idx] ?? '').trim() : '';
  };

  // Find the trip row (first non-header row with row_type = 'trip')
  const tripDataRow = rows.slice(1).find(r => getCell(r, 'row_type').toLowerCase() === 'trip');
  if (!tripDataRow) {
    // Fall back: if first data row has no row_type, treat as trip row (backwards compat)
    const fallback = rows[1];
    const rt = getCell(fallback, 'row_type').toLowerCase();
    if (rt && !ALLOWED_ROW_TYPES.has(rt)) {
      return { errors: [{ field: 'name_en', messageKey: 'csv.error.emptyFile' }] };
    }
  }
  const tripRow = tripDataRow ?? rows[1];

  const get = (col: CsvColumn): string => getCell(tripRow, col);

  // ── name_en / name_ar ──────────────────────────────────────────────────
  const name_en = get('name_en').substring(0, 200);
  const name_ar = get('name_ar').substring(0, 200);
  if (!name_en && !name_ar) {
    errors.push({ field: 'name_en', messageKey: 'csv.error.nameRequired' });
  }

  const description_en = get('description_en').substring(0, 5000);
  const description_ar = get('description_ar').substring(0, 5000);

  // ── trip_nature ────────────────────────────────────────────────────────
  const rawNature = get('trip_nature').toLowerCase();
  if (!ALLOWED_TRIP_NATURES.has(rawNature)) {
    errors.push({
      field: 'trip_nature',
      messageKey: 'csv.error.invalidEnum',
      params: { field: 'trip_nature', allowed: ALLOWED_TRIP_NATURES_LIST.join(', ') },
    });
  }
  const trip_nature = (ALLOWED_TRIP_NATURES.has(rawNature) ? rawNature : 'guided') as TripType;

  // ── tier_structure ─────────────────────────────────────────────────────
  const rawTier = get('tier_structure').toLowerCase();
  if (!ALLOWED_TIER_STRUCTURES.has(rawTier)) {
    errors.push({
      field: 'tier_structure',
      messageKey: 'csv.error.invalidEnum',
      params: { field: 'tier_structure', allowed: ALLOWED_TIER_STRUCTURES_LIST.join(', ') },
    });
  }
  const tier_structure = (ALLOWED_TIER_STRUCTURES.has(rawTier) ? rawTier : 'single') as 'single' | 'multiple';

  // ── Dates ──────────────────────────────────────────────────────────────
  const start_date = validateDateField(get('start_date'), 'start_date', errors);
  const end_date = validateDateField(get('end_date'), 'end_date', errors);
  const registration_deadline = validateDateField(get('registration_deadline'), 'registration_deadline', errors, false);

  if (start_date && end_date && new Date(end_date) <= new Date(start_date)) {
    errors.push({ field: 'end_date', messageKey: 'trip.validation.endAfterStart' });
  }
  if (start_date && registration_deadline && new Date(registration_deadline) > new Date(start_date)) {
    errors.push({ field: 'registration_deadline', messageKey: 'trip.validation.deadlineBeforeStart' });
  }

  // ── max_participants ────────────────────────────────────────────────────
  const rawMax = get('max_participants');
  const max_participants = parseInt(rawMax, 10);
  if (isNaN(max_participants) || max_participants < 1 || max_participants > 10000) {
    errors.push({ field: 'max_participants', messageKey: 'csv.error.maxParticipants' });
  }

  // ── Simple-trip pricing ────────────────────────────────────────────────
  const use_flexible_pricing = get('use_flexible_pricing').toLowerCase() === 'true';
  const rawFlexTiers = get('flexible_tiers');
  const flexible_tiers: PricingTier[] = use_flexible_pricing ? parseTiersString(rawFlexTiers) : [];

  const rawPrice = get('price_sar');
  let price_sar: number | null = null;
  if (tier_structure === 'single') {
    if (use_flexible_pricing) {
      if (flexible_tiers.length === 0 && rawFlexTiers.trim()) {
        errors.push({ field: 'flexible_tiers', messageKey: 'csv.error.flexTiersInvalid' });
      } else if (flexible_tiers.length === 0 && !rawFlexTiers.trim()) {
        errors.push({ field: 'flexible_tiers', messageKey: 'csv.error.flexTiersRequired' });
      }
    } else {
      const parsed = parseFloat(rawPrice);
      if (isNaN(parsed) || parsed < 1) {
        errors.push({ field: 'price_sar', messageKey: 'csv.error.price' });
      } else {
        price_sar = Math.round(parsed * 100) / 100;
      }
    }
  }

  // ── is_refundable ───────────────────────────────────────────────────────
  const is_refundable = get('is_refundable').toLowerCase() !== 'false';

  // ── amenities ───────────────────────────────────────────────────────────
  const amenities = parsePipeList(get('amenities'), ALLOWED_AMENITIES);

  // ── meeting place ───────────────────────────────────────────────────────
  const has_meeting_place = get('has_meeting_place').toLowerCase() === 'true';
  const meeting_place_name = get('meeting_place_name').substring(0, 200);
  const meeting_place_name_ar = get('meeting_place_name_ar').substring(0, 200);
  const meeting_location = get('meeting_location').substring(0, 500);

  const starting_city_name = get('starting_city_name').substring(0, 200);
  const starting_city_id = get('starting_city_id').substring(0, 100);

  // destination_ids: pipe-separated UUIDs — basic UUID pattern check, ignore malformed
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const destination_ids = get('destination_ids')
    .split('|')
    .map(s => s.trim())
    .filter(s => uuidPattern.test(s));

  // ── Package rows (for packaged trips) ──────────────────────────────────
  const packages: CsvImportPackage[] = [];
  if (tier_structure === 'multiple') {
    const packageRows = rows.slice(1).filter(r => getCell(r, 'row_type').toLowerCase() === 'package');
    if (packageRows.length < 2) {
      errors.push({ field: 'tier_structure', messageKey: 'csv.error.packagesRequired' });
    }
    for (const pkgRow of packageRows) {
      const pg = (col: CsvColumn) => getCell(pkgRow, col);
      const pkgFlex = pg('use_flexible_pricing').toLowerCase() === 'true';
      const pkgTiersRaw = pg('flexible_tiers');
      const pkgTiers = pkgFlex ? parseTiersString(pkgTiersRaw) : [];
      const pkgPriceRaw = pg('price_sar');
      let pkgPrice = 0;
      if (!pkgFlex) {
        const p = parseFloat(pkgPriceRaw);
        pkgPrice = isNaN(p) || p < 0 ? 0 : Math.round(p * 100) / 100;
      }
      const pkgMaxRaw = pg('max_participants_pkg');
      const pkgMax = pkgMaxRaw ? parseInt(pkgMaxRaw, 10) : null;
      packages.push({
        name_en: pg('name_en').substring(0, 200),
        name_ar: pg('name_ar').substring(0, 200),
        description_en: pg('description_en').substring(0, 5000),
        description_ar: pg('description_ar').substring(0, 5000),
        price_sar: pkgPrice,
        use_flexible_pricing: pkgFlex,
        flexible_tiers: pkgTiers,
        is_refundable: pg('is_refundable').toLowerCase() !== 'false',
        amenities: parsePipeList(pg('amenities'), ALLOWED_AMENITIES),
        max_participants: pkgMax && !isNaN(pkgMax) ? pkgMax : null,
      });
    }
  }

  if (errors.length > 0) return { errors };

  return {
    data: {
      name_en, name_ar, description_en, description_ar,
      trip_nature, tier_structure,
      start_date, end_date, registration_deadline,
      max_participants,
      price_sar, use_flexible_pricing, flexible_tiers,
      is_refundable, amenities,
      has_meeting_place, meeting_place_name, meeting_place_name_ar, meeting_location,
      starting_city_name,
      starting_city_id,
      destination_ids,
      packages,
    },
  };
}

/** Read a File object and run parseTripCsv on it. */
export function readAndParseCsvFile(
  file: File,
): Promise<{ data: TripCsvImport } | { errors: CsvFieldError[] }> {
  return new Promise((resolve, reject) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      resolve({ errors: [{ field: 'name_en', messageKey: 'csv.error.notCsvFile' }] });
      return;
    }
    if (file.size > 512 * 1024) {
      resolve({ errors: [{ field: 'name_en', messageKey: 'csv.error.fileTooLarge' }] });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== 'string') { reject(new Error('Failed to read file')); return; }
      resolve(parseTripCsv(text));
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsText(file, 'utf-8');
  });
}
