import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { AuthProvider } from '../context/AuthContext';
import '../styles/globals.css';

const publicPages = ['/login'];

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <AuthProvider>
      {publicPages.includes(router.pathname) ? (
        <Component {...pageProps} />
      ) : (
        <ProtectedRoute>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </ProtectedRoute>
      )}
    </AuthProvider>
  );
}
