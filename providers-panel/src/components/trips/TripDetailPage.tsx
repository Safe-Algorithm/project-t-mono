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
                    <p style={{ margin: '0', fontWeight: 'bold' }}>Price: {pkg.price} {pkg.currency || 'SAR'}</p>
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
                  <div style={{ marginBottom: '0.5rem' }}>
                    <h5>Required Fields for Registration</h5>
                  </div>

                    {pkg.required_fields?.length > 0 ? (
                      <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {pkg.required_fields.map((field: string) => {
                          // Find validation config for this field
                          const fieldDetail = pkg.required_fields_details?.find(
                            (detail: any) => detail.field_type === field
                          );
                          const hasValidations = fieldDetail?.validation_config && 
                            Object.keys(fieldDetail.validation_config).length > 0;
                          
                          return (
                            <div key={field} style={{ 
                              border: '1px solid #e0e0e0',
                              borderRadius: '6px',
                              padding: '0.75rem',
                              backgroundColor: '#fafafa'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <span style={{ 
                                  fontWeight: 'bold',
                                  color: '#333'
                                }}>
                                  {getFieldDisplayName(field)}
                                </span>
                                {hasValidations && (
                                  <span style={{
                                    fontSize: '0.75rem',
                                    padding: '0.2rem 0.4rem',
                                    backgroundColor: '#e8f5e8',
                                    color: '#2e7d32',
                                    borderRadius: '3px',
                                    fontWeight: 'bold'
                                  }}>
                                    VALIDATED
                                  </span>
                                )}
                              </div>
                              
                              {hasValidations && (
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                  <strong>Validation Rules:</strong>
                                  <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                                    {Object.entries(fieldDetail.validation_config || {}).map(([validationType, config]: [string, any]) => (
                                      <li key={validationType} style={{ marginBottom: '0.25rem' }}>
                                        <strong>{validationType.replace('_', ' ')}:</strong> {
                                          typeof config === 'object' && config !== null 
                                            ? Object.entries(config).map(([key, value]) => `${key}: ${value}`).join(', ')
                                            : String(config)
                                        }
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {!hasValidations && (
                                <div style={{ fontSize: '0.8rem', color: '#999', fontStyle: 'italic' }}>
                                  No validation rules configured
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ color: '#666', fontStyle: 'italic' }}>No required fields set</p>
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

export default TripDetailPage;
