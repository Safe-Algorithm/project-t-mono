import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import ValidationDisplay from '@/components/ValidationDisplay';

interface TripPackageRequiredFieldDetail {
  id: string;
  package_id: string;
  field_type: string;
  is_required: boolean;
  validation_config: any;
}

interface TripPackage {
  id: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  price: number;
  currency: string;
  is_active: boolean;
  required_fields: string[];
  required_fields_details?: TripPackageRequiredFieldDetail[];
}

interface TripUpdateInfo {
  id: string;
  trip_id: string;
  provider_id: string;
  registration_id: string | null;
  title: string;
  message: string;
  attachments: any[] | null;
  is_important: boolean;
  created_at: string;
  total_recipients: number;
  read_count: number;
}

interface TripDestinationInfo {
  id: string;
  destination_id: string;
  place_id: string | null;
  destination: {
    id: string;
    name_en: string;
    name_ar: string;
    country_code: string;
    type: string;
  } | null;
  place: {
    id: string;
    name_en: string;
    name_ar: string;
    type: string;
  } | null;
}

interface Provider {
  id: string;
  company_name: string;
}

interface Trip {
  id: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  start_date: string;
  end_date: string;
  max_participants: number;
  is_active: boolean;
  provider_id: string;
  provider: Provider;
  images?: string[];
  trip_metadata?: any;
  packages: TripPackage[];
  is_refundable?: boolean;
  amenities?: string[];
  has_meeting_place?: boolean;
  meeting_location?: string;
  meeting_time?: string;
}

interface FieldMetadata {
  [key: string]: {
    display_name: string;
    ui_type: string;
    placeholder?: string;
    options?: string[];
    required: boolean;
  };
}

