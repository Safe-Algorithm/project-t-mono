import { useEffect, useState } from 'react';
import { useAuth } from '@/context/UserContext';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { useTrips } from '@/hooks/useTrips';
import { Trip } from '@/types/trip';
import { formatDateInTripTz, tzLabel } from '@/utils/tripDate';

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function TripStatusBadge({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      isActive
        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
    }`}>
      {isActive ? t('dashboard.statusActive') : t('dashboard.statusInactive')}
    </span>
  );
}

const DashboardPage = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { trips, isLoading } = useTrips();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  const now = new Date();
  const activeTrips = trips.filter(t => t.is_active && new Date(t.start_date) > now);
  const totalTrips = trips.length;
  const totalParticipants = trips.reduce((sum, t) => sum + (t.max_participants ?? 0), 0);
  const upcomingTrips = trips
    .filter(t => new Date(t.start_date) > now)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 5);

  const formatDate = (dateStr: string, tz?: string) =>
    formatDateInTripTz(dateStr, tz ?? 'Asia/Riyadh');

  const getTripName = (trip: Trip) =>
    (isRTL ? trip.name_ar || trip.name_en : trip.name_en || trip.name_ar) || '—';

  return (
    <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('dashboard.welcomeBack', { name: user.company_name || user.name })}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('dashboard.summary')}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label={t('dashboard.totalTrips')}
          value={isLoading ? '—' : totalTrips}
          color="bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          }
        />
        <StatCard
          label={t('dashboard.activeTrips')}
          value={isLoading ? '—' : activeTrips.length}
          color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label={t('dashboard.totalSeats')}
          value={isLoading ? '—' : totalParticipants.toLocaleString()}
          color="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
      </div>

      {/* Upcoming trips table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t('dashboard.upcomingTrips')}
          </h2>
          <Link href="/trips" className="text-sm text-sky-500 hover:text-sky-600 font-medium">
            {t('dashboard.viewAll')} →
          </Link>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin w-6 h-6 rounded-full border-4 border-sky-500 border-t-transparent" />
          </div>
        ) : upcomingTrips.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t('trips.noTrips')}</p>
            <Link href="/trips/new" className="mt-3 inline-block text-sm text-sky-500 hover:text-sky-600 font-medium">
              {t('trips.createNew')} →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {t('dashboard.trip')}
                  </th>
                  <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {t('dashboard.tripStartDate')}
                  </th>
                  <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {t('dashboard.seats')}
                  </th>
                  <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {isRTL ? 'الحالة' : 'Status'}
                  </th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {upcomingTrips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                      {getTripName(trip)}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400">
                      {formatDate(trip.start_date, trip.timezone)} <span className="text-xs text-slate-400">({tzLabel(trip.timezone ?? 'Asia/Riyadh')})</span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400">
                      {trip.max_participants}
                    </td>
                    <td className="px-6 py-3.5">
                      <TripStatusBadge isActive={trip.is_active} />
                    </td>
                    <td className="px-6 py-3.5 text-end">
                      <Link href={`/trips/${trip.id}/edit`} className="text-sky-500 hover:text-sky-600 font-medium text-xs">
                        {t('common.edit')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/trips/new" className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4 hover:border-sky-300 dark:hover:border-sky-700 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 group-hover:bg-sky-500 group-hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white text-sm">{t('trips.createNew')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('dashboard.addTripCta')}
            </p>
          </div>
        </Link>
        <Link href="/trip-updates" className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4 hover:border-sky-300 dark:hover:border-sky-700 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white text-sm">{t('nav.tripUpdates')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('dashboard.sendUpdatesCta')}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default DashboardPage;
