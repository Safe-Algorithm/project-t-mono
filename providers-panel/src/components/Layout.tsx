import React from 'react';
import Link from 'next/link';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-64 bg-gray-800 text-white p-4">
        <h1 className="text-2xl font-bold mb-8">Providers Panel</h1>
        <nav>
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
      </aside>
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
