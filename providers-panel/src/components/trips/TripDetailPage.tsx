import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Trip, TripPackage, FieldMetadata, PackageRequiredField } from '../../types/trip';
import { tripService } from '../../services/tripService';

const TripDetailPage: React.FC = () => {
  const router = useRouter();
  const { id: tripId } = router.query;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [availableFields, setAvailableFields] = useState<FieldMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  useEffect(() => {
    if (router.isReady && tripId && typeof tripId === 'string') {
      loadTripDetails();
      loadAvailableFields();
    }
  }, [tripId, router.isReady]);

  const loadTripDetails = async () => {
    if (!tripId || typeof tripId !== 'string') return;
    
    try {
      setLoading(true);
      const tripData = await tripService.getById(tripId);
      setTrip(tripData);
    } catch (err) {
      setError('Failed to load trip details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableFields = async () => {
    try {
      const response = await tripService.getAvailableFields();
      setAvailableFields(response.fields || []);
    } catch (err) {
      console.error('Failed to load available fields:', err);
      setAvailableFields([]);
    }
  };

  const handleSetPackageFields = async (packageId: string, selectedFields: string[]) => {
    if (!tripId || typeof tripId !== 'string') return;
    
    try {
      const fields: PackageRequiredField[] = selectedFields.map(field => ({ field_type: field }));
      await tripService.setPackageRequiredFields(tripId, packageId, fields);
      
      // Reload trip data to get updated required fields
      await loadTripDetails();
      
      setSelectedPackageId(null);
    } catch (err) {
      setError('Failed to update package required fields');
      console.error(err);
    }
  };

  const getFieldDisplayName = (fieldType: string): string => {
    const field = availableFields.find(f => f.field_name === fieldType);
    return field ? field.display_name : fieldType;
  };

  if (loading) return <div>Loading trip details...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!trip) return <div>Trip not found</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>{trip.name}</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => router.push(`/trips/${tripId}/edit`)} 
            style={{ padding: '0.5rem 1rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Edit Trip
          </button>
          <button onClick={() => router.push('/trips')} style={{ padding: '0.5rem 1rem' }}>
            Back to Trips
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <div>
          <h3>Trip Information</h3>
          <p><strong>Description:</strong> {trip.description}</p>
          <p><strong>Start Date:</strong> {new Date(trip.start_date).toLocaleString()}</p>
          <p><strong>End Date:</strong> {new Date(trip.end_date).toLocaleString()}</p>
          <p><strong>Base Price:</strong> ${trip.price}</p>
          <p><strong>Max Participants:</strong> {trip.max_participants}</p>
          <p><strong>Status:</strong> {trip.is_active ? 'Active' : 'Inactive'}</p>
        </div>
      </div>

      <div>
        <h3>Trip Packages ({trip.packages.length})</h3>
        {trip.packages.length === 0 ? (
          <div style={{ color: 'orange', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
            <strong>Warning:</strong> This trip has no packages. At least one package is required.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {trip.packages.map((pkg) => (
              <div key={pkg.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>{pkg.name}</h4>
                    <p style={{ margin: '0 0 0.5rem 0', color: '#666' }}>{pkg.description}</p>
                    <p style={{ margin: '0', fontWeight: 'bold' }}>Price: ${pkg.price}</p>
                  </div>
                  <div>
                    <span style={{ 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px', 
                      backgroundColor: pkg.is_active ? '#d4edda' : '#f8d7da',
                      color: pkg.is_active ? '#155724' : '#721c24'
                    }}>
                      {pkg.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h5>Required Fields for Registration</h5>
                    <button 
                      onClick={() => setSelectedPackageId(selectedPackageId === pkg.id ? null : pkg.id)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                    >
                      {selectedPackageId === pkg.id ? 'Cancel' : 'Edit Fields'}
                    </button>
                  </div>

                  {selectedPackageId === pkg.id ? (
                    <PackageFieldsEditor
                      packageId={pkg.id}
                      currentFields={pkg.required_fields || []}
                      availableFields={availableFields}
                      onSave={(fields) => handleSetPackageFields(pkg.id, fields)}
                      onCancel={() => setSelectedPackageId(null)}
                    />
                  ) : (
                    <div>
                      {pkg.required_fields?.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {pkg.required_fields.map((field: string) => (
                            <span 
                              key={field}
                              style={{ 
                                padding: '0.25rem 0.5rem', 
                                backgroundColor: '#e3f2fd', 
                                borderRadius: '4px',
                                fontSize: '0.9rem'
                              }}
                            >
                              {getFieldDisplayName(field)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: '#666', fontStyle: 'italic' }}>No required fields set</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface PackageFieldsEditorProps {
  packageId: string;
  currentFields: string[];
  availableFields: FieldMetadata[];
  onSave: (fields: string[]) => void;
  onCancel: () => void;
}

const PackageFieldsEditor: React.FC<PackageFieldsEditorProps> = ({
  currentFields,
  availableFields,
  onSave,
  onCancel
}) => {
  const [selectedFields, setSelectedFields] = useState<string[]>(currentFields);

  const handleFieldToggle = (fieldType: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldType) 
        ? prev.filter(f => f !== fieldType)
        : [...prev, fieldType]
    );
  };

  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
      <h6>Select Required Fields:</h6>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        {availableFields.map((field) => (
          <label key={field.field_name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={selectedFields.includes(field.field_name)}
              onChange={() => handleFieldToggle(field.field_name)}
            />
            <span>{field.display_name}</span>
            <small style={{ color: '#666' }}>({field.ui_type})</small>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button 
          onClick={() => onSave(selectedFields)}
          style={{ backgroundColor: '#007bff', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}
        >
          Save Fields
        </button>
        <button 
          onClick={onCancel}
          style={{ backgroundColor: '#6c757d', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default TripDetailPage;
