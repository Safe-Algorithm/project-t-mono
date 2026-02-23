import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Trip, TripPackage, FieldMetadata, PackageRequiredField, TripAmenity } from '../../types/trip';
import { tripService } from '../../services/tripService';
import { destinationService, TripDestination } from '../../services/destinationService';
import { tripUpdateService, TripUpdate, TripUpdateCreate } from '../../services/tripUpdateService';
import { api } from '../../services/api';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { id: tripId } = router.query;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [availableFields, setAvailableFields] = useState<FieldMetadata[]>([]);
  const [tripDestinations, setTripDestinations] = useState<TripDestination[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationUser[]>([]);
  const [tripUpdates, setTripUpdates] = useState<TripUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const payload: TripUpdateCreate = { title: updateTitle, message: updateMessage, is_important: updateImportant };
      if (sendTarget === 'all') {
        await tripUpdateService.sendToAll(tripId as string, payload);
      } else if (selectedBooking) {
        await tripUpdateService.sendToRegistration(selectedBooking.id, payload);
      }
      setSendSuccess('Update sent successfully');
      setUpdateTitle('');
      setUpdateMessage('');
      setUpdateImportant(false);
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

  const confirmedCount = registrations.filter(r => r.status === 'confirmed').length;
  const pendingCount = registrations.filter(r => r.status === 'pending_payment' || r.status === 'pending').length;
  const availableSpots = trip ? trip.max_participants - registrations.filter(r => ['confirmed', 'pending_payment'].includes(r.status)).reduce((sum, r) => sum + r.total_participants, 0) : 0;

  if (loading) return <div className="p-8 text-gray-500">{t('status.loading')}</div>;
  if (error) return <div className="p-8 text-red-500">{t('status.error')}: {error}</div>;
  if (!trip) return <div className="p-8 text-gray-500">{t('status.notFound')}</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">{trip.name_en || trip.name_ar}</h1>
          {trip.name_ar && <p className="text-lg text-gray-500 mt-1" dir="rtl">{trip.name_ar}</p>}
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${trip.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{trip.is_active ? 'Active' : 'Inactive'}</span>
            {trip.is_international && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">International</span>}
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${trip.is_packaged_trip ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700'}`}>
              {trip.is_packaged_trip ? '📦 Packaged' : '🎫 Simple'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push(`/trips/${tripId}/edit`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">{t('action.editTrip')}</button>
          <button onClick={() => router.push('/trips')} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium">{t('action.backToTrips')}</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Bookings', value: registrations.length, color: 'text-gray-900 dark:text-white' },
          { label: 'Confirmed', value: confirmedCount, color: 'text-green-600' },
          { label: 'Pending Payment', value: pendingCount, color: 'text-yellow-600' },
          { label: 'Available Spots', value: Math.max(0, availableSpots), color: availableSpots <= 5 ? 'text-red-600' : 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Trip Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Trip Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500">Start Date</span><p className="font-medium mt-0.5">{new Date(trip.start_date).toLocaleString()}</p></div>
          <div><span className="text-gray-500">End Date</span><p className="font-medium mt-0.5">{new Date(trip.end_date).toLocaleString()}</p></div>
          <div><span className="text-gray-500">Registration Deadline</span><p className="font-medium mt-0.5">{trip.registration_deadline ? new Date(trip.registration_deadline).toLocaleString() : '—'}</p></div>
          <div><span className="text-gray-500">Max Participants</span><p className="font-medium mt-0.5">{trip.max_participants}</p></div>
          {!trip.is_packaged_trip && (
            <div><span className="text-gray-500">Refundable</span><p className={`font-medium mt-0.5 ${trip.is_refundable ? 'text-green-600' : 'text-red-600'}`}>{trip.is_refundable ? 'Yes' : 'No'}</p></div>
          )}
          {(trip as any).starting_city && <div><span className="text-gray-500">Starting City</span><p className="font-medium mt-0.5">📍 {(trip as any).starting_city.name_en}</p></div>}
        </div>
        {(trip.description_en || trip.description_ar) && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            {trip.description_en && <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{trip.description_en}</p>}
            {trip.description_ar && <p className="text-sm text-gray-500" dir="rtl">{trip.description_ar}</p>}
          </div>
        )}
        {trip.has_meeting_place && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-sm font-medium mb-1">Meeting Place</p>
            {trip.meeting_location && <p className="text-sm">📍 {trip.meeting_location}</p>}
            {trip.meeting_time && <p className="text-sm">🕐 {new Date(trip.meeting_time).toLocaleString()}</p>}
          </div>
        )}
      </div>

      {/* Destinations + Amenities (amenities only shown for non-packaged trips at trip level) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {tripDestinations.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold mb-3">Destinations</h3>
            <div className="flex flex-wrap gap-2">
              {tripDestinations.map(td => (
                <span key={td.id} className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-800">
                  {td.destination?.name_en || 'Unknown'}{td.place ? ` → ${td.place.name_en}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
        {!trip.is_packaged_trip && trip.amenities && trip.amenities.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold mb-3">Amenities</h3>
            <div className="flex flex-wrap gap-2">
              {trip.amenities.map(a => (
                <span key={a} className="px-3 py-1 bg-green-50 border border-green-200 rounded-full text-sm text-green-800">✓ {amenityLabels[a] || a}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Images */}
      {trip.images && trip.images.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h3 className="font-semibold mb-3">Images</h3>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {trip.images.map((url, i) => (
              <img key={i} src={url} alt="" className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-80" onClick={() => window.open(url, '_blank')} />
            ))}
          </div>
        </div>
      )}

      {/* Packages (only for packaged trips) */}
      {trip.is_packaged_trip && (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Packages ({trip.packages.length})</h2>
        {trip.packages.length === 0 ? (
          <p className="text-yellow-600 text-sm">⚠ No packages yet. Add at least 2 packages for a packaged trip.</p>
        ) : (
          <div className="space-y-3">
            {trip.packages.map(pkg => (
              <div key={pkg.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">{pkg.name_en || pkg.name_ar}</h4>
                    {pkg.name_ar && <p className="text-sm text-gray-500" dir="rtl">{pkg.name_ar}</p>}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{pkg.description_en || pkg.description_ar}</p>
                    <p className="text-sm font-bold mt-1">{pkg.price} {pkg.currency || 'SAR'}</p>
                    {pkg.max_participants != null && <p className="text-xs text-gray-500 mt-0.5">Max: {pkg.max_participants} participants</p>}
                    {pkg.is_refundable != null && <p className="text-xs mt-0.5"><span className={pkg.is_refundable ? 'text-green-600' : 'text-red-600'}>{pkg.is_refundable ? '✓ Refundable' : '✗ Non-refundable'}</span></p>}
                    {pkg.amenities && pkg.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pkg.amenities.map(a => <span key={a} className="px-1.5 py-0.5 bg-green-50 border border-green-200 rounded text-xs text-green-700">{amenityLabels[a] || a}</span>)}
                      </div>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${pkg.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{pkg.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                {pkg.required_fields?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {pkg.required_fields.map((f: string) => (
                      <span key={f} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{getFieldDisplayName(f)}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Broadcast Updates */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Broadcast Updates ({tripUpdates.filter(u => !u.registration_id).length})</h2>
          <button
            onClick={() => { setSendTarget('all'); setShowSendForm(v => !v); setSendError(null); setSendSuccess(null); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            {showSendForm && sendTarget === 'all' ? 'Cancel' : 'Send to All'}
          </button>
        </div>
        {showSendForm && sendTarget === 'all' && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
            {sendError && <p className="text-red-600 text-sm mb-2">{sendError}</p>}
            {sendSuccess && <p className="text-green-600 text-sm mb-2">{sendSuccess}</p>}
            <input type="text" placeholder="Title" value={updateTitle} onChange={e => setUpdateTitle(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-2 dark:bg-gray-600 dark:border-gray-500" />
            <textarea placeholder="Message" value={updateMessage} onChange={e => setUpdateMessage(e.target.value)} rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-2 dark:bg-gray-600 dark:border-gray-500 resize-none" />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={updateImportant} onChange={e => setUpdateImportant(e.target.checked)} />
                <span className="text-red-600 font-medium">Mark as Important</span>
              </label>
              <button onClick={handleSendUpdate} disabled={sending || !updateTitle.trim() || !updateMessage.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}
        {tripUpdates.filter(u => !u.registration_id).length === 0 ? (
          <p className="text-gray-500 text-sm">No broadcast updates sent yet.</p>
        ) : (
          <div className="space-y-3">
            {tripUpdates.filter(u => !u.registration_id).map(u => (
              <div key={u.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{u.title}</span>
                    {u.is_important && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">Important</span>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(u.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{u.message}</p>
                <p className="text-xs text-gray-400 mt-1">Read: {u.read_count ?? 0} / {u.total_recipients ?? '?'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bookings Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Bookings ({registrations.length})</h2>
        {registrations.length === 0 ? (
          <p className="text-gray-500 text-sm">No bookings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                  <th className="py-2 px-3 text-gray-500 font-medium">Booking Ref</th>
                  <th className="py-2 px-3 text-gray-500 font-medium">Name</th>
                  <th className="py-2 px-3 text-gray-500 font-medium">Email</th>
                  <th className="py-2 px-3 text-gray-500 font-medium">Phone</th>
                  <th className="py-2 px-3 text-gray-500 font-medium">Participants</th>
                  <th className="py-2 px-3 text-gray-500 font-medium">Amount</th>
                  <th className="py-2 px-3 text-gray-500 font-medium">Status</th>
                  <th className="py-2 px-3 text-gray-500 font-medium">Date</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {registrations.map(reg => (
                  <tr key={reg.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-2 px-3 font-mono text-xs">{reg.booking_reference}</td>
                    <td className="py-2 px-3 font-medium">{reg.user_name || '—'}</td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{reg.user_email || '—'}</td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{reg.user_phone || '—'}</td>
                    <td className="py-2 px-3 text-center">{reg.total_participants}</td>
                    <td className="py-2 px-3">{reg.total_amount} SAR</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[reg.status] || 'bg-gray-100 text-gray-700'}`}>
                        {reg.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{new Date(reg.registration_date).toLocaleDateString()}</td>
                    <td className="py-2 px-3">
                      <button onClick={() => openBooking(reg)} className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 text-xs font-medium">
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
          <div className="flex-1 bg-black bg-opacity-40" onClick={() => { setSelectedBooking(null); setShowSendForm(false); }} />
          <div className="w-full max-w-xl bg-white dark:bg-gray-900 h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="font-bold text-lg">Booking Detail</h3>
                <p className="text-xs text-gray-500 font-mono">{selectedBooking.booking_reference}</p>
              </div>
              <button onClick={() => { setSelectedBooking(null); setShowSendForm(false); }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-4 space-y-4 flex-1">
              {/* Booker info */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-3">Booker Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500 block text-xs">Name</span><span className="font-medium">{selectedBooking.user_name || '—'}</span></div>
                  <div><span className="text-gray-500 block text-xs">Email</span><span className="font-medium">{selectedBooking.user_email || '—'}</span></div>
                  <div><span className="text-gray-500 block text-xs">Phone</span><span className="font-medium">{selectedBooking.user_phone || '—'}</span></div>
                  <div><span className="text-gray-500 block text-xs">Status</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[selectedBooking.status] || 'bg-gray-100 text-gray-700'}`}>
                      {selectedBooking.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div><span className="text-gray-500 block text-xs">Participants</span><span className="font-medium">{selectedBooking.total_participants}</span></div>
                  <div><span className="text-gray-500 block text-xs">Amount</span><span className="font-medium">{selectedBooking.total_amount} SAR</span></div>
                  <div className="col-span-2"><span className="text-gray-500 block text-xs">Booked On</span><span className="font-medium">{new Date(selectedBooking.registration_date).toLocaleString()}</span></div>
                </div>
              </div>

              {/* Participants */}
              {selectedBooking.participants?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Participants ({selectedBooking.participants.length})</h4>
                  <div className="space-y-2">
                    {selectedBooking.participants.map((p: any, i: number) => {
                      const pkg = trip.packages.find((pk: TripPackage) => pk.id === p.package_id);
                      return (
                        <div key={p.id || i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-medium">{p.name || `Participant ${i + 1}`}</p>
                            {pkg && (
                              <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 font-medium">
                                📦 {pkg.name_en || pkg.name_ar}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-1 mt-1 text-xs text-gray-500">
                            {p.email && <span>✉ {p.email}</span>}
                            {p.phone && <span>📞 {p.phone}</span>}
                            {p.date_of_birth && <span>🎂 {p.date_of_birth}</span>}
                            {p.gender && <span>👤 {p.gender}</span>}
                            {p.id_iqama_number && <span>🪪 {p.id_iqama_number}</span>}
                            {p.passport_number && <span>📘 {p.passport_number}</span>}
                            {p.nationality && <span>🌍 {p.nationality}</span>}
                            {p.medical_conditions && <span>🏥 {p.medical_conditions}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Updates for this booking */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-sm">Updates for this Booking</h4>
                  <button
                    onClick={() => { setSendTarget('booking'); setShowSendForm(v => !v); setSendError(null); setSendSuccess(null); }}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                  >
                    {showSendForm && sendTarget === 'booking' ? 'Cancel' : 'Send Update'}
                  </button>
                </div>

                {showSendForm && sendTarget === 'booking' && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-3">
                    {sendError && <p className="text-red-600 text-xs mb-2">{sendError}</p>}
                    {sendSuccess && <p className="text-green-600 text-xs mb-2">{sendSuccess}</p>}
                    <input type="text" placeholder="Title" value={updateTitle} onChange={e => setUpdateTitle(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm mb-2 dark:bg-gray-600 dark:border-gray-500" />
                    <textarea placeholder="Message" value={updateMessage} onChange={e => setUpdateMessage(e.target.value)} rows={3}
                      className="w-full border rounded px-3 py-2 text-sm mb-2 dark:bg-gray-600 dark:border-gray-500 resize-none" />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={updateImportant} onChange={e => setUpdateImportant(e.target.checked)} />
                        <span className="text-red-600 font-medium">Important</span>
                      </label>
                      <button onClick={handleSendUpdate} disabled={sending || !updateTitle.trim() || !updateMessage.trim()}
                        className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs font-medium">
                        {sending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}

                {drawerLoading ? (
                  <p className="text-gray-500 text-xs">Loading updates…</p>
                ) : bookingUpdates.length === 0 ? (
                  <p className="text-gray-500 text-xs">No updates for this booking.</p>
                ) : (
                  <div className="space-y-2">
                    {bookingUpdates.map(u => (
                      <div key={u.id} className={`rounded-lg p-3 text-sm border ${u.registration_id ? 'border-purple-200 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 bg-gray-50 dark:bg-gray-800'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-xs">{u.title}</span>
                            {u.is_important && <span className="px-1 py-0.5 bg-red-100 text-red-700 rounded text-xs">Important</span>}
                            {u.registration_id ? <span className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Targeted</span> : <span className="px-1 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">Broadcast</span>}
                          </div>
                          <span className="text-xs text-gray-400">{new Date(u.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{u.message}</p>
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
