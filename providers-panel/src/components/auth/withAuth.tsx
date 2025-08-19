import { useRouter } from 'next/router';
import React, { ComponentType } from 'react';
import { useAuth } from '@/context/UserContext';
import { UserRole } from '@/types/user';

const withAuth = <P extends object>(
  WrappedComponent: ComponentType<P>,
  requiredRole: UserRole = UserRole.SUPER_PROVIDER
) => {
  const AuthComponent: React.FC<P> = (props) => {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    if (isLoading) {
      return <p>Loading...</p>;
    }

    if (!user || user.role !== requiredRole) {
      if (typeof window !== 'undefined') {
        router.replace('/'); // Redirect to home page
      }
      return null; // Render nothing while redirecting
    }

    return <WrappedComponent {...props} />;
  };

  return AuthComponent;
};

export default withAuth;
