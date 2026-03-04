import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Trip, TripPackage, FieldMetadata, PackageRequiredField, TripAmenity } from '../../types/trip';
import { tripService } from '../../services/tripService';
import { destinationService, TripDestination } from '../../services/destinationService';
import { tripUpdateService, TripUpdate, TripUpdateCreate } from '../../services/tripUpdateService';
import { api } from '../../services/api';
import { useTranslation } from 'react-i18next';
import ValidationDisplay from '../ValidationDisplay';
import { formatInTripTz, tzLabel } from '../../utils/tripDate';

interface RegistrationUser {
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
  confirmed: 'bg-green-100 text-green-800',
  pending_payment: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
};

const TripDetailPage: React.FC = () => {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { id: tripId } = router.query;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [availableFields, setAvailableFields] = useState<FieldMetadata[]>([]);
  const [tripDestinations, setTripDestinations] = useState<TripDestination[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationUser[]>([]);
  const [tripUpdates, setTripUpdates] = useState<TripUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Share state
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  // Booking drawer state
  const [selectedBooking, setSelectedBooking] = useState<RegistrationUser | null>(null);
  const [bookingUpdates, setBookingUpdates] = useState<TripUpdate[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Send update form state
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendTarget, setSendTarget] = useState<'all' | 'booking'>('all');
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateImportant, setUpdateImportant] = useState(false);
  const [updateFile, setUpdateFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (router.isReady && tripId && typeof tripId === 'string') {
      loadAll();
    }
  }, [tripId, router.isReady]);

  const loadAll = async () => {
    if (!tripId || typeof tripId !== 'string') return;
    setLoading(true);
    try {
      const [tripData, fieldsResp, dests, regs, updates] = await Promise.allSettled([
        tripService.getById(tripId),
        tripService.getAvailableFields(),
        destinationService.getTripDestinations(tripId),
        api.get<RegistrationUser[]>(`/trips/${tripId}/registrations`),
        tripUpdateService.listForTrip(tripId),
      ]);
      if (tripData.status === 'fulfilled') setTrip(tripData.value);
      else setError('Failed to load trip details');
      if (fieldsResp.status === 'fulfilled') setAvailableFields(fieldsResp.value.fields || []);
      if (dests.status === 'fulfilled') setTripDestinations(dests.value);
      if (regs.status === 'fulfilled') setRegistrations(regs.value);
      if (updates.status === 'fulfilled') setTripUpdates(updates.value);
    } finally {
      setLoading(false);
    }
  };

  const openBooking = async (booking: RegistrationUser) => {
    setSelectedBooking(booking);
    setDrawerLoading(true);
    setBookingUpdates([]);
    try {
      const all = await tripUpdateService.listForTrip(tripId as string);
      setBookingUpdates(all.filter(u => u.registration_id === booking.id || u.registration_id === null));
    } catch {
      setBookingUpdates([]);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleSendUpdate = async () => {
    if (!updateTitle.trim() || !updateMessage.trim()) return;
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const payload: TripUpdateCreate = { title: updateTitle, message: updateMessage, is_important: updateImportant, file: updateFile };
      if (sendTarget === 'all') {
        await tripUpdateService.sendToAll(tripId as string, payload);
      } else if (selectedBooking) {
        await tripUpdateService.sendToRegistration(selectedBooking.id, payload);
      }
      setSendSuccess('Update sent successfully');
      setUpdateTitle('');
      setUpdateMessage('');
      setUpdateImportant(false);
      setUpdateFile(null);
      setShowSendForm(false);
      // Refresh updates
      const all = await tripUpdateService.listForTrip(tripId as string);
      setTripUpdates(all);
      if (selectedBooking) {
        setBookingUpdates(all.filter(u => u.registration_id === selectedBooking.id || u.registration_id === null));
      }
    } catch (err: any) {
      setSendError(err.message || 'Failed to send update');
    } finally {
      setSending(false);
    }
  };

  const handleShare = async () => {
    if (!tripId || typeof tripId !== 'string') return;
    setShareLoading(true);
    try {
      const data = await api.get<{ share_url: string; share_token: string; view_count: number }>(`/trips/${tripId}/share`);
      setShareUrl(data.share_url);
      await navigator.clipboard.writeText(data.share_url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 3000);
    } catch {
      // fallback: just show the URL
    } finally {
      setShareLoading(false);
    }
  };

  const getFieldDisplayName = (fieldType: string): string => {
    const field = availableFields.find(f => f.field_name === fieldType);
    if (!field) return fieldType;
    return i18n.language === 'ar' && field.display_name_ar ? field.display_name_ar : field.display_name;
  };

  const confirmedCount = registrations.filter(r => r.status === 'confirmed').length;
  const pendingCount = registrations.filter(r => r.status === 'pending_payment' || r.status === 'pending').length;
  const availableSpots = trip ? trip.max_participants - registrations.filter(r => ['confirmed', 'pending_payment'].includes(r.status)).reduce((sum, r) => sum + r.total_participants, 0) : 0;

  const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800";
  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" />
    </div>
  );
  if (error) return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
      {t('status.error')}: {error}
    </div>
  );
  if (!trip) return (
    <div className="p-8 text-slate-400 dark:text-slate-500 text-sm">{t('status.notFound')}</div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{trip.name_en || trip.name_ar}</h1>
          {trip.name_ar && trip.name_en && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5" dir="rtl">{trip.name_ar}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${trip.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{trip.is_active ? 'Active' : 'Inactive'}</span>
            {trip.is_international && <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400">International</span>}
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${trip.is_packaged_trip ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {trip.is_packaged_trip ? 'Packaged' : 'Simple'}
            </span>
            {(trip as any).trip_type && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                (trip as any).trip_type === 'guided'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
              }`}>
                {(trip as any).trip_type === 'guided' ? '🧭 Guided Trip' : '🎁 Tourism Package'}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          <button
            onClick={handleShare}
            disabled={shareLoading}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {shareCopied ? (
              <>
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span className="text-emerald-600 dark:text-emerald-400">{t('action.linkCopied', 'Link Copied!')}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                {t('action.shareTrip', 'Share')}
              </>
            )}
          </button>
          <button onClick={() => router.push(`/trips/${tripId}/edit`)}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-medium transition-colors">
            {t('action.editTrip')}
          </button>
          <button onClick={() => router.push('/trips')}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            {t('action.backToTrips')}
          </button>
        </div>
        {/* Share URL display */}
        {shareUrl && (
          <div className="sm:col-span-2 w-full mt-1">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 dark:text-slate-400 font-mono break-all">
              <span className="flex-1">{shareUrl}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(shareUrl); setShareCopied(true); setTimeout(() => setShareCopied(false), 3000); }}
                className="flex-shrink-0 text-sky-500 hover:text-sky-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Bookings', value: registrations.length, color: 'text-slate-900 dark:text-white' },
          { label: 'Confirmed', value: confirmedCount, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Pending Payment', value: pendingCount, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Available Spots', value: Math.max(0, availableSpots), color: availableSpots <= 5 ? 'text-red-600 dark:text-red-400' : 'text-sky-600 dark:text-sky-400' },
        ].map(s => (
          <div key={s.label} className={`${cardCls} p-4`}>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Trip Info */}
      <div className={`${cardCls} p-6`}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Trip Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Start Date', value: `${formatInTripTz(trip.start_date, trip.timezone ?? 'Asia/Riyadh')} (${tzLabel(trip.timezone ?? 'Asia/Riyadh')})` },
            { label: 'End Date', value: formatInTripTz(trip.end_date, trip.timezone ?? 'Asia/Riyadh') },
            { label: 'Registration Deadline', value: trip.registration_deadline ? formatInTripTz(trip.registration_deadline, trip.timezone ?? 'Asia/Riyadh') : '—' },
            { label: 'Max Participants', value: String(trip.max_participants) },
          ].map(({ label, value }) => (
            <div key={label}>
              <span className="text-xs text-slate-400 dark:text-slate-500">{label}</span>
              <p className="font-medium text-slate-900 dark:text-white mt-0.5">{value}</p>
            </div>
          ))}
          {!trip.is_packaged_trip && (
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500">Refundable</span>
              <p className={`font-medium mt-0.5 ${trip.is_refundable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{trip.is_refundable ? 'Yes' : 'No'}</p>
            </div>
          )}
          {(trip as any).starting_city && (
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500">Starting City</span>
              <p className="font-medium text-slate-900 dark:text-white mt-0.5">{(trip as any).starting_city.name_en}</p>
            </div>
          )}
        </div>
        {(trip.description_en || trip.description_ar) && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            {trip.description_en && <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">{trip.description_en}</p>}
            {trip.description_ar && <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed" dir="rtl">{trip.description_ar}</p>}
          </div>
        )}
        {trip.has_meeting_place && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-sm">
            <p className="font-medium text-slate-900 dark:text-white mb-2">Meeting Place</p>
            {trip.meeting_location && <p className="text-slate-600 dark:text-slate-400">{trip.meeting_location}</p>}
            {trip.meeting_time && <p className="text-slate-600 dark:text-slate-400">{new Date(trip.meeting_time).toLocaleString()}</p>}
          </div>
        )}
      </div>

      {/* Destinations + Amenities */}
      {(tripDestinations.length > 0 || (!trip.is_packaged_trip && trip.amenities && trip.amenities.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tripDestinations.length > 0 && (
            <div className={`${cardCls} p-5`}>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Destinations</h3>
              <div className="flex flex-wrap gap-2">
                {tripDestinations.map(td => (
                  <span key={td.id} className="px-3 py-1 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800/40 rounded-full text-sm text-sky-700 dark:text-sky-400">
                    {td.destination?.name_en || 'Unknown'}{td.place ? ` → ${td.place.name_en}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!trip.is_packaged_trip && trip.amenities && trip.amenities.length > 0 && (
            <div className={`${cardCls} p-5`}>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Amenities</h3>
              <div className="flex flex-wrap gap-2">
                {trip.amenities.map(a => (
                  <span key={a} className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-full text-sm text-emerald-700 dark:text-emerald-400">✓ {t(`amenity.${a}`, a)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Images */}
      {trip.images && trip.images.length > 0 && (
        <div className={`${cardCls} p-5`}>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Images</h3>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {trip.images.map((url, i) => (
              <img key={i} src={url} alt="" className="w-full h-24 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(url, '_blank')} />
            ))}
          </div>
        </div>
      )}

      {/* Required Fields — simple (non-packaged) trips only */}
      {!trip.is_packaged_trip && (
        <div className={cardCls}>
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Required Fields ({(trip.simple_trip_required_fields ?? []).length})
            </h2>
          </div>
          <div className="p-6">
            {(trip.simple_trip_required_fields ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">No required fields configured.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(trip.simple_trip_required_fields ?? []).map((fieldType) => {
                  const fieldDetail = (trip.simple_trip_required_fields_details ?? []).find(d => d.field_type === fieldType);
                  return (
                    <div key={fieldType} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {getFieldDisplayName(fieldType)}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {availableFields.find(f => f.field_name === fieldType)?.ui_type || 'text'}
                      </p>
                      <ValidationDisplay
                        fieldType={fieldType}
                        fieldDisplayName={getFieldDisplayName(fieldType)}
                        validationConfig={fieldDetail?.validation_config ?? null}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Packages */}
      {trip.is_packaged_trip && (
        <div className={cardCls}>
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Booking Tiers ({trip.packages.length})</h2>
          </div>
          <div className="p-6">
            {trip.packages.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
                No tiers yet. Add at least 2 tiers for a packaged trip.
              </div>
            ) : (
              <div className="space-y-3">
                {trip.packages.map(pkg => (
                  <div key={pkg.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-slate-900 dark:text-white">{pkg.name_en || pkg.name_ar}</h4>
                        {pkg.name_ar && pkg.name_en && <p className="text-xs text-slate-400 dark:text-slate-500" dir="rtl">{pkg.name_ar}</p>}
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{pkg.description_en || pkg.description_ar}</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{pkg.price} {pkg.currency || 'SAR'}</p>
                        {pkg.max_participants != null && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Max: {pkg.max_participants} participants</p>}
                        {pkg.is_refundable != null && <p className="text-xs mt-0.5"><span className={pkg.is_refundable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{pkg.is_refundable ? '✓ Refundable' : '✗ Non-refundable'}</span></p>}
                        {pkg.amenities && pkg.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {pkg.amenities.map(a => <span key={a} className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-full text-xs text-emerald-700 dark:text-emerald-400">{t(`amenity.${a}`, a)}</span>)}
                          </div>
                        )}
                      </div>
                      <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${pkg.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{pkg.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    {pkg.required_fields?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {pkg.required_fields.map((f: string) => (
                          <span key={f} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs text-slate-600 dark:text-slate-400">{getFieldDisplayName(f)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Broadcast Updates */}
      <div className={cardCls}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Broadcast Updates ({tripUpdates.filter(u => !u.registration_id).length})</h2>
          <button onClick={() => { setSendTarget('all'); setShowSendForm(v => !v); setSendError(null); setSendSuccess(null); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${showSendForm && sendTarget === 'all' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' : 'bg-sky-500 hover:bg-sky-600 text-white'}`}>
            {showSendForm && sendTarget === 'all' ? 'Cancel' : 'Send to All'}
          </button>
        </div>
        <div className="p-6">
          {showSendForm && sendTarget === 'all' && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-4 space-y-3">
              {sendError && <p className="text-red-600 dark:text-red-400 text-sm">{sendError}</p>}
              {sendSuccess && <p className="text-emerald-600 dark:text-emerald-400 text-sm">{sendSuccess}</p>}
              <input type="text" placeholder="Title" value={updateTitle} onChange={e => setUpdateTitle(e.target.value)} className={inputCls} />
              <textarea placeholder="Message" value={updateMessage} onChange={e => setUpdateMessage(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 cursor-pointer hover:border-sky-400 transition-colors text-xs text-slate-500 dark:text-slate-400 flex-1 min-w-0">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  <span className="truncate">{updateFile ? updateFile.name : 'Attach file (image/PDF)'}</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setUpdateFile(e.target.files?.[0] ?? null)} />
                </label>
                {updateFile && <button onClick={() => setUpdateFile(null)} className="text-xs text-red-500 flex-shrink-0">✕</button>}
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-red-600 dark:text-red-400">
                  <input type="checkbox" checked={updateImportant} onChange={e => setUpdateImportant(e.target.checked)} className="accent-red-500" />
                  Mark as Important
                </label>
                <button onClick={handleSendUpdate} disabled={sending || !updateTitle.trim() || !updateMessage.trim()}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors">
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          )}
          {tripUpdates.filter(u => !u.registration_id).length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-sm">No broadcast updates sent yet.</p>
          ) : (
            <div className="space-y-3">
              {tripUpdates.filter(u => !u.registration_id).map(u => (
                <div key={u.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-900 dark:text-white">{u.title}</span>
                      {u.is_important && <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">Important</span>}
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{new Date(u.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">{u.message}</p>
                  {u.attachments && u.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {u.attachments.map((att: any, i: number) => (
                        att.content_type?.startsWith('image/') ? (
                          <a key={i} href={att.url} target="_blank" rel="noreferrer">
                            <img src={att.url} alt={att.filename} className="h-16 w-auto rounded-lg border border-slate-200 dark:border-slate-700 object-cover hover:opacity-80 transition-opacity" />
                          </a>
                        ) : (
                          <a key={i} href={att.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-sky-600 dark:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            {att.filename || 'Attachment'}
                          </a>
                        )
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Read: {u.read_count ?? 0} / {u.total_recipients ?? '?'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bookings Table */}
      <div className={cardCls}>
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Bookings ({registrations.length})</h2>
        </div>
        {registrations.length === 0 ? (
          <p className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">No bookings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ref</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Name</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Email</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Participants</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Amount</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {registrations.map(reg => (
                  <tr key={reg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">{reg.booking_reference}</td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{reg.user_name || '—'}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 hidden md:table-cell">{reg.user_email || '—'}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-center hidden sm:table-cell">{reg.total_participants}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium hidden sm:table-cell">{reg.total_amount} SAR</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[reg.status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                        {reg.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button onClick={() => openBooking(reg)} className="px-3 py-1.5 bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800/40 rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/40 text-xs font-medium transition-colors">
                        View
                      </button>
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
          <div className="flex-1 bg-black/50" onClick={() => { setSelectedBooking(null); setShowSendForm(false); }} />
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full overflow-y-auto shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Booking Detail</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{selectedBooking.booking_reference}</p>
              </div>
              <button onClick={() => { setSelectedBooking(null); setShowSendForm(false); }}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xl leading-none">
                &times;
              </button>
            </div>

            <div className="p-5 space-y-5 flex-1">
              {/* Booker info */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white mb-3">Booker Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Name', value: selectedBooking.user_name || '—' },
                    { label: 'Email', value: selectedBooking.user_email || '—' },
                    { label: 'Phone', value: selectedBooking.user_phone || '—' },
                    { label: 'Participants', value: String(selectedBooking.total_participants) },
                    { label: 'Amount', value: `${selectedBooking.total_amount} SAR` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span className="text-xs text-slate-400 dark:text-slate-500 block">{label}</span>
                      <span className="font-medium text-slate-900 dark:text-white">{value}</span>
                    </div>
                  ))}
                  <div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">Status</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[selectedBooking.status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                      {selectedBooking.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">Booked On</span>
                    <span className="font-medium text-slate-900 dark:text-white">{new Date(selectedBooking.registration_date).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Participants */}
              {selectedBooking.participants?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white mb-3">Participants ({selectedBooking.participants.length})</h4>
                  <div className="space-y-2">
                    {selectedBooking.participants.map((p: any, i: number) => {
                      const pkg = trip.packages.find((pk: TripPackage) => pk.id === p.package_id);
                      return (
                        <div key={p.id || i} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-sm">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-semibold text-slate-900 dark:text-white">{p.name || `Participant ${i + 1}`}</p>
                            {pkg && (
                              <span className="px-2 py-0.5 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800/40 rounded-full text-xs text-sky-700 dark:text-sky-400 font-medium">
                                {pkg.name_en || pkg.name_ar}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-xs text-slate-500 dark:text-slate-400">
                            {p.email && <span>{p.email}</span>}
                            {p.phone && <span>{p.phone}</span>}
                            {p.date_of_birth && <span>DOB: {p.date_of_birth}</span>}
                            {p.gender && <span>Gender: {p.gender}</span>}
                            {p.id_iqama_number && <span>ID: {p.id_iqama_number}</span>}
                            {p.passport_number && <span>Passport: {p.passport_number}</span>}
                            {p.nationality && <span>Nationality: {p.nationality}</span>}
                            {p.medical_conditions && <span className="col-span-2">Medical: {p.medical_conditions}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Updates for this booking */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Updates for this Booking</h4>
                  <button
                    onClick={() => { setSendTarget('booking'); setShowSendForm(v => !v); setSendError(null); setSendSuccess(null); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${showSendForm && sendTarget === 'booking' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' : 'bg-sky-500 hover:bg-sky-600 text-white'}`}
                  >
                    {showSendForm && sendTarget === 'booking' ? 'Cancel' : 'Send Update'}
                  </button>
                </div>

                {showSendForm && sendTarget === 'booking' && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 mb-3 space-y-2">
                    {sendError && <p className="text-red-600 dark:text-red-400 text-xs">{sendError}</p>}
                    {sendSuccess && <p className="text-emerald-600 dark:text-emerald-400 text-xs">{sendSuccess}</p>}
                    <input type="text" placeholder="Title" value={updateTitle} onChange={e => setUpdateTitle(e.target.value)} className={inputCls} />
                    <textarea placeholder="Message" value={updateMessage} onChange={e => setUpdateMessage(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 cursor-pointer hover:border-sky-400 transition-colors text-xs text-slate-500 dark:text-slate-400 flex-1 min-w-0">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        <span className="truncate">{updateFile ? updateFile.name : 'Attach'}</span>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setUpdateFile(e.target.files?.[0] ?? null)} />
                      </label>
                      {updateFile && <button onClick={() => setUpdateFile(null)} className="text-xs text-red-500">✕</button>}
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs cursor-pointer font-medium text-red-600 dark:text-red-400">
                        <input type="checkbox" checked={updateImportant} onChange={e => setUpdateImportant(e.target.checked)} className="accent-red-500" />
                        Important
                      </label>
                      <button onClick={handleSendUpdate} disabled={sending || !updateTitle.trim() || !updateMessage.trim()}
                        className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl text-xs font-medium transition-colors">
                        {sending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}

                {drawerLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin w-5 h-5 rounded-full border-2 border-sky-500 border-t-transparent" />
                  </div>
                ) : bookingUpdates.length === 0 ? (
                  <p className="text-slate-400 dark:text-slate-500 text-xs">No updates for this booking.</p>
                ) : (
                  <div className="space-y-2">
                    {bookingUpdates.map(u => (
                      <div key={u.id} className={`rounded-xl p-3 text-sm border ${u.registration_id ? 'border-purple-200 dark:border-purple-800/40 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-xs text-slate-900 dark:text-white">{u.title}</span>
                            {u.is_important && <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs">Important</span>}
                            {u.registration_id
                              ? <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs">Targeted</span>
                              : <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-xs">Broadcast</span>}
                          </div>
                          <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">{new Date(u.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">{u.message}</p>
                        {u.attachments && u.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {u.attachments.map((att: any, i: number) => (
                              att.content_type?.startsWith('image/') ? (
                                <a key={i} href={att.url} target="_blank" rel="noreferrer">
                                  <img src={att.url} alt={att.filename} className="h-14 w-auto rounded-lg border border-slate-200 dark:border-slate-700 object-cover hover:opacity-80 transition-opacity" />
                                </a>
                              ) : (
                                <a key={i} href={att.url} target="_blank" rel="noreferrer"
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-sky-600 dark:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  <span className="truncate max-w-[140px]">{att.filename || 'Attachment'}</span>
                                </a>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripDetailPage;
