import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  EarningLineRead,
  ProviderFinancialSummary,
  ProviderPayoutRead,
  TripFinancialSummary,
  PayoutCreate,
  PayoutComplete,
  getProviderOwedLines,
  getProviderFinancialSummary,
  getProviderTripsSummary,
  listAllPayouts,
  createPayout,
  completePayout,
  updateCommissionRate,
} from '../../../services/financialsService';

const fmtSAR = (v: string | number) =>
  `SAR ${parseFloat(String(v)).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-SA') : '—';
const fmtDatetime = (d: string | null) => d ? new Date(d).toLocaleString('en-SA') : '—';

// Group earning lines by trip
function groupByTrip(lines: EarningLineRead[]): Record<string, EarningLineRead[]> {
  const groups: Record<string, EarningLineRead[]> = {};
  for (const line of lines) {
    const key = line.trip_id;
    if (!groups[key]) groups[key] = [];
    groups[key].push(line);
  }
  return groups;
}

type Tab = 'pending' | 'trips' | 'history';

export default function ProviderFinancialsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const providerId = router.query.id as string;

  const [summary, setSummary] = useState<ProviderFinancialSummary | null>(null);
  const [owedLines, setOwedLines] = useState<EarningLineRead[]>([]);
  const [tripsSummary, setTripsSummary] = useState<TripFinancialSummary[]>([]);
  const [payouts, setPayouts] = useState<ProviderPayoutRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('pending');

  // Commission editing
  const [editCommission, setEditCommission] = useState(false);
  const [commissionInput, setCommissionInput] = useState('');
  const [commissionSaving, setCommissionSaving] = useState(false);

  // Selected lines for payout
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Payout modal
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutForm, setPayoutForm] = useState<{ note: string; bankRef: string }>({ note: '', bankRef: '' });
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState('');

  const fetchData = async () => {
    if (!providerId) return;
    setLoading(true);
    try {
      const [s, lines, trips, p] = await Promise.all([
        getProviderFinancialSummary(providerId),
        getProviderOwedLines(providerId),
        getProviderTripsSummary(providerId),
        listAllPayouts(providerId),
      ]);
      setSummary(s);
      setOwedLines(lines);
      setTripsSummary(trips);
      setSelectedIds(new Set(lines.map(l => l.id)));
      setCommissionInput(s.commission_rate);
      setPayouts(p);
    } catch {
      setError(t('fin.providerLoadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [providerId]);

  const tripGroups = useMemo(() => groupByTrip(owedLines), [owedLines]);

  const selectedLines = owedLines.filter(l => selectedIds.has(l.id));
  const selectedTotal = selectedLines.reduce((s, l) => s + parseFloat(l.provider_amount), 0);

  const toggleLine = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleTripGroup = (tripId: string) => {
    const lineIds = (tripGroups[tripId] ?? []).map(l => l.id);
    const allSelected = lineIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const n = new Set(prev);
      lineIds.forEach(id => allSelected ? n.delete(id) : n.add(id));
      return n;
    });
  };

  const handleSaveCommission = async () => {
    if (!providerId) return;
    const rate = parseFloat(commissionInput);
    if (isNaN(rate) || rate < 0 || rate > 100) return;
    setCommissionSaving(true);
    try {
      await updateCommissionRate(providerId, rate);
      await fetchData();
      setEditCommission(false);
    } catch {
      // ignore — keep editing
    } finally {
      setCommissionSaving(false);
    }
  };

  const handleCreatePayout = async () => {
    if (!providerId || selectedLines.length === 0) return;
    setPayoutLoading(true);
    setPayoutError('');
    try {
      const payload: PayoutCreate = {
        earning_line_ids: Array.from(selectedIds),
        note: payoutForm.note || undefined,
        bank_transfer_reference: payoutForm.bankRef || undefined,
      };
      const payout = await createPayout(providerId, payload);
      // Immediately complete it (admin confirms bank transfer in one step)
      const completePayload: PayoutComplete = {
        note: payoutForm.note || undefined,
        bank_transfer_reference: payoutForm.bankRef || undefined,
      };
      await completePayout(payout.id, completePayload);
      setShowPayoutModal(false);
      setPayoutForm({ note: '', bankRef: '' });
      await fetchData();
    } catch (e: unknown) {
      setPayoutError(e instanceof Error ? e.message : 'Failed to record payout');
    } finally {
      setPayoutLoading(false);
    }
  };

  return (
    <>
    <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/financials" className="hover:text-sky-500 transition-colors">{t('fin.title')}</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-900 dark:text-white font-medium">{summary?.provider_name ?? 'Provider'}</span>
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
            {/* Header + commission */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{summary.provider_name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-slate-500 dark:text-slate-400">{t('fin.commissionRate')}:</span>
                    {editCommission ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={commissionInput}
                          onChange={e => setCommissionInput(e.target.value)}
                          className="w-20 text-sm px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <span className="text-sm text-slate-500">%</span>
                        <button
                          onClick={handleSaveCommission}
                          disabled={commissionSaving}
                          className="text-xs px-2 py-1 rounded-lg bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50 transition-colors"
                        >
                          {commissionSaving ? t('fin.saving') : t('fin.save')}
                        </button>
                        <button
                          onClick={() => { setEditCommission(false); setCommissionInput(summary.commission_rate); }}
                          className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditCommission(true)}
                        className="flex items-center gap-1 text-sm font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        {summary.commission_rate}%
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{t('fin.owedNow')}</p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmtSAR(summary.total_owed)}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">{t('fin.bookings', { count: summary.unpaid_booking_count })}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t('fin.totalPaid')}</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{fmtSAR(summary.total_paid_out)}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500">
                    {t('fin.lastPayout', { date: fmtDate(summary.last_payout_date) })}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                  <p className="text-xs text-slate-500 font-medium">{t('fin.providerEarned')}</p>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{fmtSAR(summary.total_provider_earned)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                  <p className="text-xs text-slate-500 font-medium">{t('fin.platformCut')}</p>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{fmtSAR(summary.total_platform_cut)}</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
              {(['pending', 'trips', 'history'] as Tab[]).map(tabKey => (
                <button
                  key={tabKey}
                  onClick={() => setTab(tabKey)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    tab === tabKey
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {tabKey === 'pending'
                    ? (owedLines.length > 0 ? t('fin.tabPendingCount', { count: owedLines.length }) : t('fin.tabPending'))
                    : tabKey === 'trips' ? t('fin.tabTrips') : t('fin.tabHistory')}
                </button>
              ))}
            </div>

            {/* Pending Payout Tab */}
            {tab === 'pending' && (
              <div className="space-y-4">
                {owedLines.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 font-medium">{t('fin.noPendingTitle')}</p>
                    <p className="text-sm text-slate-400 mt-1">{t('fin.noPendingDesc')}</p>
                  </div>
                ) : (
                  <>
                    {/* Pay button bar */}
                    <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                      <div>
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                          {t('fin.selectedBookings', { selected: selectedIds.size, total: owedLines.length })}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {t('fin.totalToPay')} <span className="font-bold">{fmtSAR(selectedTotal)}</span>
                        </p>
                      </div>
                      <button
                        disabled={selectedIds.size === 0}
                        onClick={() => setShowPayoutModal(true)}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-sm"
                      >
                        {t('fin.payButton', { name: summary.provider_name, amount: fmtSAR(selectedTotal) })}
                      </button>
                    </div>

                    {/* Grouped by trip */}
                    {Object.entries(tripGroups).map(([tripId, lines]) => {
                      const tripTotal = lines.reduce((s, l) => s + parseFloat(l.provider_amount), 0);
                      const selectedCount = lines.filter(l => selectedIds.has(l.id)).length;
                      const allTripSelected = selectedCount === lines.length;
                      const tripName = lines[0]?.trip_name ?? 'Unknown Trip';
                      return (
                        <div key={tripId} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                          {/* Trip header */}
                          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                            <input
                              type="checkbox"
                              checked={allTripSelected}
                              onChange={() => toggleTripGroup(tripId)}
                              className="w-4 h-4 rounded accent-sky-500"
                            />
                            <div className="flex-1">
                              <Link href={`/financials/trips/${tripId}`} className="font-semibold text-slate-900 dark:text-white hover:text-sky-500 transition-colors">
                                {tripName}
                              </Link>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {lines.length} booking{lines.length !== 1 ? 's' : ''} · {selectedCount} selected
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{fmtSAR(tripTotal)}</span>
                          </div>

                          {/* Bookings */}
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-100 dark:border-slate-800">
                                <th className="px-4 py-2 w-8" />
                                <th className="px-4 py-2 text-left font-medium text-slate-500">{t('fin.colBookingRef')}</th>
                                <th className="px-4 py-2 text-left font-medium text-slate-500">{t('fin.colDate')}</th>
                                <th className="px-4 py-2 text-right font-medium text-slate-500">{t('fin.colGross')}</th>
                                <th className="px-4 py-2 text-right font-medium text-slate-500">{t('fin.colCut', { pct: lines[0]?.platform_cut_pct })}</th>
                                <th className="px-4 py-2 text-right font-medium text-slate-500">{t('fin.colProviderShare')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {lines.map(line => (
                                <tr key={line.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${selectedIds.has(line.id) ? '' : 'opacity-50'}`}>
                                  <td className="px-4 py-2.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(line.id)}
                                      onChange={() => toggleLine(line.id)}
                                      className="w-4 h-4 rounded accent-sky-500"
                                    />
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                                    {line.booking_reference ?? line.registration_id.slice(0, 8)}
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs">
                                    {fmtDate(line.booking_date)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-400">{fmtSAR(line.gross_amount)}</td>
                                  <td className="px-4 py-2.5 text-right text-red-500 dark:text-red-400">−{fmtSAR(line.platform_cut_amount)}</td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{fmtSAR(line.provider_amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* Trips Tab */}
            {tab === 'trips' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="font-semibold text-slate-900 dark:text-white">{t('fin.tripBreakdownTitle')}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{t('fin.tripBreakdownDesc')}</p>
                </div>
                {tripsSummary.length === 0 ? (
                  <div className="p-10 text-center text-slate-400">{t('fin.noTripData')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t('fin.colTrip')}</th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">{t('fin.colBookings')}</th>
                          <th className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{t('fin.colPaidOut')}</th>
                          <th className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">{t('fin.colOwed')}</th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">{t('fin.colProviderShare')}</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {tripsSummary.map(trip => (
                          <tr key={trip.trip_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{trip.trip_name}</td>
                            <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">{trip.total_bookings}</td>
                            <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{fmtSAR(trip.paid_out_amount)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">{fmtSAR(trip.owed_amount)}</td>
                            <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{fmtSAR(trip.total_provider_amount)}</td>
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
                )}
              </div>
            )}

            {/* Payout History Tab */}
            {tab === 'history' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="font-semibold text-slate-900 dark:text-white">{t('fin.payoutHistoryTitle')}</h2>
                </div>
                {payouts.length === 0 ? (
                  <div className="p-10 text-center text-slate-400">{t('fin.noPayouts')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t('fin.colPaidAt')}</th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">{t('fin.colBookings')}</th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">{t('fin.colAmount')}</th>
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
                            <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{fmtSAR(p.total_provider_amount)}</td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.bank_transfer_reference ?? '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                p.status === 'completed'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                              }`}>
                                {p.status === 'completed' ? t('fin.statusCompleted') : t('fin.statusPending')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">{p.note ?? '—'}</td>
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
      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('fin.modalTitle')}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {t('fin.modalDesc', { count: selectedIds.size, amount: fmtSAR(selectedTotal), name: summary?.provider_name })}
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('fin.bankRefOptional')}
                </label>
                <input
                  type="text"
                  value={payoutForm.bankRef}
                  onChange={e => setPayoutForm(f => ({ ...f, bankRef: e.target.value }))}
                  placeholder={t('fin.bankRefPlaceholder')}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('fin.noteLabelOptional')}
                </label>
                <textarea
                  value={payoutForm.note}
                  onChange={e => setPayoutForm(f => ({ ...f, note: e.target.value }))}
                  rows={3}
                  placeholder={t('fin.notePlaceholder')}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>
              {payoutError && (
                <p className="text-sm text-red-600 dark:text-red-400">{payoutError}</p>
              )}
            </div>
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex gap-3 justify-end">
              <button
                onClick={() => { setShowPayoutModal(false); setPayoutError(''); }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreatePayout}
                disabled={payoutLoading || selectedIds.size === 0}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                {payoutLoading ? t('fin.recording') : t('fin.confirmPayout', { amount: fmtSAR(selectedTotal) })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
