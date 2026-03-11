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
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending_payment: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  awaiting_provider: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  completed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'tripDetail.awaitingPayment',
  pending_payment: 'tripDetail.awaitingPayment',
  awaiting_provider: 'tripDetail.awaitingProvider',
  processing: 'tripDetail.providerConfirmed',
  confirmed: 'tripDetail.confirmed',
  cancelled: 'tripDetail.cancelled',
  completed: 'tripDetail.completed',
};

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

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
  const [processingAction, setProcessingAction] = useState<string | null>(null);

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

  // Cancel booking state
  const [cancellingBooking, setCancellingBooking] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);

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
      else setError(t('tripDetail.errorLoad'));
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
      setSendSuccess(t('tripDetail.updateSent'));
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
      setSendError(err.message || t('tripDetail.updateSendFailed'));
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

  const cardCls = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden';
  const inputCls = 'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500';

  const handleStartProcessing = async (reg: RegistrationUser) => {
    if (!tripId || typeof tripId !== 'string') return;
    if (!confirm(t('tripDetail.markProcessingConfirm', { reference: reg.booking_reference }))) return;
    setProcessingAction(reg.id);
    try {
      await tripService.startProcessing(tripId, reg.id);
      setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, status: 'processing' } : r));
      setSelectedBooking(prev => prev?.id === reg.id ? { ...prev, status: 'processing' } : prev);
    } catch (err: any) {
      alert(err.message || t('tripDetail.updateStatusFailed'));
    } finally {
      setProcessingAction(null);
    }
  };

  const handleConfirmProcessing = async (reg: RegistrationUser) => {
    if (!tripId || typeof tripId !== 'string') return;
    if (!confirm(t('tripDetail.markConfirmedConfirm', { reference: reg.booking_reference }))) return;
    setProcessingAction(reg.id);
    try {
      await tripService.confirmProcessing(tripId, reg.id);
      setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, status: 'confirmed' } : r));
      setSelectedBooking(prev => prev?.id === reg.id ? { ...prev, status: 'confirmed' } : prev);
    } catch (err: any) {
      alert(err.message || t('tripDetail.updateStatusFailed'));
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCancelBooking = async (reg: RegistrationUser) => {
    if (!tripId || typeof tripId !== 'string') return;
    setCancellingBooking(reg.id);
    try {
      const result = await api.post<{ refund_percentage: number; refund_amount: number }>(
        `/trips/${tripId}/registrations/${reg.id}/cancel`,
        { reason: cancelReason || undefined },
      );
      setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, status: 'cancelled' } : r));
      setSelectedBooking(prev => prev?.id === reg.id ? { ...prev, status: 'cancelled' } : prev);
      setShowCancelForm(false);
      setCancelReason('');
      const pct = result.refund_percentage;
      const amt = result.refund_amount;
      alert(pct > 0
        ? t('tripDetail.bookingCancelledWithRefund', { percent: pct, amount: Number(amt).toLocaleString() })
        : t('tripDetail.bookingCancelledNoRefund'));
    } catch (err: any) {
      alert(err.message || t('tripDetail.bookingCancelFailed'));
    } finally {
      setCancellingBooking(null);
    }
  };

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
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${trip.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{trip.is_active ? t('tripDetail.active') : t('tripDetail.inactive')}</span>
            {trip.is_international && <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400">{t('tripDetail.international')}</span>}
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${trip.is_packaged_trip ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {trip.is_packaged_trip ? t('tripDetail.packaged') : t('tripDetail.simple')}
            </span>
            {(trip as any).trip_type && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                (trip as any).trip_type === 'guided'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
              }`}>
                {(trip as any).trip_type === 'guided' ? t('tripDetail.guidedTrip') : t('tripDetail.tourismPackage')}
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
                <span className="text-emerald-600 dark:text-emerald-400">{t('action.linkCopied')}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                {t('action.shareTrip')}
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
          { label: t('tripDetail.totalBookings'), value: registrations.length, color: 'text-slate-900 dark:text-white' },
          { label: t('tripDetail.confirmed'), value: confirmedCount, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: t('tripDetail.pendingPayment'), value: pendingCount, color: 'text-amber-600 dark:text-amber-400' },
          { label: t('tripDetail.availableSpots'), value: Math.max(0, availableSpots), color: availableSpots <= 5 ? 'text-red-600 dark:text-red-400' : 'text-sky-600 dark:text-sky-400' },
        ].map(s => (
          <div key={s.label} className={`${cardCls} p-4`}>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Trip Info */}
      <div className={`${cardCls} p-6`}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">{t('tripDetail.tripInformation')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {[
            { label: t('tripDetail.startDate'), value: `${formatInTripTz(trip.start_date, trip.timezone ?? 'Asia/Riyadh')} (${tzLabel(trip.timezone ?? 'Asia/Riyadh')})` },
            { label: t('tripDetail.endDate'), value: formatInTripTz(trip.end_date, trip.timezone ?? 'Asia/Riyadh') },
            { label: t('tripDetail.registrationDeadline'), value: trip.registration_deadline ? formatInTripTz(trip.registration_deadline, trip.timezone ?? 'Asia/Riyadh') : '—' },
            { label: t('tripDetail.maxParticipants'), value: String(trip.max_participants) },
          ].map(({ label, value }) => (
            <div key={label}>
              <span className="text-xs text-slate-400 dark:text-slate-500">{label}</span>
              <p className="font-medium text-slate-900 dark:text-white mt-0.5">{value}</p>
            </div>
          ))}
          {!trip.is_packaged_trip && trip.price != null && (
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500">{t('tripDetail.price')}</span>
              <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{trip.price} SAR</p>
            </div>
          )}
          {!trip.is_packaged_trip && (
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500">{t('tripDetail.refundable')}</span>
              <p className={`font-medium mt-0.5 ${trip.is_refundable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{trip.is_refundable ? t('tripDetail.yes') : t('tripDetail.no')}</p>
            </div>
          )}
          {(trip as any).starting_city && (
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500">{t('tripDetail.startingCity')}</span>
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
            <p className="font-medium text-slate-900 dark:text-white mb-2">{t('tripDetail.meetingPlace')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              {trip.meeting_place_name && (
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">EN</span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium">{trip.meeting_place_name}</p>
                </div>
              )}
              {(trip as any).meeting_place_name_ar && (
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">AR</span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium" dir="rtl">{(trip as any).meeting_place_name_ar}</p>
                </div>
              )}
            </div>
            {trip.meeting_location && (
              <a href={trip.meeting_location} target="_blank" rel="noreferrer" className="text-sky-600 dark:text-sky-400 hover:underline break-all">{trip.meeting_location}</a>
            )}
            {trip.meeting_time && <p className="text-slate-500 dark:text-slate-400 mt-1">{new Date(trip.meeting_time).toLocaleString()}</p>}
          </div>
        )}
      </div>

      {/* Destinations + Amenities */}
      {(tripDestinations.length > 0 || (!trip.is_packaged_trip && trip.amenities && trip.amenities.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tripDestinations.length > 0 && (
            <div className={`${cardCls} p-5`}>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{t('tripDetail.destinations')}</h3>
              <div className="flex flex-wrap gap-2">
                {tripDestinations.map(td => (
                  <span key={td.id} className="px-3 py-1 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800/40 rounded-full text-sm text-sky-700 dark:text-sky-400">
                    {td.destination?.name_en || t('tripDetail.unknown')}{td.place ? ` → ${td.place.name_en}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!trip.is_packaged_trip && trip.amenities && trip.amenities.length > 0 && (
            <div className={`${cardCls} p-5`}>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{t('tripDetail.amenities')}</h3>
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
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{t('tripDetail.images')}</h3>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {trip.images.map((url, i) => (
              <img key={i} src={url} alt="" className="w-full h-24 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(url, '_blank')} />
            ))}
          </div>
        </div>
      )}

      {/* Extra Fees */}
      {trip.extra_fees && trip.extra_fees.length > 0 && (
        <div className={`${cardCls} p-5`}>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{t('tripDetail.additionalFees', { count: trip.extra_fees.length })}</h3>
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
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">{t('tripDetail.mandatory')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Required Fields — simple (non-packaged) trips only */}
      {!trip.is_packaged_trip && (
        <div className={cardCls}>
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('tripDetail.requiredFields', { count: (trip.simple_trip_required_fields ?? []).length })}
            </h2>
          </div>
          <div className="p-6">
            {(trip.simple_trip_required_fields ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">{t('tripDetail.noRequiredFields')}</p>
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
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('tripDetail.bookingTiers', { count: trip.packages.length })}</h2>
          </div>
          <div className="p-6">
            {trip.packages.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
                {t('tripDetail.noTiers')}
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
                        {pkg.max_participants != null && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t('tripDetail.maxParticipantsValue', { count: pkg.max_participants })}</p>}
                        {pkg.is_refundable != null && <p className="text-xs mt-0.5"><span className={pkg.is_refundable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{pkg.is_refundable ? t('tripDetail.refundableShort') : t('tripDetail.nonRefundableShort')}</span></p>}
                        {pkg.amenities && pkg.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {pkg.amenities.map(a => <span key={a} className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-full text-xs text-emerald-700 dark:text-emerald-400">{t(`amenity.${a}`, a)}</span>)}
                          </div>
                        )}
                      </div>
                      <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${pkg.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{pkg.is_active ? t('tripDetail.active') : t('tripDetail.inactive')}</span>
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
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('tripDetail.broadcastUpdates', { count: tripUpdates.filter(u => !u.registration_id).length })}</h2>
          <button onClick={() => { setSendTarget('all'); setShowSendForm(v => !v); setSendError(null); setSendSuccess(null); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${showSendForm && sendTarget === 'all' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' : 'bg-sky-500 hover:bg-sky-600 text-white'}`}>
            {showSendForm && sendTarget === 'all' ? t('tripDetail.cancel') : t('tripDetail.sendToAll')}
          </button>
        </div>
        <div className="p-6">
          {showSendForm && sendTarget === 'all' && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-4 space-y-3">
              {sendError && <p className="text-red-600 dark:text-red-400 text-sm">{sendError}</p>}
              {sendSuccess && <p className="text-emerald-600 dark:text-emerald-400 text-sm">{sendSuccess}</p>}
              <input type="text" placeholder={t('tripDetail.title')} value={updateTitle} onChange={e => setUpdateTitle(e.target.value)} className={inputCls} />
              <textarea placeholder={t('tripDetail.message')} value={updateMessage} onChange={e => setUpdateMessage(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 cursor-pointer hover:border-sky-400 transition-colors text-xs text-slate-500 dark:text-slate-400 flex-1 min-w-0">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  <span className="truncate">{updateFile ? updateFile.name : t('tripDetail.attachFile')}</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setUpdateFile(e.target.files?.[0] ?? null)} />
                </label>
                {updateFile && <button onClick={() => setUpdateFile(null)} className="text-xs text-red-500 flex-shrink-0">✕</button>}
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-red-600 dark:text-red-400">
                  <input type="checkbox" checked={updateImportant} onChange={e => setUpdateImportant(e.target.checked)} className="accent-red-500" />
                  {t('tripDetail.markImportant')}
                </label>
                <button onClick={handleSendUpdate} disabled={sending || !updateTitle.trim() || !updateMessage.trim()}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors">
                  {sending ? t('tripDetail.sending') : t('tripDetail.send')}
                </button>
              </div>
            </div>
          )}
          {tripUpdates.filter(u => !u.registration_id).length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-sm">{t('tripDetail.noBroadcastUpdates')}</p>
          ) : (
            <div className="space-y-3">
              {tripUpdates.filter(u => !u.registration_id).map(u => (
                <div key={u.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-900 dark:text-white">{u.title}</span>
                      {u.is_important && <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">{t('tripDetail.important')}</span>}
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
                            {att.filename || t('tripDetail.attachment')}
                          </a>
                        )
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{t('tripDetail.readCount', { read: u.read_count ?? 0, total: u.total_recipients ?? '?' })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bookings Table */}
      <div className={cardCls}>
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('tripDetail.bookings', { count: registrations.length })}</h2>
          {trip.trip_type === 'self_arranged' && (() => {
            const urgentCount = registrations.filter(r => r.status === 'awaiting_provider').length;
            return urgentCount > 0 ? (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-semibold rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                {t('tripDetail.awaitingYourAction', { count: urgentCount })}
              </span>
            ) : null;
          })()}
        </div>
        {registrations.length === 0 ? (
          <p className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">{t('tripDetail.noBookings')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('tripDetail.ref')}</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('tripDetail.name')}</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">{t('tripDetail.email')}</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">{t('tripDetail.participants')}</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">{t('tripDetail.amount')}</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('tripDetail.status')}</th>
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
                      <div className="flex flex-col gap-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit ${STATUS_COLORS[reg.status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                          {STATUS_LABELS[reg.status] ? t(STATUS_LABELS[reg.status]) : reg.status}
                        </span>
                        {reg.status === 'awaiting_provider' && (
                          <span className="text-xs text-orange-600 dark:text-orange-400">
                            {t('tripDetail.waitingDays', { count: daysSince(reg.registration_date) })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {trip.trip_type === 'self_arranged' && reg.status === 'awaiting_provider' && (
                          <button
                            onClick={() => handleStartProcessing(reg)}
                            disabled={processingAction === reg.id}
                            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {processingAction === reg.id ? '…' : t('tripDetail.startProcessing')}
                          </button>
                        )}
                        {trip.trip_type === 'self_arranged' && reg.status === 'processing' && (
                          <button
                            onClick={() => handleConfirmProcessing(reg)}
                            disabled={processingAction === reg.id}
                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {processingAction === reg.id ? '…' : t('tripDetail.markConfirmed')}
                          </button>
                        )}
                        <button onClick={() => openBooking(reg)} className="px-3 py-1.5 bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800/40 rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/40 text-xs font-medium transition-colors">
                          {t('tripDetail.view')}
                        </button>
                      </div>
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
          <div className="flex-1 bg-black/50" onClick={() => { setSelectedBooking(null); setShowSendForm(false); setShowCancelForm(false); setCancelReason(''); }} />
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full overflow-y-auto shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">{t('tripDetail.bookingDetail')}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{selectedBooking.booking_reference}</p>
              </div>
              <button onClick={() => { setSelectedBooking(null); setShowSendForm(false); setShowCancelForm(false); setCancelReason(''); }}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xl leading-none">
                &times;
              </button>
            </div>

            <div className="p-5 space-y-5 flex-1">
              {/* Booker info */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white mb-3">{t('tripDetail.bookerInformation')}</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: t('tripDetail.name'), value: selectedBooking.user_name || '—' },
                    { label: t('tripDetail.email'), value: selectedBooking.user_email || '—' },
                    { label: t('tripDetail.phone'), value: selectedBooking.user_phone || '—' },
                    { label: t('tripDetail.participants'), value: String(selectedBooking.total_participants) },
                    { label: t('tripDetail.amount'), value: `${selectedBooking.total_amount} SAR` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span className="text-xs text-slate-400 dark:text-slate-500 block">{label}</span>
                      <span className="font-medium text-slate-900 dark:text-white">{value}</span>
                    </div>
                  ))}
                  <div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">{t('tripDetail.status')}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[selectedBooking.status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                      {STATUS_LABELS[selectedBooking.status] ? t(STATUS_LABELS[selectedBooking.status]) : selectedBooking.status}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">{t('tripDetail.bookedOn')}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{new Date(selectedBooking.registration_date).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Self-arranged processing actions */}
              {trip.trip_type === 'self_arranged' && ['awaiting_provider', 'processing'].includes(selectedBooking.status) && (
                <div className={`rounded-xl p-4 border ${
                  selectedBooking.status === 'awaiting_provider'
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                }`}>
                  <h4 className={`font-semibold text-sm mb-2 ${
                    selectedBooking.status === 'awaiting_provider' ? 'text-orange-800 dark:text-orange-300' : 'text-blue-800 dark:text-blue-300'
                  }`}>
                    {selectedBooking.status === 'awaiting_provider' ? t('tripDetail.actionRequired') : t('tripDetail.orderInProgress')}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                    {selectedBooking.status === 'awaiting_provider'
                      ? t('tripDetail.awaitingProviderHelp', { days: daysSince(selectedBooking.registration_date) })
                      : t('tripDetail.processingHelp')}
                  </p>
                  {selectedBooking.status === 'awaiting_provider' && (
                    <button
                      onClick={() => handleStartProcessing(selectedBooking)}
                      disabled={processingAction === selectedBooking.id}
                      className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {processingAction === selectedBooking.id ? t('tripDetail.updating') : t('tripDetail.startProcessingOrder')}
                    </button>
                  )}
                  {selectedBooking.status === 'processing' && (
                    <button
                      onClick={() => handleConfirmProcessing(selectedBooking)}
                      disabled={processingAction === selectedBooking.id}
                      className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {processingAction === selectedBooking.id ? t('tripDetail.updating') : t('tripDetail.markAllArrangementsConfirmed')}
                    </button>
                  )}
                </div>
              )}

              {/* Cancel booking */}
              {['awaiting_provider', 'processing', 'confirmed'].includes(selectedBooking.status) && (
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm text-red-700 dark:text-red-400">{t('tripDetail.cancelBooking')}</h4>
                    <button
                      onClick={() => { setShowCancelForm(v => !v); setCancelReason(''); }}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      {showCancelForm ? t('tripDetail.dismiss') : t('tripDetail.cancelThisBooking')}
                    </button>
                  </div>
                  {showCancelForm && (
                    <div className="space-y-2 mt-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t('tripDetail.refundCalculated')}</p>
                      <textarea
                        placeholder={t('tripDetail.cancellationReasonOptional')}
                        value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                        rows={2}
                        className={`${inputCls} resize-none text-xs`}
                      />
                      <button
                        onClick={() => handleCancelBooking(selectedBooking)}
                        disabled={cancellingBooking === selectedBooking.id}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
                      >
                        {cancellingBooking === selectedBooking.id ? t('tripDetail.cancelling') : t('tripDetail.confirmCancellation')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Participants */}
              {selectedBooking.participants?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white mb-3">{t('tripDetail.participantsCount', { count: selectedBooking.participants.length })}</h4>
                  <div className="space-y-2">
                    {selectedBooking.participants.map((p: any, i: number) => {
                      const pkg = trip.packages.find((pk: TripPackage) => pk.id === p.package_id);
                      return (
                        <div key={p.id || i} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-sm">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-semibold text-slate-900 dark:text-white">{p.name || t('tripDetail.participantNumber', { count: i + 1 })}</p>
                            {pkg && (
                              <span className="px-2 py-0.5 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800/40 rounded-full text-xs text-sky-700 dark:text-sky-400 font-medium">
                                {pkg.name_en || pkg.name_ar}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-xs text-slate-500 dark:text-slate-400">
                            {p.email && <span>{p.email}</span>}
                            {p.phone && <span>{p.phone}</span>}
                            {p.date_of_birth && <span>{t('tripDetail.dob', { value: p.date_of_birth })}</span>}
                            {p.gender && <span>{t('tripDetail.gender', { value: p.gender })}</span>}
                            {p.id_iqama_number && <span>{t('tripDetail.idNumber', { value: p.id_iqama_number })}</span>}
                            {p.passport_number && <span>{t('tripDetail.passport', { value: p.passport_number })}</span>}
                            {p.nationality && <span>{t('tripDetail.nationality', { value: p.nationality })}</span>}
                            {p.medical_conditions && <span className="col-span-2">{t('tripDetail.medical', { value: p.medical_conditions })}</span>}
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
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white">{t('tripDetail.updatesForBooking')}</h4>
                  <button
                    onClick={() => { setSendTarget('booking'); setShowSendForm(v => !v); setSendError(null); setSendSuccess(null); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${showSendForm && sendTarget === 'booking' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' : 'bg-sky-500 hover:bg-sky-600 text-white'}`}
                  >
                    {showSendForm && sendTarget === 'booking' ? t('tripDetail.cancel') : t('tripDetail.sendUpdate')}
                  </button>
                </div>

                {showSendForm && sendTarget === 'booking' && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 mb-3 space-y-2">
                    {sendError && <p className="text-red-600 dark:text-red-400 text-xs">{sendError}</p>}
                    {sendSuccess && <p className="text-emerald-600 dark:text-emerald-400 text-xs">{sendSuccess}</p>}
                    <input type="text" placeholder={t('tripDetail.title')} value={updateTitle} onChange={e => setUpdateTitle(e.target.value)} className={inputCls} />
                    <textarea placeholder={t('tripDetail.message')} value={updateMessage} onChange={e => setUpdateMessage(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 cursor-pointer hover:border-sky-400 transition-colors text-xs text-slate-500 dark:text-slate-400 flex-1 min-w-0">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        <span className="truncate">{updateFile ? updateFile.name : t('tripDetail.attach')}</span>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setUpdateFile(e.target.files?.[0] ?? null)} />
                      </label>
                      {updateFile && <button onClick={() => setUpdateFile(null)} className="text-xs text-red-500">✕</button>}
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs cursor-pointer font-medium text-red-600 dark:text-red-400">
                        <input type="checkbox" checked={updateImportant} onChange={e => setUpdateImportant(e.target.checked)} className="accent-red-500" />
                        {t('tripDetail.important')}
                      </label>
                      <button onClick={handleSendUpdate} disabled={sending || !updateTitle.trim() || !updateMessage.trim()}
                        className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl text-xs font-medium transition-colors">
                        {sending ? t('tripDetail.sending') : t('tripDetail.send')}
                      </button>
                    </div>
                  </div>
                )}

                {drawerLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin w-5 h-5 rounded-full border-2 border-sky-500 border-t-transparent" />
                  </div>
                ) : bookingUpdates.length === 0 ? (
                  <p className="text-slate-400 dark:text-slate-500 text-xs">{t('tripDetail.noBookingUpdates')}</p>
                ) : (
                  <div className="space-y-2">
                    {bookingUpdates.map(u => (
                      <div key={u.id} className={`rounded-xl p-3 text-sm border ${u.registration_id ? 'border-purple-200 dark:border-purple-800/40 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-xs text-slate-900 dark:text-white">{u.title}</span>
                            {u.is_important && <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs">{t('tripDetail.important')}</span>}
                            {u.registration_id
                              ? <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs">{t('tripDetail.verifyTargeted')}</span>
                              : <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-xs">{t('tripDetail.broadcast')}</span>}
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
                                  <span className="truncate max-w-[140px]">{att.filename || t('tripDetail.attachment')}</span>
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
