import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { api, PermissionDeniedError } from '@/services/api';
import { useTranslation } from 'react-i18next';
import Pagination from '../components/Pagination';
import PermissionDenied from '@/components/common/PermissionDenied';

const PAGE_SIZE = 20;

interface Provider {
  id: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  is_active?: boolean;
  status?: string;
}

const ProvidersPage = () => {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => { setPage(1); }, [search]);

  useEffect(() => {
    if (!token) return;
    const fetchProviders = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        params.append('skip', ((page - 1) * PAGE_SIZE).toString());
        params.append('limit', PAGE_SIZE.toString());
        const data = await api.get<Provider[]>(`/admin/providers?${params}`);
        setProviders(data);
        if (data.length < PAGE_SIZE && page === 1) setTotal(data.length);
        else if (data.length < PAGE_SIZE) setTotal((page - 1) * PAGE_SIZE + data.length);
        else setTotal(prev => Math.max(prev, page * PAGE_SIZE + 1));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unexpected error occurred'));
      } finally {
        setLoading(false);
      }
    };
    fetchProviders();
  }, [token, search, page]);

  const filtered = providers;

  const statusCls: Record<string, string> = {
    approved: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    pending:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    denied:   'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" />
    </div>
  );
  if (error instanceof PermissionDeniedError) return <PermissionDenied action="view providers" />;
  if (error) return (
    <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">{error.message}</div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('nav.providers')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('trips.totalCount_other', { count: providers.length })}</p>
        </div>
        <div className="relative w-full sm:w-64">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={t('common.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No providers found</p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.company', 'Company')}</th>
                    <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">{t('common.email')}</th>
                    <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden lg:table-cell">{t('common.phone')}</th>
                    <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map(provider => (
                    <tr
                      key={provider.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/providers/${provider.id}`)}
                    >
                      <td className="py-3 px-4 font-semibold text-sky-600 dark:text-sky-400 group-hover:text-sky-700 dark:group-hover:text-sky-300">{provider.company_name}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 hidden md:table-cell">{provider.company_email}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 hidden lg:table-cell">{provider.company_phone}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusCls[provider.status ?? ''] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                          {provider.status || 'unknown'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProvidersPage;
