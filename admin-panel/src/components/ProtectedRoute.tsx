import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import { ReactNode, useEffect } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { token, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && !token) {
      router.push('/login');
    }
  }, [token, isInitialized, router]);

  if (!isInitialized) {
    return <p>Loading...</p>; // Show loading while checking authentication
  }

  if (!token) {
    return <p>Redirecting to login...</p>; // Show message while redirecting
  }

  return <>{children}</>;
};

export default ProtectedRoute;
