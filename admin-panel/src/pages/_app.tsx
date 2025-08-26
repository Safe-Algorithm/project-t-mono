import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import '@/styles/globals.css';

const publicPages = ['/login'];

function AppContent({ Component, pageProps, router }: AppProps) {
  useTokenRefresh();
  return <Component {...pageProps} />;
}

export default function MyApp({ Component, pageProps, router }: AppProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {publicPages.includes(router.pathname) ? (
          <AppContent Component={Component} pageProps={pageProps} router={router} />
        ) : (
          <ProtectedRoute>
            <Layout>
              <AppContent Component={Component} pageProps={pageProps} router={router} />
            </Layout>
          </ProtectedRoute>
        )}
      </AuthProvider>
    </ThemeProvider>
  );
}
