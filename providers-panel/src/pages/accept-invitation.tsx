import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { api } from '@/services/api';
import { useTranslation } from 'react-i18next';

const AcceptInvitationPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
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
      await api.publicPost(`/team/accept-invitation?token=${invitationToken}`, {});
      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || t('acceptInvitation.failDefault'));
      } else {
        setError(t('acceptInvitation.failExpired'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">{t('acceptInvitation.title')}</h1>
        
        {isLoading && (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">{t('acceptInvitation.activating')}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-bold">{t('acceptInvitation.error')}</p>
            <p>{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              {t('acceptInvitation.goToLogin')}
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <p className="font-bold">{t('acceptInvitation.success')}</p>
            <p className="mb-4">{t('acceptInvitation.successMessage')}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('acceptInvitation.redirecting')}</p>
          </div>
        )}

        {!token && !isLoading && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
            <p className="font-bold">{t('acceptInvitation.invalidLink')}</p>
            <p>{t('acceptInvitation.noToken')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcceptInvitationPage;
