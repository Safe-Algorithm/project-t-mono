import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Trip, TripPackage, FieldMetadata, PackageRequiredField, TripAmenity } from '../../types/trip';
import { tripService } from '../../services/tripService';
import { destinationService, TripDestination } from '../../services/destinationService';
import { useTranslation } from 'react-i18next';

const TripDetailPage: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { id: tripId } = router.query;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [availableFields, setAvailableFields] = useState<FieldMetadata[]>([]);
  const [tripDestinations, setTripDestinations] = useState<TripDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (router.isReady && tripId && typeof tripId === 'string') {
      loadTripDetails();
      loadAvailableFields();
      loadTripDestinations();
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

  const loadTripDestinations = async () => {
    if (!tripId || typeof tripId !== 'string') return;
    try {
      const dests = await destinationService.getTripDestinations(tripId);
      setTripDestinations(dests);
    } catch (err) {
      console.error('Failed to load trip destinations:', err);
    }
  };

  const getFieldDisplayName = (fieldType: string): string => {
    const field = availableFields.find(f => f.field_name === fieldType);
    return field ? field.display_name : fieldType;
  };

  const amenityLabels: Record<string, string> = {
    [TripAmenity.FLIGHT_TICKETS]: 'Flight Tickets',
    [TripAmenity.BUS]: 'Bus Transportation',
    [TripAmenity.TOUR_GUIDE]: 'Tour Guide',
    [TripAmenity.TOURS]: 'Tours',
    [TripAmenity.HOTEL]: 'Hotel Accommodation',
    [TripAmenity.MEALS]: 'Meals',
    [TripAmenity.INSURANCE]: 'Travel Insurance',
    [TripAmenity.VISA_ASSISTANCE]: 'Visa Assistance',
  };

  if (loading) return <div>{t('status.loading')}</div>;
  if (error) return <div style={{ color: 'red' }}>{t('status.error')}: {error}</div>;
  if (!trip) return <div>{t('status.notFound')}</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>{trip.name_en}</h1>
          <h2 style={{ color: '#666', fontSize: '1.5rem', marginTop: '0.5rem' }} dir="rtl">{trip.name_ar}</h2>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => router.push(`/trips/${tripId}/edit`)} 
            style={{ padding: '0.5rem 1rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            {t('action.editTrip')}
          </button>
          <button onClick={() => router.push('/trips')} style={{ padding: '0.5rem 1rem' }}>
            {t('action.backToTrips')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <div>
          <h3>{t('trip.information')}</h3>
          <div style={{ marginBottom: '1rem' }}>
            <p><strong>Description (English):</strong></p>
            <p>{trip.description_en}</p>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <p><strong>Description (Arabic):</strong></p>
            <p dir="rtl">{trip.description_ar}</p>
          </div>
          <p><strong>Start Date:</strong> {new Date(trip.start_date).toLocaleString()}</p>
          <p><strong>End Date:</strong> {new Date(trip.end_date).toLocaleString()}</p>
          <p><strong>Max Participants:</strong> {trip.max_participants}</p>
          <p><strong>{t('trip.status')}:</strong> {trip.is_active ? t('status.active') : t('status.inactive')}</p>
          <p>
            <strong>Refundable:</strong>{' '}
            <span style={{ 
              color: trip.is_refundable ? '#28a745' : '#dc3545',
              fontWeight: 'bold'
            }}>
              {trip.is_refundable ? 'Yes' : 'No'}
            </span>
          </p>
        </div>
      </div>

      {/* Trip Destinations */}
      {tripDestinations.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>Destinations</h3>
          <div style={{ 
            display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
            padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6'
          }}>
            {tripDestinations.map((td) => (
              <div key={td.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.75rem', backgroundColor: '#e3f2fd',
                borderRadius: '6px', border: '1px solid #90caf9',
              }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#1565c0' }}>
                  {td.destination ? td.destination.name_en : 'Unknown'}
                </span>
                {td.destination?.name_ar && (
                  <span style={{ fontSize: '0.8rem', color: '#666' }} dir="rtl">({td.destination.name_ar})</span>
                )}
                {td.place && (
                  <>
                    <span style={{ color: '#999' }}>&rarr;</span>
                    <span style={{ fontSize: '0.85rem', color: '#333' }}>{td.place.name_en}</span>
                    {td.place.name_ar && (
                      <span style={{ fontSize: '0.8rem', color: '#666' }} dir="rtl">({td.place.name_ar})</span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trip Amenities */}
      {trip.amenities && trip.amenities.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>{t('trip.amenities')}</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
            gap: '0.75rem',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            {trip.amenities.map((amenity) => (
              <div 
                key={amenity}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: '#e3f2fd',
                  borderRadius: '4px',
                  border: '1px solid #90caf9'
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>✓</span>
                <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                  {amenityLabels[amenity] || amenity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meeting Place Information */}
      {trip.has_meeting_place && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>{t('trip.meetingPlace')}</h3>
          <div style={{ 
            padding: '1rem',
            backgroundColor: '#fff3cd',
            borderRadius: '8px',
            border: '1px solid #ffc107'
          }}>
            {trip.meeting_location && (
              <p style={{ margin: '0 0 0.5rem 0' }}>
                <strong>📍 Location:</strong> {trip.meeting_location}
              </p>
            )}
            {trip.meeting_time && (
              <p style={{ margin: '0' }}>
                <strong>🕐 Time:</strong> {new Date(trip.meeting_time).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Trip Images */}
      {trip.images && trip.images.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>{t('trip.images')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {trip.images.map((imageUrl, index) => (
              <div key={index} style={{ position: 'relative', cursor: 'pointer' }}>
                <img
                  src={imageUrl}
                  alt={`${trip.name_en} - Image ${index + 1}`}
                  style={{ 
                    width: '100%', 
                    height: '200px', 
                    objectFit: 'cover', 
                    borderRadius: '8px',
                    border: '2px solid #ddd'
                  }}
                  onClick={() => window.open(imageUrl, '_blank')}
                />
              </div>
            ))}
          </div>
        </div>
      )}

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
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>{pkg.name_en}</h4>
                    <p style={{ margin: '0 0 0.5rem 0', color: '#999', fontSize: '0.9rem' }} dir="rtl">{pkg.name_ar}</p>
                    <p style={{ margin: '0 0 0.5rem 0', color: '#666' }}>{pkg.description_en}</p>
                    <p style={{ margin: '0 0 0.5rem 0', color: '#999', fontSize: '0.9rem' }} dir="rtl">{pkg.description_ar}</p>
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
