import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import Layout from '../../components/layout/Layout';
import {
  ProviderFinancialsSelf,
  EarningLineRead,
  TripFinancialSummary,
  ProviderPayoutRead,
  getProviderFinancialsSummary,
  getProviderEarnings,
  getProviderTripsFinancials,
  getProviderPayouts,
} from '../../services/financialsService';

const fmtSAR = (v: string | number) =>
  `SAR ${parseFloat(String(v)).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-SA') : '—';
const fmtDatetime = (d: string | null) => d ? new Date(d).toLocaleString('en-SA') : '—';

type Tab = 'overview' | 'earnings' | 'trips' | 'payouts';

export default function ProviderFinancialsPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<ProviderFinancialsSelf | null>(null);
  const [earnings, setEarnings] = useState<EarningLineRead[]>([]);
  const [trips, setTrips] = useState<TripFinancialSummary[]>([]);
  const [payouts, setPayouts] = useState<ProviderPayoutRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');

  // Earnings filter
  const [earningsFilter, setEarningsFilter] = useState<'all' | 'owed' | 'paid'>('all');

  useEffect(() => {
    Promise.all([
      getProviderFinancialsSummary(),
      getProviderEarnings(),
      getProviderTripsFinancials(),
      getProviderPayouts(),
    ])
      .then(([s, e, t, p]) => {
        setSummary(s);
        setEarnings(e);
        setTrips(t);
        setPayouts(p);
      })
      .catch(() => setError(t('fin.loadError')))
      .finally(() => setLoading(false));
  }, []);

  const filteredEarnings = useMemo(() => {
    if (earningsFilter === 'all') return earnings;
    if (earningsFilter === 'owed') return earnings.filter(e => !e.payout_id);
    return earnings.filter(e => !!e.payout_id);
  }, [earnings, earningsFilter]);

  const owedCount = earnings.filter(e => !e.payout_id).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('fin.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('fin.subtitle')}</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl p-4 text-sm">{error}</div>
        )}

        {summary && !loading && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{t('fin.commissionRate')}</p>
                <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1">{summary.commission_rate}%</p>
                <p className="text-xs text-slate-400 mt-0.5">{t('fin.platformCutLabel')}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">{t('fin.pendingPayout')}</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{fmtSAR(summary.total_owed)}</p>
                <p className="text-xs text-amber-500 mt-0.5">{t('fin.unpaidBookings', { count: summary.unpaid_booking_count })}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-4">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wide">{t('fin.totalReceived')}</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{fmtSAR(summary.total_paid_out)}</p>
                <p className="text-xs text-emerald-500 mt-0.5">{t('fin.lastPayout', { date: fmtDate(summary.last_payout_date) })}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{t('fin.totalEarned')}</p>
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-1">{fmtSAR(summary.total_provider_earned)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t('fin.netOfCut')}</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit flex-wrap">
              {([
                ['overview', t('fin.tabOverview')],
                ['earnings', owedCount > 0 ? t('fin.tabEarningsOwed', { count: owedCount }) : t('fin.tabEarnings')],
                ['trips', t('fin.tabTrips')],
                ['payouts', t('fin.tabPayouts', { count: payouts.length })],
              ] as [Tab, string][]).map(([tabKey, label]) => (
                <button
                  key={tabKey}
                  onClick={() => setTab(tabKey)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    tab === tabKey
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {tab === 'overview' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Quick stats */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">{t('fin.earningsBreakdown')}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('fin.totalGross')}</span>
                      <span className="font-medium text-slate-900 dark:text-white">{fmtSAR(summary.total_gross_earned)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('fin.platformCut', { pct: summary.commission_rate })}</span>
                      <span className="font-medium text-red-500">−{fmtSAR(summary.total_platform_cut)}</span>
                    </div>
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between text-sm">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{t('fin.yourShare')}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{fmtSAR(summary.total_provider_earned)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('fin.paidOutSoFar')}</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">{fmtSAR(summary.total_paid_out)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-600 dark:text-amber-400 font-medium">{t('fin.stillOwed')}</span>
                      <span className="font-bold text-amber-700 dark:text-amber-300">{fmtSAR(summary.total_owed)}</span>
                    </div>
                  </div>
                </div>

                {/* Top trips */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">{t('fin.topTrips')}</h3>
                  {trips.length === 0 ? (
                    <p className="text-sm text-slate-400">{t('fin.noTripsData')}</p>
                  ) : (
                    <div className="space-y-2">
                      {[...trips]
                        .sort((a, b) => parseFloat(b.total_provider_amount) - parseFloat(a.total_provider_amount))
                        .slice(0, 5)
                        .map(tripItem => (
                          <div key={tripItem.trip_id} className="flex items-center justify-between gap-3">
                            <Link
                              href={`/financials/trips/${tripItem.trip_id}`}
                              className="text-sm text-slate-700 dark:text-slate-300 hover:text-sky-500 transition-colors truncate flex-1"
                            >
                              {tripItem.trip_name}
                            </Link>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmtSAR(tripItem.total_provider_amount)}</p>
                              {parseFloat(tripItem.owed_amount) > 0 && (
                                <p className="text-xs text-amber-500">{fmtSAR(tripItem.owed_amount)} {t('fin.owed')}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Earnings tab */}
            {tab === 'earnings' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    {(['all', 'owed', 'paid'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setEarningsFilter(f)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                          earningsFilter === f
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                      >
                        {f === 'all' ? t('fin.filterAll') : f === 'owed' ? t('fin.filterOwed') : t('fin.filterPaid')}
                      </button>
                    ))}
                  </div>
                  <span className="text-sm text-slate-500">{t('fin.records', { count: filteredEarnings.length })}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t('fin.colTrip')}</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t('fin.colBookingRef')}</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t('fin.colDateOwed')}</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">{t('fin.colGross')}</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">{t('fin.colYourShare')}</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">{t('fin.colStatus')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredEarnings.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-slate-400">{t('fin.noEarnings')}</td>
                        </tr>
                      )}
                      {filteredEarnings.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                            {e.trip_name ? (
                              <Link href={`/financials/trips/${e.trip_id}`} className="hover:text-sky-500 transition-colors">
                                {e.trip_name}
                              </Link>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">
                            {e.booking_reference ?? e.registration_id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(e.became_owed_at)}</td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{fmtSAR(e.gross_amount)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">{fmtSAR(e.provider_amount)}</td>
                          <td className="px-4 py-3 text-center">
                            {e.payout_id ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                {t('fin.statusPaidOut')}
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                                {t('fin.statusOwed')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Trips tab */}
            {tab === 'trips' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t('fin.colTrip')}</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">{t('fin.colBookings')}</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">{t('fin.colPaidOut')}</th>
                        <th className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">{t('fin.colOwed')}</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">{t('fin.colYourShare')}</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {trips.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-slate-400">{t('fin.noTripData')}</td>
                        </tr>
                      )}
                      {trips.map(trip => (
                        <tr key={trip.trip_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{trip.trip_name}</td>
                          <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">{trip.total_bookings}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-emerald-600 dark:text-emerald-400">{trip.paid_out_count}</span>
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${
                            parseFloat(trip.owed_amount) > 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-400'
                          }`}>
                            {parseFloat(trip.owed_amount) > 0 ? fmtSAR(trip.owed_amount) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fmtSAR(trip.total_provider_amount)}</td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/financials/trips/${trip.trip_id}`}
                              className="text-xs px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                            >
                              {t('fin.details')}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payouts tab */}
            {tab === 'payouts' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {payouts.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-slate-500 dark:text-slate-400">{t('fin.noPayoutsTitle')}</p>
                    <p className="text-sm text-slate-400 mt-1">{t('fin.noPayoutsDesc')}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t('fin.colDate')}</th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">{t('fin.colBookings')}</th>
                          <th className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{t('fin.colAmount')}</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t('fin.colReference')}</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t('fin.colStatus')}</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t('fin.colNote')}</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {payouts.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{fmtDatetime(p.paid_at ?? p.created_at)}</td>
                            <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">{p.booking_count}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{fmtSAR(p.total_provider_amount)}</td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.bank_transfer_reference ?? '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                p.status === 'completed'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                              }`}>
                                {p.status === 'completed' ? t('fin.statusCompleted') : t('fin.statusPending')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{p.note ?? '—'}</td>
                            <td className="px-4 py-3 text-right">
                              {p.receipt_file_url && (
                                <a
                                  href={p.receipt_file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                  {t('fin.receipt')}
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
