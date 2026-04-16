import { useRouter } from 'next/router';
import React, { ComponentType } from 'react';
import { useAuth } from '@/context/UserContext';
import { UserRole } from '@/types/user';

const withAuth = <P extends object>(
  WrappedComponent: ComponentType<P>,
  requiredRole?: UserRole,
) => {
  const AuthComponent: React.FC<P> = (props) => {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    if (isLoading) {
      return <p>Loading...</p>;
    }

    if (!user || (requiredRole !== undefined && user.role !== requiredRole)) {
      if (typeof window !== 'undefined') {
        router.replace('/');
      }
      return null;
    }

    return <WrappedComponent {...props} />;
  };

  return AuthComponent;
};

export default withAuth;
