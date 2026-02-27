import { useRouter } from 'next/router';
import React, { ComponentType } from 'react';
import { useAuth } from '@/context/UserContext';

const withAuth = <P extends object>(WrappedComponent: ComponentType<P>) => {
  const AuthComponent: React.FC<P> = (props) => {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    if (isLoading) {
      return <p>Loading...</p>;
    }

    if (!user) {
      if (typeof window !== 'undefined') {
        router.replace('/login');
      }
      return null;
    }

    return <WrappedComponent {...props} />;
  };

  return AuthComponent;
};

export default withAuth;
