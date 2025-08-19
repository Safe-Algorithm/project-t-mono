import type { AppProps } from 'next/app';
import Layout from '@/components/Layout';
import { UserProvider, useAuth } from '@/context/UserContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/router';
import '@/styles/globals.css';

const publicPages = ['/login', '/register', '/'];

const GlobalAuthHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading, error, token } = useAuth();
  const router = useRouter();

  // Don't show loading state on public pages or if a token is already present
  if (isLoading && !token && !publicPages.includes(router.pathname)) {
    return <div>Loading...</div>;
  }

  // Don't show error on login page
  if (error && !publicPages.includes(router.pathname)) {
    return <div>Error: {error}</div>;
  }

  return <>{children}</>;
};

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <UserProvider>
      <GlobalAuthHandler>
        <Layout>
          {publicPages.includes(router.pathname) ? (
            <Component {...pageProps} />
          ) : (
            <ProtectedRoute>
              <Component {...pageProps} />
            </ProtectedRoute>
          )}
        </Layout>
      </GlobalAuthHandler>
    </UserProvider>
  );
}
