import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import ValidationDisplay from '@/components/ValidationDisplay';
import { formatInTripTz, formatDateInTripTz, tzLabel } from '@/utils/tripDate';

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
  max_participants?: number | null;
  is_refundable?: boolean | null;
  amenities?: string[] | null;
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
  name_en: string | null;
  name_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  start_date: string;
  end_date: string;
  registration_deadline?: string | null;
  max_participants: number;
  is_active: boolean;
  is_packaged_trip?: boolean;
  is_international?: boolean;
  starting_city_id?: string | null;
  starting_city?: { id: string; name_en: string; name_ar: string } | null;
  trip_reference?: string | null;
  provider_id: string;
  provider: Provider;
  images?: string[];
  trip_metadata?: any;
  packages: TripPackage[];
  timezone?: string;
  is_refundable?: boolean;
  amenities?: string[];
  trip_type?: string;
  has_meeting_place?: boolean;
  meeting_location?: string;
  meeting_time?: string;
  simple_trip_required_fields?: string[];
  simple_trip_required_fields_details?: TripPackageRequiredFieldDetail[];
  meeting_place_name?: string;
  meeting_place_name_ar?: string;
  price?: number | null;
  extra_fees?: TripExtraFee[];
}

interface TripExtraFee {
  id: string;
  name_en: string;
  name_ar: string;
  description_en?: string;
  description_ar?: string;
  amount: number;
  currency: string;
  is_mandatory: boolean;
}

