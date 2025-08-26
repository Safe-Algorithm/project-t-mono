import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout } = useAuth();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <aside className="w-64 bg-gray-800 dark:bg-gray-800 text-white flex flex-col">
        <div className="p-4 flex items-center justify-between">
          <span className="text-2xl font-bold">Admin Panel</span>
          <ThemeToggle />
        </div>
        <nav className="flex-1 px-2 py-4 space-y-2">
          <Link href="/" className="block px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600">Dashboard</Link>
          <Link href="/provider-requests" className="block px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600">Provider Requests</Link>
          <Link href="/providers" className="block px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600">Providers</Link>
          <Link href="/trips" className="block px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600">Trips</Link>
          <Link href="/users" className="block px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600">Users</Link>
        </nav>
        <div className="p-4 border-t border-gray-700 dark:border-gray-600">
          <button 
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        {children}
      </main>
    </div>
  );
};

export default Layout;
