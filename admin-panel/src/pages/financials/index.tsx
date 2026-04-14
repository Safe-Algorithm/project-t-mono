import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  AdminFinancialsOverview,
  ProviderFinancialSummary,
  getFinancialsOverview,
} from '../../services/financialsService';

const fmtSAR = (v: string | number) =>
  `SAR ${parseFloat(String(v)).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const StatCard: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = 'sky' }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
    <p className={`mt-1 text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</p>
  </div>
);

export default function FinancialsOverviewPage() {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<AdminFinancialsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getFinancialsOverview()
      .then(setOverview)
      .catch(() => setError(t('fin.loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  const filtered = overview?.providers.filter(p =>
    p.provider_name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-6">
        {/* Header */}
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

        {overview && !loading && (
          <>
            {/* Grand totals */}
            <div className="grid grid-cols-2 gap-4">
              <StatCard label={t('fin.totalOwed')} value={fmtSAR(overview.grand_total_owed)} color="amber" />
              <StatCard label={t('fin.totalPaidOut')} value={fmtSAR(overview.grand_total_paid_out)} color="emerald" />
            </div>

            {/* Provider table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <input
                  type="text"
                  placeholder={t('fin.searchProviders')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t('fin.colProvider')}</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">{t('fin.colCommission')}</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">{t('fin.colTotalEarned')}</th>
                      <th className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">{t('fin.colOwedNow')}</th>
                      <th className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{t('fin.colPaidOut')}</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">{t('fin.colUnpaidBookings')}</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">{t('fin.colLastPayout')}</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-slate-400">{t('fin.noProviders')}</td>
                      </tr>
                    )}
                    {filtered.map(p => (
                      <ProviderRow key={p.provider_id} provider={p} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
    </div>
  );
}

function ProviderRow({ provider: p }: { provider: ProviderFinancialSummary }) {
  const { t } = useTranslation();
  const owed = parseFloat(p.total_owed);
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.provider_name}</td>
      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{p.commission_rate}%</td>
      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{fmtSAR(p.total_provider_earned)}</td>
      <td className={`px-4 py-3 text-right font-semibold ${owed > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
        {fmtSAR(p.total_owed)}
      </td>
      <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{fmtSAR(p.total_paid_out)}</td>
      <td className="px-4 py-3 text-center">
        {p.unpaid_booking_count > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
            {p.unpaid_booking_count}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 text-xs">
        {p.last_payout_date ? new Date(p.last_payout_date).toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/financials/providers/${p.provider_id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 transition-colors"
        >
          {t('fin.manage')}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </td>
    </tr>
  );
}
