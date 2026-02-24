import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { api } from '@/services/api';

const AcceptInvitationPage = () => {
  const router = useRouter();
  const { token } = router.query;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token && typeof token === 'string') {
      handleAcceptInvitation(token);
    }
  }, [token]);

  const handleAcceptInvitation = async (invitationToken: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Use publicPost since this endpoint doesn't require authentication
      await api.publicPost(`/admin/accept-admin-invitation?token=${invitationToken}`, {});
      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to accept invitation');
      } else {
        setError('Failed to accept invitation. The link may be expired or invalid.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-sky-500 flex items-center justify-center mb-4 shadow-lg shadow-sky-500/30">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">rihla رحلة</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">Admin Panel</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-6">Admin Invitation</h1>

          {isLoading && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-10 h-10 rounded-full border-4 border-sky-500 border-t-transparent animate-spin" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Activating your admin account…</p>
            </div>
          )}

          {error && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Activation Failed</p>
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
              <button onClick={() => router.push('/login')}
                className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors">
                Go to Login
              </button>
            </div>
          )}

          {success && (
            <div className="space-y-3">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Account Activated!</p>
                </div>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">Your admin account has been activated. You can now log in to the admin panel.</p>
              </div>
              <p className="text-xs text-center text-slate-400 dark:text-slate-500">Redirecting to login page…</p>
            </div>
          )}

          {!token && !isLoading && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">Invalid Link</p>
              <p className="text-sm text-amber-600 dark:text-amber-400">No invitation token found in the URL.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcceptInvitationPage;
