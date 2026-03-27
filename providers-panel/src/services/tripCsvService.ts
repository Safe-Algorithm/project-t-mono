/**
 * Trip CSV Export / Import Service
 *
 * CSV Schema (one header row, one data row per trip):
 *   name_en, name_ar, description_en, description_ar,
 *   trip_nature (guided|self_arranged),
 *   tier_structure (single|multiple),
 *   start_date (YYYY-MM-DDTHH:mm), end_date (YYYY-MM-DDTHH:mm),
 *   registration_deadline (YYYY-MM-DDTHH:mm),
 *   max_participants (integer),
 *   price_sar (number — only for single-tier trips),
 *   is_refundable (true|false),
 *   amenities (pipe-separated, e.g. hotel|meals|bus),
 *   starting_city_name (human-readable, used as hint for import)
 *
 * Security:
 *   - All string values are escaped (quotes doubled) before writing.
 *   - On import, every field is validated/sanitised before being applied to the form.
 *   - Numbers are clamped; dates are range-checked; enums are allow-listed.
 *   - No eval / innerHTML / script injection paths exist.
 */

import { Trip, TripType, TripAmenity } from '../types/trip';

// ─── CSV column definitions ────────────────────────────────────────────────

export const CSV_COLUMNS = [
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
  'price_sar',
  'is_refundable',
  'amenities',
  'starting_city_name',
] as const;

export type CsvColumn = typeof CSV_COLUMNS[number];

/** The structured object produced by a successful CSV import. */
export interface TripCsvImport {
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  trip_nature: TripType;
  tier_structure: 'single' | 'multiple';
  start_date: string;        // YYYY-MM-DDTHH:mm
  end_date: string;
  registration_deadline: string;
  max_participants: number;
  price_sar: number | null;  // null when tier_structure === 'multiple'
  is_refundable: boolean;
  amenities: string[];
  starting_city_name: string;
}

/** A validation error during import: field name + localised message key + optional interpolation params. */
export interface CsvFieldError {
  field: CsvColumn;
  messageKey: string;
  params?: Record<string, string | number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Escape a single CSV cell value. Wraps in quotes and doubles any internal quotes. */
function escapeCell(value: string | number | boolean | null | undefined): string {
  const str = value == null ? '' : String(value);
  // Always quote — simplest safe approach
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCsvRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(escapeCell).join(',');
}

/** Parse a raw CSV string into an array of rows, each an array of string cells.
 *  Handles quoted cells, embedded commas, and embedded newlines. */
function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let cell = '';
  let i = 0;

  // Normalise line endings
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 2;
      } else if (ch === '"') {
        inQuotes = false;
        i++;
      } else {
        cell += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
        i++;
      } else if (ch === '\n') {
        row.push(cell);
        cell = '';
        // Skip completely empty trailing rows
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
        i++;
      } else {
        cell += ch;
        i++;
      }
    }
  }
  // Last cell / row
  row.push(cell);
  if (row.some(c => c !== '')) rows.push(row);

  return rows;
}

// ─── Export ───────────────────────────────────────────────────────────────

/** Serialise a Trip object to a CSV string ready for download. */
export function exportTripToCsv(trip: Trip): string {
  const header = buildCsvRow([...CSV_COLUMNS]);

  // Trim an ISO datetime string to YYYY-MM-DDTHH:mm.
  // Dates in the DB are stored as UTC ISO strings that represent the provider's
  // local wall-clock time (via localToUtcIso in TripForm). We must NOT
  // re-convert through Date/toISOString() here because that would apply a
  // second UTC shift and produce a wrong time in the exported CSV.
  const fmt = (iso: string | null | undefined): string => {
    if (!iso) return '';
    // Strip any trailing 'Z' or timezone offset, then take first 16 chars
    const bare = iso.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
    return bare.substring(0, 16);
  };

  const amenities = (trip.amenities ?? []).join('|');
  const isPackaged = trip.is_packaged_trip ?? false;
  const tripNature: string = (trip.trip_type as string) === 'self_arranged' ? 'self_arranged' : 'guided';
  const tierStructure = isPackaged ? 'multiple' : 'single';
  const price = isPackaged ? '' : (trip.price ?? '');
  const cityName = (trip as any).starting_city?.name_en ?? '';

  const dataRow = buildCsvRow([
    trip.name_en ?? '',
    trip.name_ar ?? '',
    trip.description_en ?? '',
    trip.description_ar ?? '',
    tripNature,
    tierStructure,
    fmt(trip.start_date),
    fmt(trip.end_date),
    fmt(trip.registration_deadline),
    trip.max_participants ?? '',
    price,
    trip.is_refundable ?? true,
    amenities,
    cityName,
  ]);

  return `${header}\n${dataRow}\n`;
}

