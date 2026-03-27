import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import Layout from '../../../components/layout/Layout';
import {
  TripFinancialDetail,
  TripEarningStatus,
  getProviderTripFinancialDetail,
} from '../../../services/financialsService';

const fmtSAR = (v: string | number) =>
  `SAR ${parseFloat(String(v)).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-SA') : '—';

const STATUS_CLASSES: Record<string, string> = {
  paid_out: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  owed: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  refundable: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  cancelled: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
};

export default function ProviderTripFinancialDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const tripId = router.query.id as string;

  const [detail, setDetail] = useState<TripFinancialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | TripEarningStatus['status']>('all');

  useEffect(() => {
    if (!tripId) return;
    getProviderTripFinancialDetail(tripId)
      .then(setDetail)
      .catch(() => setError(t('fin.loadError')))
      .finally(() => setLoading(false));
  }, [tripId]);

  const bookings = detail?.bookings.filter(b => filter === 'all' || b.status === filter) ?? [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/financials" className="hover:text-sky-500 transition-colors">{t('fin.title')}</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link href="/financials" className="hover:text-sky-500 transition-colors">{t('fin.tabTrips')}</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-900 dark:text-white font-medium">{detail?.trip_name ?? 'Trip'}</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl p-4 text-sm">{error}</div>
        )}

        {detail && !loading && (
          <>
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{detail.trip_name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 mb-4">{t('fin.totalBookings', { count: detail.total_bookings })}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t('fin.paidOutCard')}</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{fmtSAR(detail.paid_out_amount)}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500">{t('fin.bookings', { count: detail.paid_out_count })}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{t('fin.owedCard')}</p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmtSAR(detail.owed_amount)}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">{t('fin.bookings', { count: detail.owed_count })}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{t('fin.refundableCard')}</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{detail.refundable_count}</p>
                  <p className="text-xs text-blue-500">{t('fin.colBookings')}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                  <p className="text-xs text-slate-500 font-medium">{t('fin.yourTotalShare')}</p>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{fmtSAR(detail.total_provider_amount)}</p>
                  <p className="text-xs text-slate-400">net of {detail.bookings[0]
                    ? `${(parseFloat(detail.total_platform_cut) / parseFloat(detail.total_gross) * 100).toFixed(1)}%`
                    : '—'} cut</p>
                </div>
              </div>
            </div>

            {/* Note: provider view doesn't show user PII */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {t('fin.privacyNote')}
              </p>
            </div>

            {/* Filter */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit flex-wrap">
              {(['all', 'paid_out', 'owed', 'refundable', 'cancelled'] as const).map(f => {
                const count = f === 'all'
                  ? detail.total_bookings
                  : f === 'paid_out' ? detail.paid_out_count
                  : f === 'owed' ? detail.owed_count
                  : f === 'refundable' ? detail.refundable_count
                  : detail.cancelled_count;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filter === f
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {f === 'all' ? t('fin.filterAll') : f === 'paid_out' ? t('fin.statusPaidOut') : f === 'owed' ? t('fin.statusOwed') : f === 'refundable' ? t('fin.statusRefundable') : t('fin.statusCancelled')} ({count})
                  </button>
                );
              })}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t('fin.colBookingRef')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t('fin.colBookingDate')}</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">{t('fin.colGross')}</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">{t('fin.colPlatformCut')}</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">{t('fin.colYourShare')}</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">{t('fin.colStatus')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t('fin.colPaidOutAt')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {bookings.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-400">{t('fin.noBookingsFilter')}</td>
                      </tr>
                    )}
                    {bookings.map(b => {
                      const statusClass = STATUS_CLASSES[b.status] ?? STATUS_CLASSES.cancelled;
                      const statusLabel = b.status === 'paid_out' ? t('fin.statusPaidOut') : b.status === 'owed' ? t('fin.statusOwed') : b.status === 'refundable' ? t('fin.statusRefundable') : t('fin.statusCancelled');
                      return (
                        <tr key={b.registration_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                            {b.booking_reference ?? b.registration_id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{fmtDate(b.booking_date)}</td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{fmtSAR(b.gross_amount)}</td>
                          <td className="px-4 py-3 text-right text-red-500 dark:text-red-400">−{fmtSAR(b.platform_cut_amount)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">{fmtSAR(b.provider_amount)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {b.paid_out_at ? fmtDate(b.paid_out_at) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
