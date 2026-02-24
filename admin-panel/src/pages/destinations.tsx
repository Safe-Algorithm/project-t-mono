import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { destinationService, Destination, Place, CreateDestination, CreatePlace, UpdateDestination, UpdatePlace } from '@/services/destinationService';

const PLACE_TYPES = ['area', 'district', 'attraction', 'resort', 'theme_park', 'landmark', 'experience'];

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export default function DestinationsPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showPlaceModal, setShowPlaceModal] = useState(false);
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Destination | null>(null);
  const [selectedCity, setSelectedCity] = useState<Destination | null>(null);

  // Expanded state for tree view
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  const fetchDestinations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await destinationService.getAll();
      setDestinations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load destinations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchDestinations();
  }, [token, fetchDestinations]);

  const toggleCountry = (id: string) => {
    setExpandedCountries(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCity = (id: string) => {
    setExpandedCities(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleActivate = async (id: string, isActive: boolean) => {
    try {
      await destinationService.activate(id, isActive);
      fetchDestinations();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteDestination = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its children?`)) return;
    try {
      await destinationService.delete(id);
      fetchDestinations();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeletePlace = async (id: string, name: string) => {
    if (!confirm(`Delete place "${name}"?`)) return;
    try {
      await destinationService.deletePlace(id);
      fetchDestinations();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Filter destinations by search
  const filteredDestinations = destinations.filter(country => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (country.name_en.toLowerCase().includes(q) || country.name_ar.includes(q) || country.country_code.toLowerCase().includes(q)) return true;
    if (country.children?.some(city =>
      city.name_en.toLowerCase().includes(q) || city.name_ar.includes(q)
    )) return true;
    return false;
  });

  const btnSm = "px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors";

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('destinations.title')}</h1>
          <div className="flex gap-4 mt-1 text-xs text-slate-400 dark:text-slate-500">
            <span>{destinations.length} countries</span>
            <span>{destinations.reduce((s, c) => s + (c.children?.length || 0), 0)} cities</span>
            <span>{destinations.filter(c => c.is_active).length} active</span>
          </div>
        </div>
        <button onClick={() => { setEditingDestination(null); setShowCountryModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {t('destinations.addCountry')}
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:opacity-70 text-lg leading-none">&times;</button>
        </div>
      )}

      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input type="text" placeholder={t('destinations.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
      </div>

      {/* Tree View */}
      <div className="space-y-2">
        {filteredDestinations.map(country => (
          <div key={country.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Country Row */}
            <div className={`flex flex-wrap items-center gap-2 px-4 py-3 ${!country.is_active ? 'opacity-60' : ''}`}>
              <button onClick={() => toggleCountry(country.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <svg className={`w-4 h-4 transition-transform ${expandedCountries.has(country.id) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-lg">{country.country_code}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{country.name_en}</span>
              <span className="text-slate-400 dark:text-slate-500 text-sm" dir="rtl">{country.name_ar}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{country.children?.length || 0} cities</span>
              <button onClick={() => handleActivate(country.id, !country.is_active)}
                className={`${btnSm} ${country.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                {country.is_active ? 'Active' : 'Inactive'}
              </button>
              <button onClick={() => { setSelectedCountry(country); setEditingDestination(null); setShowCityModal(true); }}
                className={`${btnSm} bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-900/50`}>
                + City
              </button>
              <button onClick={() => { setEditingDestination(country); setShowCountryModal(true); }}
                className={`${btnSm} bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200`}>
                Edit
              </button>
              <button onClick={() => handleDeleteDestination(country.id, country.name_en)}
                className={`${btnSm} bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200`}>
                Delete
              </button>
            </div>

            {/* Cities */}
            {expandedCountries.has(country.id) && country.children && country.children.length > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-800">
                {country.children.map(city => (
                  <div key={city.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                    <div className={`flex flex-wrap items-center gap-2 px-4 py-2.5 pl-10 bg-slate-50 dark:bg-slate-800/40 ${!city.is_active ? 'opacity-60' : ''}`}>
                      <button onClick={() => toggleCity(city.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <svg className={`w-3.5 h-3.5 transition-transform ${expandedCities.has(city.id) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                      <span className="text-sky-500 text-xs">↳</span>
                      <span className="font-medium text-sm text-slate-800 dark:text-slate-200">{city.name_en}</span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs" dir="rtl">{city.name_ar}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{city.places?.length || 0} places</span>
                      <button onClick={() => handleActivate(city.id, !city.is_active)}
                        className={`${btnSm} ${city.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                        {city.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <button onClick={() => { setSelectedCity(city); setEditingPlace(null); setShowPlaceModal(true); }}
                        className={`${btnSm} bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 hover:bg-violet-200`}>
                        + Place
                      </button>
                      <button onClick={() => { setEditingDestination(city); setSelectedCountry(country); setShowCityModal(true); }}
                        className={`${btnSm} bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200`}>
                        Edit
                      </button>
                      <button onClick={() => handleDeleteDestination(city.id, city.name_en)}
                        className={`${btnSm} bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200`}>
                        Delete
                      </button>
                    </div>

                    {/* Places */}
                    {expandedCities.has(city.id) && city.places && city.places.length > 0 && (
                      <div className="border-t border-slate-100 dark:border-slate-800/50">
                        {city.places.map(place => (
                          <div key={place.id} className="flex flex-wrap items-center gap-2 px-4 py-2 pl-16 bg-slate-50/50 dark:bg-slate-800/20 text-sm">
                            <svg className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{place.name_en}</span>
                            <span className="text-slate-400 dark:text-slate-500 text-xs" dir="rtl">{place.name_ar}</span>
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-lg">{place.type}</span>
                            <span className="ml-auto" />
                            <button onClick={() => { setEditingPlace(place); setSelectedCity(city); setShowPlaceModal(true); }}
                              className={`${btnSm} bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200`}>
                              Edit
                            </button>
                            <button onClick={() => handleDeletePlace(place.id, place.name_en)}
                              className={`${btnSm} bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200`}>
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredDestinations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No destinations found</p>
        </div>
      )}

      {/* Country Modal */}
      {showCountryModal && (
        <CountryModal
          destination={editingDestination}
          onClose={() => { setShowCountryModal(false); setEditingDestination(null); }}
          onSaved={() => { setShowCountryModal(false); setEditingDestination(null); fetchDestinations(); }}
        />
      )}

      {/* City Modal */}
      {showCityModal && selectedCountry && (
        <CityModal
          country={selectedCountry}
          city={editingDestination}
          onClose={() => { setShowCityModal(false); setEditingDestination(null); setSelectedCountry(null); }}
          onSaved={() => { setShowCityModal(false); setEditingDestination(null); setSelectedCountry(null); fetchDestinations(); }}
        />
      )}

      {/* Place Modal */}
      {showPlaceModal && selectedCity && (
        <PlaceModal
          city={selectedCity}
          place={editingPlace}
          onClose={() => { setShowPlaceModal(false); setEditingPlace(null); setSelectedCity(null); }}
          onSaved={() => { setShowPlaceModal(false); setEditingPlace(null); setSelectedCity(null); fetchDestinations(); }}
        />
      )}
    </div>
  );
}

// ===== Country Modal =====
function CountryModal({ destination, onClose, onSaved }: { destination: Destination | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!destination;
  const [form, setForm] = useState({
    name_en: destination?.name_en || '',
    name_ar: destination?.name_ar || '',
    country_code: destination?.country_code || '',
    slug: destination?.slug || '',
    timezone: destination?.timezone || '',
    currency_code: destination?.currency_code || '',
    is_active: destination?.is_active ?? false,
    display_order: destination?.display_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await destinationService.update(destination!.id, {
          name_en: form.name_en,
          name_ar: form.name_ar,
          slug: form.slug,
          timezone: form.timezone || undefined,
          currency_code: form.currency_code || undefined,
          is_active: form.is_active,
          display_order: form.display_order,
        });
      } else {
        await destinationService.create({
          type: 'country',
          country_code: form.country_code.toUpperCase(),
          slug: form.slug || slugify(form.name_en),
          name_en: form.name_en,
          name_ar: form.name_ar,
          timezone: form.timezone || undefined,
          currency_code: form.currency_code || undefined,
          is_active: form.is_active,
          display_order: form.display_order,
        });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const iCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition";
  const lCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5";

  return (
    <ModalWrapper title={isEdit ? t('destinations.editCountryTitle') : t('destinations.addCountryTitle')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lCls}>{t('destinations.nameEn')} *</label>
            <input required value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value, slug: isEdit ? f.slug : slugify(e.target.value) }))} className={iCls} />
          </div>
          <div>
            <label className={lCls}>{t('destinations.nameAr')} *</label>
            <input required dir="rtl" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} className={iCls} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {!isEdit && (
            <div>
              <label className={lCls}>{t('destinations.countryCode')} *</label>
              <input required maxLength={2} value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value.toUpperCase() }))} placeholder="SA" className={iCls + ' uppercase'} />
            </div>
          )}
          <div>
            <label className={lCls}>Slug</label>
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className={iCls} />
          </div>
          <div>
            <label className={lCls}>Timezone</label>
            <input value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} placeholder="Asia/Riyadh" className={iCls} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={lCls}>Currency</label>
            <input maxLength={3} value={form.currency_code} onChange={e => setForm(f => ({ ...f, currency_code: e.target.value.toUpperCase() }))} placeholder="SAR" className={iCls + ' uppercase'} />
          </div>
          <div>
            <label className={lCls}>Order</label>
            <input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} className={iCls} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-sky-500" />
              Active
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{t('destinations.cancel')}</button>
          <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? t('action.update') : t('action.create')}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// ===== City Modal =====
function CityModal({ country, city, onClose, onSaved }: { country: Destination; city: Destination | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!city;
  const [form, setForm] = useState({
    name_en: city?.name_en || '',
    name_ar: city?.name_ar || '',
    slug: city?.slug || '',
    timezone: city?.timezone || country.timezone || '',
    currency_code: city?.currency_code || country.currency_code || '',
    is_active: city?.is_active ?? false,
    display_order: city?.display_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await destinationService.update(city!.id, {
          name_en: form.name_en,
          name_ar: form.name_ar,
          slug: form.slug,
          timezone: form.timezone || undefined,
          currency_code: form.currency_code || undefined,
          is_active: form.is_active,
          display_order: form.display_order,
        });
      } else {
        await destinationService.create({
          type: 'city',
          parent_id: country.id,
          country_code: country.country_code,
          slug: form.slug || slugify(form.name_en),
          name_en: form.name_en,
          name_ar: form.name_ar,
          timezone: form.timezone || undefined,
          currency_code: form.currency_code || undefined,
          is_active: form.is_active,
          display_order: form.display_order,
        });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const iCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition";
  const lCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5";

  return (
    <ModalWrapper title={isEdit ? `${t('destinations.editCityTitle')} — ${country.name_en}` : `${t('destinations.addCityTitle')} — ${country.name_en}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lCls}>{t('destinations.nameEn')} *</label>
            <input required value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value, slug: isEdit ? f.slug : slugify(e.target.value) }))} className={iCls} />
          </div>
          <div>
            <label className={lCls}>{t('destinations.nameAr')} *</label>
            <input required dir="rtl" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} className={iCls} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={lCls}>Slug</label>
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className={iCls} />
          </div>
          <div>
            <label className={lCls}>Timezone</label>
            <input value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} className={iCls} />
          </div>
          <div>
            <label className={lCls}>Currency</label>
            <input maxLength={3} value={form.currency_code} onChange={e => setForm(f => ({ ...f, currency_code: e.target.value.toUpperCase() }))} className={iCls + ' uppercase'} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lCls}>Order</label>
            <input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} className={iCls} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-sky-500" />
              Active
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{t('destinations.cancel')}</button>
          <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? t('action.update') : t('action.create')}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// ===== Place Modal =====