/** Trigger a browser download of the CSV file. */
export function downloadTripCsv(trip: Trip): void {
  const csv = exportTripToCsv(trip);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const tripName = (trip.name_en || trip.name_ar || 'trip').replace(/[^a-zA-Z0-9\u0600-\u06FF _-]/g, '').trim().replace(/\s+/g, '_');
  a.href = url;
  a.download = `trip_${tripName}_${trip.id.substring(0, 8)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Import / validation ──────────────────────────────────────────────────

const ALLOWED_TRIP_NATURES: string[] = ['guided', 'self_arranged'];
const ALLOWED_TIER_STRUCTURES: string[] = ['single', 'multiple'];
const ALLOWED_AMENITIES = new Set<string>(Object.values(TripAmenity));

/** Validate and parse a raw CSV file text.
 *  Returns either parsed data or an array of field errors. */
export function parseTripCsv(
  rawText: string
): { data: TripCsvImport } | { errors: CsvFieldError[] } {
  const rows = parseCsv(rawText);

  if (rows.length < 2) {
    return { errors: [{ field: 'name_en', messageKey: 'csv.error.emptyFile' }] };
  }

  const headerRow = rows[0].map(h => h.trim().toLowerCase());
  const dataRow = rows[1];

  // Verify all expected columns are present
  for (const col of CSV_COLUMNS) {
    if (!headerRow.includes(col)) {
      return {
        errors: [{ field: col as CsvColumn, messageKey: 'csv.error.missingColumn', params: { col } }],
      };
    }
  }

  const get = (col: CsvColumn): string => {
    const idx = headerRow.indexOf(col);
    return idx >= 0 ? (dataRow[idx] ?? '').trim() : '';
  };

  const errors: CsvFieldError[] = [];

  // ── name_en / name_ar — at least one required ──────────────────────────
  const name_en = get('name_en').substring(0, 200);
  const name_ar = get('name_ar').substring(0, 200);
  if (!name_en && !name_ar) {
    errors.push({ field: 'name_en', messageKey: 'csv.error.nameRequired' });
  }

  // ── descriptions — optional, max 5000 chars each ──────────────────────
  const description_en = get('description_en').substring(0, 5000);
  const description_ar = get('description_ar').substring(0, 5000);

  // ── trip_nature ────────────────────────────────────────────────────────
  const rawNature = get('trip_nature').toLowerCase();
  if (!ALLOWED_TRIP_NATURES.includes(rawNature)) {
    errors.push({
      field: 'trip_nature',
      messageKey: 'csv.error.invalidEnum',
      params: { field: 'trip_nature', allowed: ALLOWED_TRIP_NATURES.join(', ') },
    });
  }
  const trip_nature = (ALLOWED_TRIP_NATURES.includes(rawNature) ? rawNature : 'guided') as TripType;

  // ── tier_structure ─────────────────────────────────────────────────────
  const rawTier = get('tier_structure').toLowerCase();
  if (!ALLOWED_TIER_STRUCTURES.includes(rawTier)) {
    errors.push({
      field: 'tier_structure',
      messageKey: 'csv.error.invalidEnum',
      params: { field: 'tier_structure', allowed: ALLOWED_TIER_STRUCTURES.join(', ') },
    });
  }
  const tier_structure = (ALLOWED_TIER_STRUCTURES.includes(rawTier) ? rawTier : 'single') as 'single' | 'multiple';

  // ── Dates ──────────────────────────────────────────────────────────────
  const validateDate = (col: CsvColumn): string => {
    const raw = get(col);
    if (!raw) {
      errors.push({ field: col, messageKey: 'csv.error.dateRequired', params: { field: col } });
      return '';
    }
    // Accept YYYY-MM-DDTHH:mm or YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
    if (!dateRegex.test(raw)) {
      errors.push({ field: col, messageKey: 'csv.error.dateFormat', params: { field: col } });
      return '';
    }
    const d = new Date(raw.length === 10 ? raw + 'T00:00' : raw);
    if (isNaN(d.getTime())) {
      errors.push({ field: col, messageKey: 'csv.error.dateInvalid', params: { field: col } });
      return '';
    }
    // Reject absurdly far-future or past dates
    const year = d.getFullYear();
    if (year < 2020 || year > 2100) {
      errors.push({ field: col, messageKey: 'csv.error.dateRange', params: { field: col } });
      return '';
    }
    return raw.length === 10 ? raw + 'T00:00' : raw;
  };

  const start_date = validateDate('start_date');
  const end_date = validateDate('end_date');
  const registration_deadline = validateDate('registration_deadline');

  // Cross-date validations (only if individual dates parsed OK)
  if (start_date && end_date) {
    if (new Date(end_date) <= new Date(start_date)) {
      errors.push({ field: 'end_date', messageKey: 'trip.validation.endAfterStart' });
    }
  }
  if (start_date && registration_deadline) {
    if (new Date(registration_deadline) > new Date(start_date)) {
      errors.push({ field: 'registration_deadline', messageKey: 'trip.validation.deadlineBeforeStart' });
    }
  }

  // ── max_participants ────────────────────────────────────────────────────
  const rawMax = get('max_participants');
  const max_participants = parseInt(rawMax, 10);
  if (isNaN(max_participants) || max_participants < 1 || max_participants > 10000) {
    errors.push({ field: 'max_participants', messageKey: 'csv.error.maxParticipants' });
  }

  // ── price_sar ───────────────────────────────────────────────────────────
  const rawPrice = get('price_sar');
  let price_sar: number | null = null;
  if (tier_structure === 'single') {
    const parsed = parseFloat(rawPrice);
    if (isNaN(parsed) || parsed < 1) {
      errors.push({ field: 'price_sar', messageKey: 'csv.error.price' });
    } else {
      price_sar = Math.round(parsed * 100) / 100;
    }
  }

  // ── is_refundable ───────────────────────────────────────────────────────
  const rawRefundable = get('is_refundable').toLowerCase();
  const is_refundable = rawRefundable !== 'false';

  // ── amenities — pipe-separated, allow-listed ────────────────────────────
  const rawAmenities = get('amenities');
  const amenities: string[] = rawAmenities
    ? rawAmenities
        .split('|')
        .map(a => a.trim().toLowerCase())
        .filter(a => ALLOWED_AMENITIES.has(a))
    : [];

  // ── starting_city_name — informational hint only ────────────────────────
  const starting_city_name = get('starting_city_name').substring(0, 200);

  if (errors.length > 0) return { errors };

  return {
    data: {
      name_en,
      name_ar,
      description_en,
      description_ar,
      trip_nature,
      tier_structure,
      start_date,
      end_date,
      registration_deadline,
      max_participants,
      price_sar,
      is_refundable,
      amenities,
      starting_city_name,
    },
  };
}

/** Read a File object and run parseTripCsv on it.
 *  Rejects on read error. Resolves with parse result. */
export function readAndParseCsvFile(
  file: File
): Promise<{ data: TripCsvImport } | { errors: CsvFieldError[] }> {
  return new Promise((resolve, reject) => {
    // Only allow .csv files
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      resolve({ errors: [{ field: 'name_en', messageKey: 'csv.error.notCsvFile' }] });
      return;
    }
    // Limit file size to 512 KB — a trip CSV is tiny; anything larger is suspicious
    if (file.size > 512 * 1024) {
      resolve({ errors: [{ field: 'name_en', messageKey: 'csv.error.fileTooLarge' }] });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }
      resolve(parseTripCsv(text));
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsText(file, 'utf-8');
  });
}
