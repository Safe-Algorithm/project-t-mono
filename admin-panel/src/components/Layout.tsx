import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout } = useAuth();
  const { t } = useTranslation();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <aside className="w-64 bg-gray-800 dark:bg-gray-800 text-white flex flex-col">
        <div className="p-4 flex items-center justify-between">
          <span className="text-2xl font-bold">Admin Panel</span>
          <div className="flex gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-2">
          <Link href="/" className="block px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600">{t('nav.dashboard')}</Link>
          <Link href="/provider-requests" className="block px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600">{t('nav.providers')}</Link>
          <Link href="/providers" className="block px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600">{t('nav.providers')}</Link>
          <Link href="/trips" className="block px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600">{t('nav.trips')}</Link>
          <Link href="/destinations" className="block px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600">Destinations</Link>
          <Link href="/users" className="block px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600">{t('nav.users')}</Link>
          <Link href="/settings/file-definitions" className="block px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600">{t('nav.settings')}</Link>
          <Link href="/profile" className="block px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600">{t('nav.profile')}</Link>
        </nav>
        <div className="p-4 border-t border-gray-700 dark:border-gray-600">
          <button 
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium transition-colors"
          >
            {t('nav.logout')}
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        {children}
      </main>
    </div>
  );
};

export default Layout;
