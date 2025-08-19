import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/UserContext';
import { UserRole } from '@/types/user';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, isLoading } = useAuth();

  return (
    <div>
      <nav>
        <Link href="/">Home</Link> | 
        <Link href="/trips">Trips</Link>
        {!isLoading && user?.role === UserRole.SUPER_PROVIDER && (
          <>
            | <Link href="/team">Team</Link> | 
            <Link href="/profile/edit">Profile</Link>
          </>
        )}
      </nav>
      <main>{children}</main>
    </div>
  );
};

export default Layout;
