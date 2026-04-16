import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/UserContext';
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

const NAV_ICON_DASHBOARD = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const NAV_ICON_TRIPS = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);
const NAV_ICON_SUPPORT = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const NAV_ICON_UPDATES = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);
const NAV_ICON_TEAM = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const NAV_ICON_ROLES = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
const NAV_ICON_FINANCIALS = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const NAV_ICON_IMAGES = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const NAV_ICON_PROFILE = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);
const NAV_ICON_LOGOUT = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, isLoading, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [providerStatus, setProviderStatus] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isRTL = i18n.language === 'ar';

  useEffect(() => {
    const fetchProviderStatus = async () => {
      if (user) {
        try {
          const response = await api.get<ProviderRequest>('/providers/request-status');
          setProviderStatus(response.status);
        } catch (error: any) {
          if (error.message === 'Request already approved' || error.message?.includes('404')) {
            setProviderStatus('approved');
          }
        } finally {
          setStatusLoading(false);
        }
      } else {
        setStatusLoading(false);
      }
    };
    fetchProviderStatus();
  }, [user]);

  const handleLogout = async () => {
    if (confirm(t('nav.logout') + '?')) {
      await logout();
    }
  };

  const isApproved = providerStatus === 'approved';
  const isPublicPage = ['/login', '/register', '/forgot-password'].includes(router.pathname);

  const isActive = (href: string) =>
    href === '/' ? router.pathname === '/' : router.pathname.startsWith(href);

  const NavLink = ({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) => (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
        isActive(href)
          ? 'bg-sky-500 text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
      }`}
      onClick={() => setMobileOpen(false)}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );

  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950" dir={isRTL ? 'rtl' : 'ltr'}>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} z-40 w-64 bg-white dark:bg-slate-900 border-${isRTL ? 'l' : 'r'} border-slate-200 dark:border-slate-800 flex flex-col transition-[left,right] duration-300
        ${isRTL
          ? (mobileOpen ? 'right-0' : '-right-64 lg:right-0')
          : (mobileOpen ? 'left-0' : '-left-64 lg:left-0')
        }`}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center shadow-sm flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">رحلة</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{t('nav.providerPanel')}</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {!statusLoading && isApproved && user && (
            <>
              <NavLink href="/" icon={NAV_ICON_DASHBOARD} label={t('nav.dashboard')} />
              <NavLink href="/trips" icon={NAV_ICON_TRIPS} label={t('nav.trips')} />
              <NavLink href="/support" icon={NAV_ICON_SUPPORT} label={t('nav.supportTickets')} />
              <NavLink href="/trip-updates" icon={NAV_ICON_UPDATES} label={t('nav.tripUpdates')} />
              <NavLink href="/team" icon={NAV_ICON_TEAM} label={t('nav.team')} />
              <NavLink href="/image-collection" icon={NAV_ICON_IMAGES} label={t('nav.imageCollection')} />
              <NavLink href="/financials" icon={NAV_ICON_FINANCIALS} label={t('nav.financials')} />
              <NavLink href="/roles" icon={NAV_ICON_ROLES} label={t('nav.rolesPermissions')} />
            </>
          )}
          {!statusLoading && !isApproved && user && (
            <NavLink href="/request-status" icon={NAV_ICON_DASHBOARD} label={t('nav.settings')} />
          )}
          {user && (
            <NavLink href="/profile" icon={NAV_ICON_PROFILE} label={t('nav.profile')} />
          )}
        </nav>

        {/* Bottom: user + controls */}
        <div className="px-3 py-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center gap-2 px-3">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
          {user && (
            <Link
              href="/user-profile"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                router.pathname === '/user-profile'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-sky-600 dark:text-sky-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium leading-tight">{user.name || t('nav.profile')}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">{t('nav.profile')}</p>
              </div>
            </Link>
          )}
          {user && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              {NAV_ICON_LOGOUT}
              {t('nav.logout')}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-h-screen ${isRTL ? 'lg:mr-64' : 'lg:ml-64'}`}>
        {/* Top bar (mobile) */}
        <header className="lg:hidden sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 h-14">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-slate-900 dark:text-white">رحلة</span>
          <div className="w-9" />
        </header>

        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
