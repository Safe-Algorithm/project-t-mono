import { useAuth } from '@/context/UserContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function HomePage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    // Redirect to dashboard if the user is already logged in
    if (!isLoading && token) {
      router.push('/dashboard');
    }
  }, [token, isLoading, router]);

  // Show a loading state while checking auth status
  if (isLoading || token) {
    return <div>{t('app.loading')}</div>;
  }

  return (
    <div className="container mx-auto p-4 flex justify-center items-center h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-8">{t('home.title')}</h1>
        <div className="space-x-4">
          <Link href="/login" legacyBehavior>
            <a className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
              {t('home.login')}
            </a>
          </Link>
          <Link href="/register" legacyBehavior>
            <a className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
              {t('home.register')}
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
