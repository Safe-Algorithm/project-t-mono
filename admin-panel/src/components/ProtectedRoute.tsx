import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import { ReactNode, useEffect } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [token, router]);

  if (!token) {
    return <p>Loading...</p>; // Or a spinner
  }

  return <>{children}</>;
};

export default ProtectedRoute;
