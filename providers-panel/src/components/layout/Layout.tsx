import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/UserContext';
import { UserRole } from '@/types/user';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { api } from '@/services/api';
import { useTranslation } from 'react-i18next';

interface LayoutProps {
  children: React.ReactNode;
}

interface ProviderRequest {
  id: string;
  status: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_metadata: any;
  denial_reason: string | null;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, isLoading, logout } = useAuth();
  const { t } = useTranslation();
  const [providerStatus, setProviderStatus] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    const fetchProviderStatus = async () => {
      if (user) {
        try {
          const response = await api.get<ProviderRequest>('/providers/request-status');
          setProviderStatus(response.status);
        } catch (error: any) {
          // ApiError doesn't have response property - check error message directly
          if (error.message === 'Request already approved' || error.message?.includes('404')) {
            setProviderStatus('approved');
          } else {
            console.error('Failed to fetch provider status:', error);
          }
        } finally {
          setStatusLoading(false);
        }
      }
    };

    fetchProviderStatus();
  }, [user]);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  const isApproved = providerStatus === 'approved';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('nav.dashboard')}</h1>
              </div>
              <div className="flex space-x-4">
                {/* Company Profile and User Profile tabs - only visible when logged in */}
                {user && (
                  <>
                    <Link href="/profile" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                      {t('nav.profile')}
                    </Link>
                    <Link href="/user-profile" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                      {t('nav.profile')}
                    </Link>
                  </>
                )}
                
                {/* Request Status tab - only show for non-approved providers */}
                {!statusLoading && !isApproved && user && (
                  <Link href="/request-status" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                    {t('nav.settings')}
                  </Link>
                )}
                
                {/* Dashboard and Trips tabs - only show for approved providers */}
                {!statusLoading && isApproved && user && (
                  <>
                    <Link href="/" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                      {t('nav.dashboard')}
                    </Link>
                    <Link href="/trips" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                      {t('nav.trips')}
                    </Link>
                    <Link href="/support" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                      Support Tickets
                    </Link>
                  </>
                )}
                
                {/* Team tab only for approved super users */}
                {!isLoading && !statusLoading && user?.role === UserRole.SUPER_USER && isApproved && (
                  <Link href="/team" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                    {t('nav.settings')}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <LanguageSwitcher />
              {user && (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Welcome, {user.name}</span>
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    {t('nav.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
