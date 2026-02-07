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

  if (loading) {
    return (
      <div style={{ padding: '0.5rem', color: '#888', fontSize: '0.9rem' }}>
        Loading destinations...
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Trip Destinations *</h3>

      {error && (
        <div style={{ padding: '0.5rem', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '0.5rem', fontWeight: 'bold', border: 'none', background: 'none', cursor: 'pointer', color: '#c62828' }}>&times;</button>
        </div>
      )}

      {/* Current destinations */}
      {displayItems.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          {displayItems.map((item, index) => (
            <div key={item.key} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.75rem', marginBottom: '0.25rem',
              backgroundColor: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '4px',
            }}>
              <span style={{ fontWeight: 500, fontSize: '0.9rem', color: '#1565c0' }}>
                {item.name}
              </span>
              {item.placeName && (
                <span style={{ fontSize: '0.8rem', color: '#666' }}>
                  &rarr; {item.placeName}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                style={{
                  marginLeft: 'auto', color: '#c62828', fontWeight: 'bold',
                  border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem',
                }}
                title="Remove"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {displayItems.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: '#e65100', marginBottom: '0.75rem' }}>
          No destinations added yet. Please add at least one destination.
        </p>
      )}

      {/* Add destination form */}
      <div style={{ padding: '0.75rem', backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: '4px' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Add Destination</p>

        {/* Country */}
        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>Country</label>
          <select
            value={selectedCountryId}
            onChange={e => setSelectedCountryId(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem' }}
          >
            <option value="">-- Select Country --</option>
            {destinations.map(country => (
              <option key={country.id} value={country.id}>
                {country.country_code} - {getName(country)}
              </option>
            ))}
          </select>
        </div>

        {/* City */}
        {selectedCountryId && cities.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>City (optional)</label>
            <select
              value={selectedCityId}
              onChange={e => setSelectedCityId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem' }}
            >
              <option value="">-- Select City --</option>
              {cities.map(city => (
                <option key={city.id} value={city.id}>
                  {getName(city)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Place */}
        {selectedCityId && cityPlaces.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>Place (optional)</label>
            <select
              value={selectedPlaceId}
              onChange={e => setSelectedPlaceId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem' }}
            >
              <option value="">-- Select Place --</option>
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
          style={{
            width: '100%', padding: '0.5rem', marginTop: '0.25rem',
            backgroundColor: selectedCountryId ? '#28a745' : '#ccc',
            color: 'white', border: 'none', borderRadius: '4px',
            cursor: selectedCountryId ? 'pointer' : 'not-allowed',
            fontSize: '0.9rem', fontWeight: 500,
          }}
        >
          {adding ? 'Adding...' : '+ Add Destination'}
        </button>
      </div>
    </div>
  );
};

export default DestinationSelector;