interface TripRegistration {
  id: string;
  booking_reference: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  total_participants: number;
  total_amount: string;
  status: string;
  registration_date: string;
  participants: any[];
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  pending_payment: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  completed: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
};

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
  const [registrations, setRegistrations] = useState<TripRegistration[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<TripRegistration | null>(null);
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

        // Fetch registrations (uses provider endpoint but admin token is accepted via admin route)
        try {
          const regsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/trips/${id}/registrations`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Source': 'admin_panel',
            },
          });
          if (regsResponse.ok) {
            const regsData = await regsResponse.json();
            setRegistrations(regsData);
          }
        } catch (regErr) {
          console.error('Failed to fetch registrations:', regErr);
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

  const thCls = "text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide";
  const lCls = "text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1";

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-3"><p className="text-red-500 dark:text-red-400 text-sm">{error}</p><button onClick={() => router.back()} className="text-sm text-sky-600 dark:text-sky-400 hover:underline">Go back</button></div>;
  if (!trip) return <div className="flex items-center justify-center h-64"><p className="text-slate-500 dark:text-slate-400 text-sm">Trip not found</p></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{trip.name_en || trip.name_ar}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${trip.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
              {trip.is_active ? t('tripDetail.active') : t('tripDetail.cancelled')}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${trip.is_packaged_trip ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {trip.is_packaged_trip ? 'Multi-Tier' : 'Single Price'}
            </span>
            {trip.trip_type && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                trip.trip_type === 'guided'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
              }`}>
                {trip.trip_type === 'guided' ? 'Guided Trip' : 'Tourism Package'}
              </span>
            )}
            {trip.is_international && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400">International</span>
            )}
          </div>
        </div>
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 font-medium flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t('tripDetail.back')}
        </button>
      </div>

      {/* Trip Info Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">{t('tripDetail.tripInfo')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div><p className={lCls}>{t('tripDetail.nameEn')}</p><p className="text-sm text-slate-900 dark:text-white">{trip.name_en || '—'}</p></div>
          <div><p className={lCls}>{t('tripDetail.nameAr')}</p><p className="text-sm text-slate-900 dark:text-white" dir="rtl">{trip.name_ar || '—'}</p></div>
          <div><p className={lCls}>{t('tripDetail.provider')}</p>
            <button onClick={() => router.push(`/providers/${trip.provider.id}`)} className="text-sm text-sky-600 dark:text-sky-400 hover:underline font-medium">{trip.provider.company_name}</button>
          </div>
          <div><p className={lCls}>{t('tripDetail.startDate')}</p><p className="text-sm text-slate-900 dark:text-white">{formatInTripTz(trip.start_date, trip.timezone ?? 'Asia/Riyadh')}</p></div>
          <div><p className={lCls}>{t('tripDetail.endDate')}</p><p className="text-sm text-slate-900 dark:text-white">{formatInTripTz(trip.end_date, trip.timezone ?? 'Asia/Riyadh')} <span className="text-xs text-slate-400">({tzLabel(trip.timezone ?? 'Asia/Riyadh')})</span></p></div>
          <div><p className={lCls}>{t('tripDetail.maxParticipants')}</p><p className="text-sm text-slate-900 dark:text-white">{trip.max_participants}</p></div>
          {!trip.is_packaged_trip && (
            <div><p className={lCls}>{t('tripDetail.refundable')}</p>
              <span className={`text-xs font-semibold ${trip.is_refundable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{trip.is_refundable ? t('common.yes') : t('common.no')}</span>
            </div>
          )}
          <div><p className={lCls}>Reg. Deadline</p><p className="text-sm text-slate-900 dark:text-white">{trip.registration_deadline ? formatInTripTz(trip.registration_deadline, trip.timezone ?? 'Asia/Riyadh') : '—'}</p></div>
          {trip.starting_city && <div><p className={lCls}>Starting City</p><p className="text-sm text-slate-900 dark:text-white">{trip.starting_city.name_en}</p></div>}
          {trip.trip_reference && <div><p className={lCls}>Reference</p><p className="text-sm font-mono text-slate-900 dark:text-white">{trip.trip_reference}</p></div>}
          <div><p className={lCls}>Type</p><p className="text-sm text-slate-900 dark:text-white">{trip.is_international ? 'International' : 'Domestic'}</p></div>
          <div><p className={lCls}>Bookings</p><p className="text-sm font-semibold text-slate-900 dark:text-white">{registrations.length} total · {registrations.filter(r => r.status === 'confirmed').length} confirmed</p></div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><p className={lCls}>{t('tripDetail.descEn')}</p><p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{trip.description_en || '—'}</p></div>
          <div><p className={lCls}>{t('tripDetail.descAr')}</p><p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed" dir="rtl">{trip.description_ar || '—'}</p></div>
        </div>

        {/* Amenities */}
        {!trip.is_packaged_trip && trip.amenities && trip.amenities.length > 0 && (
          <div className="mt-5">
            <p className={lCls}>{t('tripDetail.amenities')}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {trip.amenities.map(amenity => (
                <span key={amenity} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-medium text-sky-700 dark:text-sky-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  {amenityLabels[amenity] || amenity}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Price — non-packaged trips */}
        {!trip.is_packaged_trip && trip.price != null && (
          <div className="mt-5">
            <p className={lCls}>Price</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{trip.price} SAR</p>
          </div>
        )}

        {/* Meeting Place */}
        {trip.has_meeting_place && (
          <div className="mt-5">
            <p className={lCls}>{t('tripDetail.meetingPlace')}</p>
            <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2">
              {(trip.meeting_place_name || trip.meeting_place_name_ar) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {trip.meeting_place_name && (
                    <div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 block mb-0.5">EN</span>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{trip.meeting_place_name}</p>
                    </div>
                  )}
                  {trip.meeting_place_name_ar && (
                    <div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 block mb-0.5">AR</span>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white" dir="rtl">{trip.meeting_place_name_ar}</p>
                    </div>
                  )}
                </div>
              )}
              {trip.meeting_location && (
                <a href={trip.meeting_location} target="_blank" rel="noreferrer" className="text-sm text-sky-600 dark:text-sky-400 hover:underline break-all">{trip.meeting_location}</a>
              )}
              {trip.meeting_time && <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(trip.meeting_time).toLocaleString()}</p>}
            </div>
          </div>
        )}

        {/* Images */}
        {trip.images && trip.images.length > 0 && (
          <div className="mt-5">
            <p className={lCls}>{t('tripDetail.images')}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
              {trip.images.map((imageUrl, index) => (
                <div key={index} className="relative group cursor-pointer" onClick={() => window.open(imageUrl, '_blank')}>
                  <img src={imageUrl} alt={`Image ${index + 1}`} className="w-full h-40 object-cover rounded-xl border border-slate-200 dark:border-slate-700 transition-opacity group-hover:opacity-80" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded-lg">{t('tripDetail.clickToView')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Extra Fees */}
      {trip.extra_fees && trip.extra_fees.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Additional Fees <span className="text-slate-400 font-normal">({trip.extra_fees.length})</span></h2>
          <div className="space-y-2">
            {trip.extra_fees.map(fee => (
              <div key={fee.id} className="flex items-start justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">{fee.name_en || fee.name_ar}</p>
                  {fee.name_ar && fee.name_en && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5" dir="rtl">{fee.name_ar}</p>}
                  {(fee.description_en || fee.description_ar) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{fee.description_en || fee.description_ar}</p>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-2 ml-4">
                  <span className="font-bold text-slate-900 dark:text-white">{fee.amount} {fee.currency}</span>
                  {fee.is_mandatory && (
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">Mandatory</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trip Destinations */}
      {tripDestinations.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{t('tripDetail.tripDestinations')} <span className="text-slate-400 font-normal">({tripDestinations.length})</span></h2>
          <div className="flex flex-wrap gap-2">
            {tripDestinations.map(td => (
              <div key={td.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl text-xs">
                <span className="font-semibold text-sky-700 dark:text-sky-400">{td.destination ? td.destination.name_en : 'Unknown'}</span>
                {td.destination?.name_ar && <span className="text-slate-400" dir="rtl">({td.destination.name_ar})</span>}
                {td.place && (
                  <>
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    <span className="text-slate-600 dark:text-slate-300">{td.place.name_en}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trip Updates */}
      {tripUpdates.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('tripDetail.tripUpdates')} <span className="text-slate-400 font-normal">({tripUpdates.length})</span></h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {tripUpdates.map(u => (
              <div key={u.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">{u.title}</span>
                    {u.is_important && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">{t('tripUpdates.important')}</span>}
                    {u.registration_id && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">{t('tripDetail.targeted')}</span>}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{new Date(u.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap mb-1.5">{u.message}</p>
                {u.attachments && u.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-1.5">
                    {u.attachments.map((att: any, i: number) => (
                      att.content_type?.startsWith('image/') ? (
                        <a key={i} href={att.url} target="_blank" rel="noreferrer">
                          <img src={att.url} alt={att.filename} className="h-16 w-auto rounded-lg border border-slate-200 dark:border-slate-700 object-cover hover:opacity-80 transition-opacity" />
                        </a>
                      ) : (
                        <a key={i} href={att.url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-sky-600 dark:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          <span className="truncate max-w-[160px]">{att.filename || 'Attachment'}</span>
                        </a>
                      )
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500">{t('tripUpdates.readCol')}: {u.read_count} / {u.total_recipients}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bookings */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Bookings <span className="text-slate-400 font-normal">({registrations.length})</span></h2>
        </div>
        {registrations.length === 0 ? (
          <div className="py-12 text-center"><p className="text-slate-400 dark:text-slate-500 text-sm">No bookings yet.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className={thCls}>Ref</th>
                  <th className={thCls}>Name</th>
                  <th className={`${thCls} hidden sm:table-cell`}>Email</th>
                  <th className={`${thCls} hidden md:table-cell`}>Pax</th>
                  <th className={`${thCls} hidden md:table-cell`}>Amount</th>
                  <th className={thCls}>Status</th>
                  <th className={`${thCls} hidden lg:table-cell`}>Date</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {registrations.map(reg => (
                  <tr key={reg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">{reg.booking_reference}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{reg.user_name || '—'}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{reg.user_email || '—'}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-center hidden md:table-cell">{reg.total_participants}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 hidden md:table-cell">{reg.total_amount} SAR</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[reg.status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                        {reg.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 dark:text-slate-500 text-xs hidden lg:table-cell">{new Date(reg.registration_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => setSelectedBooking(reg)} className="px-3 py-1.5 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800 rounded-lg text-xs font-semibold hover:bg-sky-100 transition-colors">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking Detail Drawer */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelectedBooking(null)} />
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 h-full overflow-y-auto shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Booking Detail</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedBooking.booking_reference}</p>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xl leading-none">&times;</button>
            </div>
            <div className="p-5 space-y-5 flex-1">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Booker</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-xs text-slate-400 block mb-0.5">Name</span><span className="font-medium text-slate-900 dark:text-white">{selectedBooking.user_name || '—'}</span></div>
                  <div><span className="text-xs text-slate-400 block mb-0.5">Email</span><span className="font-medium text-slate-900 dark:text-white">{selectedBooking.user_email || '—'}</span></div>
                  <div><span className="text-xs text-slate-400 block mb-0.5">Phone</span><span className="font-medium text-slate-900 dark:text-white">{selectedBooking.user_phone || '—'}</span></div>
                  <div><span className="text-xs text-slate-400 block mb-0.5">Status</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[selectedBooking.status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                      {selectedBooking.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div><span className="text-xs text-slate-400 block mb-0.5">Participants</span><span className="font-medium text-slate-900 dark:text-white">{selectedBooking.total_participants}</span></div>
                  <div><span className="text-xs text-slate-400 block mb-0.5">Amount</span><span className="font-medium text-slate-900 dark:text-white">{selectedBooking.total_amount} SAR</span></div>
                  <div className="col-span-2"><span className="text-xs text-slate-400 block mb-0.5">Booked On</span><span className="font-medium text-slate-900 dark:text-white">{new Date(selectedBooking.registration_date).toLocaleString()}</span></div>
                </div>
              </div>
              {selectedBooking.participants?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Participants ({selectedBooking.participants.length})</p>
                  <div className="space-y-2">
                    {selectedBooking.participants.map((p: any, i: number) => {
                      const pkg = trip.packages.find((pk: TripPackage) => pk.id === p.package_id);
                      return (
                        <div key={p.id || i} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-semibold text-slate-900 dark:text-white">{p.name || `Participant ${i + 1}`}</p>
                            {pkg && <span className="px-2 py-0.5 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg text-xs text-sky-700 dark:text-sky-400 font-medium">{pkg.name_en || pkg.name_ar}</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-xs text-slate-500 dark:text-slate-400">
                            {p.email && <span>{p.email}</span>}
                            {p.phone && <span>{p.phone}</span>}
                            {p.date_of_birth && <span>DOB: {p.date_of_birth}</span>}
                            {p.gender && <span>Gender: {p.gender}</span>}
                            {p.id_iqama_number && <span>ID: {p.id_iqama_number}</span>}
                            {p.passport_number && <span>Passport: {p.passport_number}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {tripUpdates.filter(u => u.registration_id === selectedBooking.id || u.registration_id === null).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Updates</p>
                  <div className="space-y-2">
                    {tripUpdates.filter(u => u.registration_id === selectedBooking.id || u.registration_id === null).map(u => (
                      <div key={u.id} className={`rounded-xl p-3 text-sm border ${u.registration_id ? 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs text-slate-900 dark:text-white">{u.title}</span>
                            {u.is_important && <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs">Important</span>}
                            {u.registration_id ? <span className="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded text-xs">Targeted</span> : <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded text-xs">Broadcast</span>}
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0">{new Date(u.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{u.message}</p>
                        {u.attachments && u.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {u.attachments.map((att: any, i: number) => (
                              att.content_type?.startsWith('image/') ? (
                                <a key={i} href={att.url} target="_blank" rel="noreferrer">
                                  <img src={att.url} alt={att.filename} className="h-16 w-auto rounded-lg border border-slate-200 dark:border-slate-700 object-cover hover:opacity-80 transition-opacity" />
                                </a>
                              ) : (
                                <a key={i} href={att.url} target="_blank" rel="noreferrer"
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-sky-600 dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  <span className="truncate max-w-[140px]">{att.filename || 'Attachment'}</span>
                                </a>
                              )
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-slate-400 mt-1">Read: {u.read_count} / {u.total_recipients}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Required Fields — simple (non-packaged) trips only */}
      {!trip.is_packaged_trip && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{t('tripDetail.requiredFields')} <span className="text-slate-400 font-normal">({(trip.simple_trip_required_fields ?? []).length})</span></h2>
          {(trip.simple_trip_required_fields ?? []).length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('tripDetail.noRequiredFields')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {(trip.simple_trip_required_fields ?? []).map((fieldType) => {
                const metadata = fieldMetadata[fieldType];
                const fieldDetail = (trip.simple_trip_required_fields_details ?? []).find(d => d.field_type === fieldType);
                return (
                  <div key={fieldType} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{metadata?.display_name || fieldType}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Type: {metadata?.ui_type || 'text'}</p>
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
      )}

      {/* Booking Tiers */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Booking Tiers <span className="text-slate-400 font-normal">({trip.packages.length})</span></h2>
        </div>
        {trip.packages.length === 0 ? (
          <div className="py-12 text-center"><p className="text-slate-400 dark:text-slate-500 text-sm">No tiers configured.</p></div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {trip.packages.map((pkg) => (
              <div key={pkg.id} className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{pkg.name_en || pkg.name_ar}</h3>
                    {pkg.name_ar && pkg.name_en && <p className="text-sm text-slate-400 mt-0.5" dir="rtl">{pkg.name_ar}</p>}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${pkg.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                    {pkg.is_active ? t('common.active') : t('common.inactive')}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div><p className={lCls}>{t('tripDetail.descEn')}</p><p className="text-sm text-slate-700 dark:text-slate-300">{pkg.description_en || '—'}</p></div>
                  <div><p className={lCls}>{t('tripDetail.descAr')}</p><p className="text-sm text-slate-700 dark:text-slate-300" dir="rtl">{pkg.description_ar || '—'}</p></div>
                  <div><p className={lCls}>{t('tripDetail.price')}</p><p className="text-sm font-semibold text-slate-900 dark:text-white">{pkg.price} {pkg.currency || 'SAR'}</p></div>
                  {pkg.max_participants != null && <div><p className={lCls}>Max Participants</p><p className="text-sm text-slate-900 dark:text-white">{pkg.max_participants}</p></div>}
                  {pkg.is_refundable != null && <div><p className={lCls}>Refundable</p><p className={`text-sm font-semibold ${pkg.is_refundable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{pkg.is_refundable ? 'Yes' : 'No'}</p></div>}
                </div>
                {pkg.amenities && pkg.amenities.length > 0 && (
                  <div className="mb-4">
                    <p className={lCls}>Amenities</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {pkg.amenities.map(a => (
                        <span key={a} className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-full text-xs text-emerald-700 dark:text-emerald-400">{amenityLabels[a] || a}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className={lCls}>{t('tripDetail.requiredFields')}</p>
                  {pkg.required_fields.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{t('tripDetail.noRequiredFields')}</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                      {pkg.required_fields.map((fieldType) => {
                        const metadata = fieldMetadata[fieldType];
                        const fieldDetail = pkg.required_fields_details?.find(d => d.field_type === fieldType);
                        return (
                          <div key={fieldType} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{metadata?.display_name || fieldType}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Type: {metadata?.ui_type || 'text'}</p>
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
