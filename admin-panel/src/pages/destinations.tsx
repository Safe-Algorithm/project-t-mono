import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { destinationService, Destination, Place, CreateDestination, CreatePlace, UpdateDestination, UpdatePlace } from '@/services/destinationService';

const PLACE_TYPES = ['area', 'district', 'attraction', 'resort', 'theme_park', 'landmark', 'experience'];

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export default function DestinationsPage() {
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-lg text-gray-500">Loading destinations...</div></div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Destinations Management</h1>
        <button
          onClick={() => { setEditingDestination(null); setShowCountryModal(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Country
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search countries, cities..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
        />
      </div>

      {/* Stats */}
      <div className="mb-4 flex gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span>{destinations.length} countries</span>
        <span>{destinations.reduce((sum, c) => sum + (c.children?.length || 0), 0)} cities</span>
        <span>{destinations.filter(c => c.is_active).length} active countries</span>
      </div>

      {/* Tree View */}
      <div className="space-y-1">
        {filteredDestinations.map(country => (
          <div key={country.id} className="border dark:border-gray-700 rounded-lg overflow-hidden">
            {/* Country Row */}
            <div className={`flex items-center gap-2 px-4 py-3 ${country.is_active ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50 opacity-70'}`}>
              <button onClick={() => toggleCountry(country.id)} className="text-gray-400 hover:text-gray-600 w-6">
                {expandedCountries.has(country.id) ? '▼' : '▶'}
              </button>
              <span className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">{country.country_code}</span>
              <span className="font-medium">{country.name_en}</span>
              <span className="text-gray-500 dark:text-gray-400 text-sm" dir="rtl">{country.name_ar}</span>
              <span className="text-xs text-gray-400 ml-auto">
                {country.children?.length || 0} cities
              </span>
              <button
                onClick={() => handleActivate(country.id, !country.is_active)}
                className={`px-2 py-0.5 text-xs rounded ${country.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}
              >
                {country.is_active ? 'Active' : 'Inactive'}
              </button>
              <button
                onClick={() => { setSelectedCountry(country); setEditingDestination(null); setShowCityModal(true); }}
                className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-200"
              >
                + City
              </button>
              <button
                onClick={() => { setEditingDestination(country); setShowCountryModal(true); }}
                className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded hover:bg-yellow-200"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteDestination(country.id, country.name_en)}
                className="px-2 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200"
              >
                Delete
              </button>
            </div>

            {/* Cities */}
            {expandedCountries.has(country.id) && country.children && country.children.length > 0 && (
              <div className="border-t dark:border-gray-700">
                {country.children.map(city => (
                  <div key={city.id}>
                    <div className={`flex items-center gap-2 px-4 py-2 pl-12 ${city.is_active ? 'bg-gray-50 dark:bg-gray-800/80' : 'bg-gray-100 dark:bg-gray-900/50 opacity-70'}`}>
                      <button onClick={() => toggleCity(city.id)} className="text-gray-400 hover:text-gray-600 w-6">
                        {expandedCities.has(city.id) ? '▼' : '▶'}
                      </button>
                      <span className="text-blue-600 dark:text-blue-400">↳</span>
                      <span className="font-medium text-sm">{city.name_en}</span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs" dir="rtl">{city.name_ar}</span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {city.places?.length || 0} places
                      </span>
                      <button
                        onClick={() => handleActivate(city.id, !city.is_active)}
                        className={`px-2 py-0.5 text-xs rounded ${city.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}
                      >
                        {city.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => { setSelectedCity(city); setEditingPlace(null); setShowPlaceModal(true); }}
                        className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded hover:bg-purple-200"
                      >
                        + Place
                      </button>
                      <button
                        onClick={() => { setEditingDestination(city); setSelectedCountry(country); setShowCityModal(true); }}
                        className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded hover:bg-yellow-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteDestination(city.id, city.name_en)}
                        className="px-2 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>

                    {/* Places */}
                    {expandedCities.has(city.id) && city.places && city.places.length > 0 && (
                      <div className="border-t dark:border-gray-700/50">
                        {city.places.map(place => (
                          <div key={place.id} className="flex items-center gap-2 px-4 py-1.5 pl-20 bg-gray-100 dark:bg-gray-900/30 text-sm">
                            <span className="text-purple-500">📍</span>
                            <span>{place.name_en}</span>
                            <span className="text-gray-400 text-xs" dir="rtl">{place.name_ar}</span>
                            <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">{place.type}</span>
                            <span className="ml-auto" />
                            <button
                              onClick={() => { setEditingPlace(place); setSelectedCity(city); setShowPlaceModal(true); }}
                              className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded hover:bg-yellow-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeletePlace(place.id, place.name_en)}
                              className="px-2 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200"
                            >
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
        <div className="text-center py-12 text-gray-500">
          {searchQuery ? 'No destinations match your search.' : 'No destinations found. Add a country to get started.'}
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

  return (
    <ModalWrapper title={isEdit ? 'Edit Country' : 'Add Country'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-2 bg-red-100 text-red-700 rounded text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name (English) *</label>
            <input required value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value, slug: isEdit ? f.slug : slugify(e.target.value) }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name (Arabic) *</label>
            <input required dir="rtl" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium mb-1">Country Code *</label>
              <input required maxLength={2} value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value.toUpperCase() }))} placeholder="SA" className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 uppercase" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Slug</label>
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Timezone</label>
            <input value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} placeholder="Asia/Riyadh" className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Currency Code</label>
            <input maxLength={3} value={form.currency_code} onChange={e => setForm(f => ({ ...f, currency_code: e.target.value.toUpperCase() }))} placeholder="SAR" className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 uppercase" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Display Order</label>
            <input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4" />
              <span className="text-sm">Active</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// ===== City Modal =====
function CityModal({ country, city, onClose, onSaved }: { country: Destination; city: Destination | null; onClose: () => void; onSaved: () => void }) {
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

  return (
    <ModalWrapper title={isEdit ? `Edit City in ${country.name_en}` : `Add City to ${country.name_en}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-2 bg-red-100 text-red-700 rounded text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">City Name (English) *</label>
            <input required value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value, slug: isEdit ? f.slug : slugify(e.target.value) }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">City Name (Arabic) *</label>
            <input required dir="rtl" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Slug</label>
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Timezone</label>
            <input value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <input maxLength={3} value={form.currency_code} onChange={e => setForm(f => ({ ...f, currency_code: e.target.value.toUpperCase() }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 uppercase" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Display Order</label>
            <input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4" />
              <span className="text-sm">Active</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// ===== Place Modal =====
function PlaceModal({ city, place, onClose, onSaved }: { city: Destination; place: Place | null; onClose: () => void; onSaved: () => void }) {
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

  return (
    <ModalWrapper title={isEdit ? `Edit Place in ${city.name_en}` : `Add Place to ${city.name_en}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-2 bg-red-100 text-red-700 rounded text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Place Name (English) *</label>
            <input required value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value, slug: isEdit ? f.slug : slugify(e.target.value) }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Place Name (Arabic) *</label>
            <input required dir="rtl" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Type *</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600">
              {PLACE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug</label>
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Latitude</label>
            <input type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="24.7341" className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Longitude</label>
            <input type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="46.5729" className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Display Order</label>
            <input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4" />
              <span className="text-sm">Active</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// ===== Modal Wrapper =====
function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
