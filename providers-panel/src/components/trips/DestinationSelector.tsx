import React, { useState, useEffect } from 'react';
import { destinationService, Destination, Place, TripDestination } from '../../services/destinationService';
import { useTranslation } from 'react-i18next';

// A local selection entry (used in form-state mode before trip is created)
export interface DestinationSelection {
  destination_id: string;
  place_id?: string;
  // Display info stored for UI rendering
  _destinationName: string;
  _placeName?: string;
}

interface DestinationSelectorProps {
  // If tripId is provided, operates in API mode (add/remove via API)
  tripId?: string;
  // For form-state mode: controlled selections and callback
  selections?: DestinationSelection[];
  onSelectionsChange?: (selections: DestinationSelection[]) => void;
  // Existing trip destinations (for edit mode, loaded by parent)
  existingTripDestinations?: TripDestination[];
  onChanged?: () => void;
}

const DestinationSelector: React.FC<DestinationSelectorProps> = ({
  tripId,
  selections = [],
  onSelectionsChange,
  existingTripDestinations,
  onChanged,
}) => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [tripDestinations, setTripDestinations] = useState<TripDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection state for the picker dropdowns
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>('');
  const [cityPlaces, setCityPlaces] = useState<Place[]>([]);

  const isApiMode = !!tripId;

  const getName = (item: { name_en: string; name_ar: string }) => {
    return isArabic ? (item.name_ar || item.name_en) : (item.name_en || item.name_ar);
  };

  useEffect(() => {
    loadData();
  }, [tripId]);

  useEffect(() => {
    if (existingTripDestinations) {
      setTripDestinations(existingTripDestinations);
    }
  }, [existingTripDestinations]);

  const loadData = async () => {
    try {
      setLoading(true);
      const dests = await destinationService.getActiveDestinations();
      setDestinations(dests);

      if (isApiMode) {
        const tripDests = await destinationService.getTripDestinations(tripId!);
        setTripDestinations(tripDests);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load destinations');
    } finally {
      setLoading(false);
    }
  };

  const selectedCountry = destinations.find(d => d.id === selectedCountryId);
  const cities = selectedCountry?.children || [];

  useEffect(() => {
    setSelectedCityId('');
    setSelectedPlaceId('');
    setCityPlaces([]);
  }, [selectedCountryId]);

  useEffect(() => {
    setSelectedPlaceId('');
    if (selectedCityId) {
      destinationService.getPlaces(selectedCityId).then(setCityPlaces).catch(() => setCityPlaces([]));
    } else {
      setCityPlaces([]);
    }
  }, [selectedCityId]);

  // Find display name for a destination ID from the loaded tree
  const findDestName = (destId: string): string => {
    for (const country of destinations) {
      if (country.id === destId) return getName(country);
      for (const city of (country.children || [])) {
        if (city.id === destId) return `${getName(country)} > ${getName(city)}`;
      }
    }
    return destId;
  };

  const findPlaceName = (placeId: string, places: Place[]): string => {
    const p = places.find(pl => pl.id === placeId);
    return p ? getName(p) : placeId;
  };

  const handleAdd = async () => {
    const destId = selectedCityId || selectedCountryId;
    if (!destId) return;

    if (isApiMode) {
      // API mode: add via API
      setAdding(true);
      setError(null);
      try {
        await destinationService.addTripDestination(tripId!, destId, selectedPlaceId || undefined);
        const tripDests = await destinationService.getTripDestinations(tripId!);
        setTripDestinations(tripDests);
        setSelectedCountryId('');
        setSelectedCityId('');
        setSelectedPlaceId('');
        onChanged?.();
      } catch (err: any) {
        setError(err.message || 'Failed to add destination');
      } finally {
        setAdding(false);
      }
    } else {
      // Form-state mode: add to local selections
      const destName = findDestName(destId);
      const placeName = selectedPlaceId ? findPlaceName(selectedPlaceId, cityPlaces) : undefined;

      // Check for duplicates
      const isDuplicate = selections.some(
        s => s.destination_id === destId && (s.place_id || '') === (selectedPlaceId || '')
      );
      if (isDuplicate) {
        setError('This destination is already added.');
        return;
      }

      const newSelection: DestinationSelection = {
        destination_id: destId,
        place_id: selectedPlaceId || undefined,
        _destinationName: destName,
        _placeName: placeName,
      };
      onSelectionsChange?.([...selections, newSelection]);
      setSelectedCountryId('');
      setSelectedCityId('');
      setSelectedPlaceId('');
      setError(null);
    }
  };

  const handleRemove = async (index: number) => {
    if (isApiMode) {
      const td = tripDestinations[index];
      try {
        await destinationService.removeTripDestination(tripId!, td.id);
        setTripDestinations(prev => prev.filter((_, i) => i !== index));
        onChanged?.();
      } catch (err: any) {
        setError(err.message || 'Failed to remove destination');
      }
    } else {
      // Form-state mode
      onSelectionsChange?.(selections.filter((_, i) => i !== index));
    }
  };

  // Build the display list
  const displayItems: { key: string; name: string; placeName?: string }[] = [];

  if (isApiMode) {
    tripDestinations.forEach((td, i) => {
      displayItems.push({
        key: td.id || String(i),
        name: td.destination ? getName(td.destination) : 'Unknown',
        placeName: td.place ? getName(td.place) : undefined,
      });
    });
  } else {
    selections.forEach((s, i) => {
      displayItems.push({
        key: String(i),
        name: s._destinationName,
        placeName: s._placeName,
      });
    });
  }

  const selectCls = "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition";
  const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1";

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-slate-400 dark:text-slate-500">
        <div className="w-4 h-4 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
        Loading destinations…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold text-red-500 hover:text-red-700 dark:hover:text-red-300 leading-none">&times;</button>
        </div>
      )}

      {/* Added destinations list */}
      {displayItems.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {displayItems.map((item, index) => (
            <div key={item.key} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-700 rounded-xl text-sm">
              <span className="font-semibold text-sky-700 dark:text-sky-300">{item.name}</span>
              {item.placeName && (
                <>
                  <svg className="w-3 h-3 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  <span className="text-sky-600 dark:text-sky-400">{item.placeName}</span>
                </>
              )}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="ml-1 w-5 h-5 flex items-center justify-center rounded-full text-sky-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-base leading-none"
                title="Remove"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
          No destinations added yet. Please add at least one destination.
        </p>
      )}

      {/* Add destination picker */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Add Destination</p>

        <div>
          <label className={labelCls}>Country</label>
          <select value={selectedCountryId} onChange={e => setSelectedCountryId(e.target.value)} className={selectCls}>
            <option value="">— Select Country —</option>
            {destinations.map(country => (
              <option key={country.id} value={country.id}>
                {country.country_code} - {getName(country)}
              </option>
            ))}
          </select>
        </div>

        {selectedCountryId && cities.length > 0 && (
          <div>
            <label className={labelCls}>City <span className="normal-case font-normal text-slate-400">(optional)</span></label>
            <select value={selectedCityId} onChange={e => setSelectedCityId(e.target.value)} className={selectCls}>
              <option value="">— Select City —</option>
              {cities.map(city => (
                <option key={city.id} value={city.id}>{getName(city)}</option>
              ))}
            </select>
          </div>
        )}

        {selectedCityId && cityPlaces.length > 0 && (
          <div>
            <label className={labelCls}>Place <span className="normal-case font-normal text-slate-400">(optional)</span></label>
            <select value={selectedPlaceId} onChange={e => setSelectedPlaceId(e.target.value)} className={selectCls}>
              <option value="">— Select Place —</option>
              {cityPlaces.map(place => (
                <option key={place.id} value={place.id}>
                  {getName(place)} ({place.type.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !selectedCountryId}
          className={`w-full py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${
            selectedCountryId && !adding
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
          }`}
        >
          {adding ? 'Adding…' : '+ Add Destination'}
        </button>
      </div>
    </div>
  );
};

export default DestinationSelector;
