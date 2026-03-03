import React, { useState, useRef, useEffect } from 'react';

interface CountryEntry {
  dial_code: string;
  code: string;
  name: string;
  name_ar: string;
  flag: string;
}

const COUNTRIES: CountryEntry[] = [
  { dial_code: "966", code: "SA", name: "Saudi Arabia",   name_ar: "\u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629", flag: "\uD83C\uDDF8\uD83C\uDDE6" },
  { dial_code: "971", code: "AE", name: "UAE",             name_ar: "\u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062a",  flag: "\uD83C\uDDE6\uD83C\uDDEA" },
  { dial_code: "965", code: "KW", name: "Kuwait",          name_ar: "\u0627\u0644\u0643\u0648\u064a\u062a",               flag: "\uD83C\uDDF0\uD83C\uDDFC" },
  { dial_code: "974", code: "QA", name: "Qatar",           name_ar: "\u0642\u0637\u0631",                      flag: "\uD83C\uDDF6\uD83C\uDDE6" },
  { dial_code: "973", code: "BH", name: "Bahrain",         name_ar: "\u0627\u0644\u0628\u062d\u0631\u064a\u0646",                  flag: "\uD83C\uDDE7\uD83C\uDDED" },
  { dial_code: "968", code: "OM", name: "Oman",            name_ar: "\u0639\u064f\u0645\u0627\u0646",                    flag: "\uD83C\uDDF4\uD83C\uDDF2" },
  { dial_code: "962", code: "JO", name: "Jordan",          name_ar: "\u0627\u0644\u0623\u0631\u062f\u0646",                   flag: "\uD83C\uDDEF\uD83C\uDDF4" },
  { dial_code: "961", code: "LB", name: "Lebanon",         name_ar: "\u0644\u0628\u0646\u0627\u0646",                    flag: "\uD83C\uDDF1\uD83C\uDDE7" },
  { dial_code: "963", code: "SY", name: "Syria",           name_ar: "\u0633\u0648\u0631\u064a\u0627",                    flag: "\uD83C\uDDF8\uD83C\uDDFE" },
  { dial_code: "964", code: "IQ", name: "Iraq",            name_ar: "\u0627\u0644\u0639\u0631\u0627\u0642",                   flag: "\uD83C\uDDEE\uD83C\uDDF6" },
  { dial_code: "967", code: "YE", name: "Yemen",           name_ar: "\u0627\u0644\u064a\u0645\u0646",                    flag: "\uD83C\uDDFE\uD83C\uDDEA" },
  { dial_code: "20",  code: "EG", name: "Egypt",           name_ar: "\u0645\u0635\u0631",                      flag: "\uD83C\uDDEA\uD83C\uDDEC" },
  { dial_code: "212", code: "MA", name: "Morocco",         name_ar: "\u0627\u0644\u0645\u063a\u0631\u0628",                   flag: "\uD83C\uDDF2\uD83C\uDDE6" },
  { dial_code: "216", code: "TN", name: "Tunisia",         name_ar: "\u062a\u0648\u0646\u0633",                     flag: "\uD83C\uDDF9\uD83C\uDDF3" },
  { dial_code: "213", code: "DZ", name: "Algeria",         name_ar: "\u0627\u0644\u062c\u0632\u0627\u0626\u0631",                  flag: "\uD83C\uDDE9\uD83C\uDDFF" },
  { dial_code: "249", code: "SD", name: "Sudan",           name_ar: "\u0627\u0644\u0633\u0648\u062f\u0627\u0646",                  flag: "\uD83C\uDDF8\uD83C\uDDE9" },
  { dial_code: "91",  code: "IN", name: "India",           name_ar: "\u0627\u0644\u0647\u0646\u062f",                    flag: "\uD83C\uDDEE\uD83C\uDDF3" },
  { dial_code: "92",  code: "PK", name: "Pakistan",        name_ar: "\u0628\u0627\u0643\u0633\u062a\u0627\u0646",                  flag: "\uD83C\uDDF5\uD83C\uDDF0" },
  { dial_code: "880", code: "BD", name: "Bangladesh",      name_ar: "\u0628\u0646\u063a\u0644\u0627\u062f\u064a\u0634",                 flag: "\uD83C\uDDE7\uD83C\uDDE9" },
  { dial_code: "63",  code: "PH", name: "Philippines",     name_ar: "\u0627\u0644\u0641\u0644\u0628\u064a\u0646",                  flag: "\uD83C\uDDF5\uD83C\uDDED" },
  { dial_code: "62",  code: "ID", name: "Indonesia",       name_ar: "\u0625\u0646\u062f\u0648\u0646\u064a\u0633\u064a\u0627",                flag: "\uD83C\uDDEE\uD83C\uDDE9" },
  { dial_code: "94",  code: "LK", name: "Sri Lanka",       name_ar: "\u0633\u0631\u064a\u0644\u0627\u0646\u0643\u0627",                 flag: "\uD83C\uDDF1\uD83C\uDDF0" },
  { dial_code: "977", code: "NP", name: "Nepal",           name_ar: "\u0646\u064a\u0628\u0627\u0644",                    flag: "\uD83C\uDDF3\uD83C\uDDF5" },
  { dial_code: "251", code: "ET", name: "Ethiopia",        name_ar: "\u0625\u062b\u064a\u0648\u0628\u064a\u0627",                  flag: "\uD83C\uDDEA\uD83C\uDDF9" },
  { dial_code: "1",   code: "US", name: "United States",   name_ar: "\u0627\u0644\u0648\u0644\u0627\u064a\u0627\u062a \u0627\u0644\u0645\u062a\u062d\u062f\u0629",         flag: "\uD83C\uDDFA\uD83C\uDDF8" },
  { dial_code: "44",  code: "GB", name: "United Kingdom",  name_ar: "\u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0645\u062a\u062d\u062f\u0629",          flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  { dial_code: "33",  code: "FR", name: "France",          name_ar: "\u0641\u0631\u0646\u0633\u0627",                    flag: "\uD83C\uDDEB\uD83C\uDDF7" },
  { dial_code: "49",  code: "DE", name: "Germany",         name_ar: "\u0623\u0644\u0645\u0627\u0646\u064a\u0627",                  flag: "\uD83C\uDDE9\uD83C\uDDEA" },
  { dial_code: "39",  code: "IT", name: "Italy",           name_ar: "\u0625\u064a\u0637\u0627\u0644\u064a\u0627",                  flag: "\uD83C\uDDEE\uD83C\uDDF9" },
  { dial_code: "34",  code: "ES", name: "Spain",           name_ar: "\u0625\u0633\u0628\u0627\u0646\u064a\u0627",                  flag: "\uD83C\uDDEA\uD83C\uDDF8" },
  { dial_code: "90",  code: "TR", name: "Turkey",          name_ar: "\u062a\u0631\u0643\u064a\u0627",                    flag: "\uD83C\uDDF9\uD83C\uDDF7" },
  { dial_code: "7",   code: "RU", name: "Russia",          name_ar: "\u0631\u0648\u0633\u064a\u0627",                    flag: "\uD83C\uDDF7\uD83C\uDDFA" },
  { dial_code: "86",  code: "CN", name: "China",           name_ar: "\u0627\u0644\u0635\u064a\u0646",                    flag: "\uD83C\uDDE8\uD83C\uDDF3" },
  { dial_code: "81",  code: "JP", name: "Japan",           name_ar: "\u0627\u0644\u064a\u0627\u0628\u0627\u0646",                  flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  { dial_code: "82",  code: "KR", name: "South Korea",     name_ar: "\u0643\u0648\u0631\u064a\u0627 \u0627\u0644\u062c\u0646\u0648\u0628\u064a\u0629",           flag: "\uD83C\uDDF0\uD83C\uDDF7" },
  { dial_code: "55",  code: "BR", name: "Brazil",          name_ar: "\u0627\u0644\u0628\u0631\u0627\u0632\u064a\u0644",                 flag: "\uD83C\uDDE7\uD83C\uDDF7" },
  { dial_code: "61",  code: "AU", name: "Australia",       name_ar: "\u0623\u0633\u062a\u0631\u0627\u0644\u064a\u0627",                 flag: "\uD83C\uDDE6\uD83C\uDDFA" },
  { dial_code: "1",   code: "CA", name: "Canada",          name_ar: "\u0643\u0646\u062f\u0627",                     flag: "\uD83C\uDDE8\uD83C\uDDE6" },
];

const PHONE_PATTERNS: Record<string, { min: number; max: number; regex?: RegExp }> = {
  "966": { min: 9, max: 9, regex: /^5\d{8}$/ },
  "971": { min: 9, max: 9 },
  "965": { min: 8, max: 8 },
  "974": { min: 8, max: 8 },
  "973": { min: 8, max: 8 },
  "968": { min: 8, max: 8 },
  "962": { min: 9, max: 9 },
  "961": { min: 7, max: 8 },
  "963": { min: 9, max: 9 },
  "964": { min: 10, max: 10 },
  "967": { min: 9, max: 9 },
  "20":  { min: 10, max: 10 },
  "212": { min: 9, max: 9 },
  "216": { min: 8, max: 8 },
  "213": { min: 9, max: 9 },
  "249": { min: 9, max: 9 },
  "91":  { min: 10, max: 10 },
  "92":  { min: 10, max: 10 },
  "880": { min: 10, max: 10 },
  "63":  { min: 10, max: 10 },
  "62":  { min: 9,  max: 12 },
  "94":  { min: 9,  max: 9 },
  "977": { min: 9,  max: 10 },
  "251": { min: 9,  max: 9 },
  "1":   { min: 10, max: 10 },
  "44":  { min: 10, max: 10 },
  "33":  { min: 9,  max: 9 },
  "49":  { min: 10, max: 11 },
  "39":  { min: 9,  max: 11 },
  "34":  { min: 9,  max: 9 },
  "90":  { min: 10, max: 10 },
  "7":   { min: 10, max: 10 },
  "86":  { min: 11, max: 11 },
  "81":  { min: 10, max: 11 },
  "82":  { min: 9,  max: 10 },
  "55":  { min: 10, max: 11 },
  "61":  { min: 9,  max: 9 },
};

function validateLocalNumber(dialCode: string, localDigits: string): string | null {
  const pattern = PHONE_PATTERNS[dialCode];
  if (!pattern) return null;
  const local = localDigits.startsWith('0') ? localDigits.slice(1) : localDigits;
  if (local.length < pattern.min || local.length > pattern.max) {
    return `Expected ${pattern.min === pattern.max ? pattern.min : `${pattern.min}-${pattern.max}`} digits`;
  }
  if (pattern.regex && !pattern.regex.test(local)) {
    return 'Invalid number format for this country';
  }
  return null;
}

interface PhoneInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (fullNumber: string) => void;
  required?: boolean;
  inputCls: string;
  labelCls: string;
  defaultDialCode?: string;
}

const PhoneInput: React.FC<PhoneInputProps> = ({
  label,
  value,
  onChange,
  required = false,
  inputCls,
  labelCls,
  defaultDialCode = '966',
}) => {
  const parseValue = (v: string): { dialCode: string; local: string } => {
    const digits = v.replace(/\D/g, '');
    const seen = new Set<string>();
    const sortedCodes = COUNTRIES
      .map(c => c.dial_code)
      .filter(d => { if (seen.has(d)) return false; seen.add(d); return true; })
      .sort((a, b) => b.length - a.length);
    for (const code of sortedCodes) {
      if (digits.startsWith(code)) {
        return { dialCode: code, local: digits.slice(code.length) };
      }
    }
    return { dialCode: defaultDialCode, local: digits };
  };

  const parsed = parseValue(value);
  const [dialCode, setDialCode] = useState(parsed.dialCode);
  const [localNumber, setLocalNumber] = useState(parsed.local);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedCountry = COUNTRIES.find(c => c.dial_code === dialCode) ?? COUNTRIES[0];

  const filteredCountries = COUNTRIES.filter(c => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.name_ar.includes(search) ||
      c.dial_code.includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  });

  const handleDialCodeSelect = (country: CountryEntry) => {
    setDialCode(country.dial_code);
    setOpen(false);
    setSearch('');
    const full = localNumber ? `+${country.dial_code}${localNumber}` : '';
    onChange(full);
    const err = localNumber ? validateLocalNumber(country.dial_code, localNumber) : null;
    setValidationError(err);
  };

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setLocalNumber(raw);
    const full = raw ? `+${dialCode}${raw}` : '';
    onChange(full);
    const err = raw ? validateLocalNumber(dialCode, raw) : null;
    setValidationError(err);
  };

  const btnCls = inputCls
    .replace('w-full', '')
    .split(' ')
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex gap-2 items-start">
        {/* Country code dropdown */}
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className={`${btnCls} flex items-center gap-1.5 px-3 whitespace-nowrap`}
            style={{ minWidth: '90px' }}
          >
            <span className="text-base leading-none">{selectedCountry.flag}</span>
            <span>+{dialCode}</span>
            <svg
              className={`w-3 h-3 text-slate-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open && (
            <div className="absolute z-50 top-full mt-1 left-0 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
              <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search country..."
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filteredCountries.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-slate-400 text-center">No results</p>
                ) : (
                  filteredCountries.map((c, idx) => (
                    <button
                      key={`${c.code}-${idx}`}
                      type="button"
                      onClick={() => handleDialCodeSelect(c)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left ${
                        c.dial_code === dialCode && c.code === selectedCountry.code
                          ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="text-base leading-none flex-shrink-0">{c.flag}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-slate-400 dark:text-slate-500 flex-shrink-0 font-mono text-xs">+{c.dial_code}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Local number input */}
        <div className="flex-1 min-w-0">
          <input
            type="tel"
            inputMode="numeric"
            value={localNumber}
            onChange={handleLocalChange}
            required={required}
            placeholder="5XXXXXXXX"
            className={`${inputCls} ${validationError ? 'border-red-400 focus:ring-red-400' : ''}`}
          />
        </div>
      </div>

      {validationError && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">{validationError}</p>
      )}

      {/* Hidden input so form serialization gets the full number */}
      {required && (
        <input type="hidden" value={localNumber ? `+${dialCode}${localNumber}` : ''} />
      )}
    </div>
  );
};

export default PhoneInput;
