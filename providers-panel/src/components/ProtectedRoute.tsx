import { useAuth } from '@/context/UserContext';
import { useRouter } from 'next/router';
import { ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { token, isInitialized } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (isInitialized && !token) {
      router.push('/login');
    }
  }, [token, isInitialized, router]);

  if (!isInitialized) {
    return <p>{t('app.loading')}</p>;
  }

  if (!token) {
    return <p>{t('app.redirectingToLogin')}</p>;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