const TripDetailPage = () => {
  const { t } = useTranslation();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [fieldMetadata, setFieldMetadata] = useState<FieldMetadata>({});
  const [tripDestinations, setTripDestinations] = useState<TripDestinationInfo[]>([]);
  const [tripUpdates, setTripUpdates] = useState<TripUpdateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const router = useRouter();
  const { id } = router.query;

  const amenityLabels: Record<string, string> = {
    'flight_tickets': 'Flight Tickets',
    'bus': 'Bus Transportation',
    'tour_guide': 'Tour Guide',
    'tours': 'Tours',
    'hotel': 'Hotel Accommodation',
    'meals': 'Meals',
    'insurance': 'Travel Insurance',
    'visa_assistance': 'Visa Assistance',
  };

  useEffect(() => {
    if (!token || !id || typeof id !== 'string') return;

    const fetchTripDetails = async () => {
      try {
        setLoading(true);
        
        // Fetch trip details
        const tripResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/trips/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Source': 'admin_panel',
          },
        });
        
        if (!tripResponse.ok) {
          throw new Error('Failed to fetch trip details');
        }
        
        const tripData = await tripResponse.json();
        setTrip(tripData);

        // Fetch field metadata for rendering required fields
        const fieldsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/available-fields`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Source': 'admin_panel',
          },
        });
        
        if (fieldsResponse.ok) {
          const fieldsData = await fieldsResponse.json();
          // Convert array of fields to object keyed by field_name for easier lookup
          const metadataObject: FieldMetadata = {};
          if (fieldsData.fields) {
            fieldsData.fields.forEach((field: any) => {
              metadataObject[field.field_name] = field;
            });
          }
          setFieldMetadata(metadataObject);
        }

        // Fetch trip destinations
        try {
          const destsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trips/${id}/destinations`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Source': 'admin_panel',
            },
          });
          if (destsResponse.ok) {
            const destsData = await destsResponse.json();
            setTripDestinations(destsData);
          }
        } catch (destErr) {
          console.error('Failed to fetch trip destinations:', destErr);
        }

        // Fetch trip updates
        try {
          const updatesResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/trips/${id}/updates`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Source': 'admin_panel',
            },
          });
          if (updatesResponse.ok) {
            const updatesData = await updatesResponse.json();
            setTripUpdates(updatesData);
          }
        } catch (updErr) {
          console.error('Failed to fetch trip updates:', updErr);
        }
        
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTripDetails();
  }, [token, id]);

  if (loading) return <p>{t('tripDetail.loading')}</p>;
  if (error) return <p>{t('tripDetail.error')}: {error}</p>;
  if (!trip) return <p>{t('tripDetail.notFound')}</p>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t('tripDetail.title')}</h1>
        <button 
          onClick={() => router.back()}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          {t('tripDetail.back')}
        </button>
      </div>

      {/* Trip Information */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">{t('tripDetail.tripInfo')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('tripDetail.nameEn')}</label>
            <p className="mt-1 text-sm text-gray-900">{trip.name_en}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('tripDetail.nameAr')}</label>
            <p className="mt-1 text-sm text-gray-900" dir="rtl">{trip.name_ar}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('tripDetail.provider')}</label>
            <p 
              className="mt-1 text-sm text-blue-600 hover:text-blue-800 cursor-pointer underline"
              onClick={() => router.push(`/providers/${trip.provider.id}`)}
            >
              {trip.provider.company_name}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('tripDetail.startDate')}</label>
            <p className="mt-1 text-sm text-gray-900">{new Date(trip.start_date).toLocaleDateString()}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('tripDetail.endDate')}</label>
            <p className="mt-1 text-sm text-gray-900">{new Date(trip.end_date).toLocaleDateString()}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('tripDetail.maxParticipants')}</label>
            <p className="mt-1 text-sm text-gray-900">{trip.max_participants}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('tripDetail.status')}</label>
            <p className={`mt-1 text-sm font-semibold ${trip.is_active ? 'text-green-600' : 'text-red-600'}`}>
              {trip.is_active ? t('tripDetail.active') : t('tripDetail.cancelled')}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('tripDetail.refundable')}</label>
            <p className={`mt-1 text-sm font-semibold ${trip.is_refundable ? 'text-green-600' : 'text-red-600'}`}>
              {trip.is_refundable ? t('common.yes') : t('common.no')}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">{t('tripDetail.descEn')}</label>
          <p className="mt-1 text-sm text-gray-900">{trip.description_en}</p>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">{t('tripDetail.descAr')}</label>
          <p className="mt-1 text-sm text-gray-900" dir="rtl">{trip.description_ar}</p>
        </div>
        
        {/* Trip Amenities */}
        {trip.amenities && trip.amenities.length > 0 && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">{t('tripDetail.amenities')}</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {trip.amenities.map((amenity) => (
                <div 
                  key={amenity}
                  className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <span className="text-blue-600 text-lg">✓</span>
                  <span className="text-sm font-medium text-gray-700">
                    {amenityLabels[amenity] || amenity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meeting Place Information */}
        {trip.has_meeting_place && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">{t('tripDetail.meetingPlace')}</label>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              {trip.meeting_location && (
                <div className="mb-2">
                  <span className="font-medium text-gray-700">📍 {t('tripDetail.meetingLocation')}:</span>
                  <span className="ml-2 text-gray-900">{trip.meeting_location}</span>
                </div>
              )}
              {trip.meeting_time && (
                <div>
                  <span className="font-medium text-gray-700">🕐 {t('tripDetail.meetingTime')}:</span>
                  <span className="ml-2 text-gray-900">{new Date(trip.meeting_time).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trip Images */}
        {trip.images && trip.images.length > 0 && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">{t('tripDetail.images')}</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {trip.images.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <img
                    src={imageUrl}
                    alt={`${trip.name_en} - Image ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg border-2 border-gray-200 shadow-md hover:shadow-xl transition-shadow cursor-pointer"
                    onClick={() => window.open(imageUrl, '_blank')}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg flex items-center justify-center pointer-events-none">
                    <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">
                      {t('tripDetail.clickToView')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trip Destinations */}
      {tripDestinations.length > 0 && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">{t('tripDetail.tripDestinations')} ({tripDestinations.length})</h2>
          <div className="flex flex-wrap gap-3">
            {tripDestinations.map((td) => (
              <div key={td.id} className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-sm font-medium text-blue-800">
                  {td.destination ? td.destination.name_en : 'Unknown'}
                </span>
                {td.destination?.name_ar && (
                  <span className="text-xs text-gray-500" dir="rtl">({td.destination.name_ar})</span>
                )}
                {td.place && (
                  <>
                    <span className="text-gray-400">&rarr;</span>
                    <span className="text-sm text-gray-700">{td.place.name_en}</span>
                    {td.place.name_ar && (
                      <span className="text-xs text-gray-500" dir="rtl">({td.place.name_ar})</span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trip Updates */}
      {tripUpdates.length > 0 && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">{t('tripDetail.tripUpdates')} ({tripUpdates.length})</h2>
          <div className="space-y-3">
            {tripUpdates.map((u) => (
              <div key={u.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{u.title}</h4>
                    {u.is_important && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">{t('tripUpdates.important')}</span>
                    )}
                    {u.registration_id && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">{t('tripDetail.targeted')}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(u.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{u.message}</p>
                <div className="text-xs text-gray-500">
                  {t('tripUpdates.readCol')}: {u.read_count} / {u.total_recipients} {t('tripDetail.recipients')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trip Packages */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">{t('tripDetail.tripPackages')} ({trip.packages.length})</h2>
        {trip.packages.length === 0 ? (
          <p className="text-gray-500">{t('tripDetail.noPackages')}</p>
        ) : (
          <div className="space-y-6">
            {trip.packages.map((pkg, index) => (
              <div key={pkg.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">{pkg.name_en}</h3>
                    <p className="text-sm text-gray-500" dir="rtl">{pkg.name_ar}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    pkg.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {pkg.is_active ? t('common.active') : t('common.inactive')}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('tripDetail.descEn')}</label>
                    <p className="mt-1 text-sm text-gray-900">{pkg.description_en}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('tripDetail.descAr')}</label>
                    <p className="mt-1 text-sm text-gray-900" dir="rtl">{pkg.description_ar}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('tripDetail.price')}</label>
                    <p className="mt-1 text-sm text-gray-900">{pkg.price} {pkg.currency || 'SAR'}</p>
                  </div>
                </div>

                {/* Required Fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('tripDetail.requiredFields')}</label>
                  {pkg.required_fields.length === 0 ? (
                    <p className="text-sm text-gray-500">{t('tripDetail.noRequiredFields')}</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {pkg.required_fields.map((fieldType) => {
                        const metadata = fieldMetadata[fieldType];
                        const fieldDetail = pkg.required_fields_details?.find(
                          detail => detail.field_type === fieldType
                        );
                        
                        return (
                          <div key={fieldType} className="bg-gray-50 p-3 rounded border">
                            <p className="text-sm font-medium">
                              {metadata?.display_name || fieldType}
                            </p>
                            <p className="text-xs text-gray-500 mb-1">
                              Type: {metadata?.ui_type || 'text'}
                            </p>
                            {fieldDetail && (
                              <ValidationDisplay
                                fieldType={fieldType}
                                fieldDisplayName={metadata?.display_name || fieldType}
                                validationConfig={fieldDetail.validation_config}
                              />
                            )}
                          </div>
                        );
                      })}
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

export default TripDetailPage;
