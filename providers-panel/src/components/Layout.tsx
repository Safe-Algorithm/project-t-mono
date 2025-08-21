import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/UserContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-64 bg-gray-800 text-white p-4 flex flex-col">
        <h1 className="text-2xl font-bold mb-8">Providers Panel</h1>
        <nav className="flex-1">
          <ul>
            <li className="mb-4">
              <Link href="/dashboard">
                <a className="hover:text-gray-300">Dashboard</a>
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/trips">
                <a className="hover:text-gray-300">My Trips</a>
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/profile">
                <a className="hover:text-gray-300">Profile</a>
              </Link>
            </li>
          </ul>
        </nav>
        {user && (
          <div className="border-t border-gray-700 pt-4">
            <div className="mb-4 text-sm text-gray-300">
              Welcome, {user.name}
            </div>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </aside>
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