function PlaceModal({ city, place, onClose, onSaved }: { city: Destination; place: Place | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!place;
  const [form, setForm] = useState({
    name_en: place?.name_en || '',
    name_ar: place?.name_ar || '',
    slug: place?.slug || '',
    type: place?.type || 'attraction',
    latitude: place?.latitude?.toString() || '',
    longitude: place?.longitude?.toString() || '',
    is_active: place?.is_active ?? true,
    display_order: place?.display_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name_en: form.name_en,
        name_ar: form.name_ar,
        slug: form.slug || slugify(form.name_en),
        type: form.type,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        is_active: form.is_active,
        display_order: form.display_order,
      };

      if (isEdit) {
        await destinationService.updatePlace(place!.id, payload);
      } else {
        await destinationService.createPlace(city.id, payload);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const iCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition";
  const lCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5";

  return (
    <ModalWrapper title={isEdit ? `${t('destinations.editPlaceTitle')} — ${city.name_en}` : `${t('destinations.addPlaceTitle')} — ${city.name_en}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lCls}>{t('destinations.nameEn')} *</label>
            <input required value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value, slug: isEdit ? f.slug : slugify(e.target.value) }))} className={iCls} />
          </div>
          <div>
            <label className={lCls}>{t('destinations.nameAr')} *</label>
            <input required dir="rtl" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} className={iCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lCls}>{t('destinations.type')} *</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={iCls}>
              {PLACE_TYPES.map(pt => <option key={pt} value={pt}>{pt.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={lCls}>Slug</label>
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className={iCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lCls}>Latitude</label>
            <input type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="24.7341" className={iCls} />
          </div>
          <div>
            <label className={lCls}>Longitude</label>
            <input type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="46.5729" className={iCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lCls}>Order</label>
            <input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} className={iCls} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-sky-500" />
              Active
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{t('destinations.cancel')}</button>
          <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? t('action.update') : t('action.create')}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// ===== Modal Wrapper =====
function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xl leading-none">&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
