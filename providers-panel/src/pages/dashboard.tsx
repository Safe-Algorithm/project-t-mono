import { useEffect, useState } from 'react';
import { useAuth } from '@/context/UserContext';

const DashboardPage = () => {
  const { user } = useAuth();
  // Add state for dashboard data if needed

  if (!user) {
    return <p>Loading...</p>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="mb-4">Welcome, {user.company_name}!</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold">Active Trips</h2>
          <p className="text-3xl">5</p> {/* Placeholder */} 
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold">Pending Bookings</h2>
          <p className="text-3xl">12</p> {/* Placeholder */} 
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold">Total Revenue</h2>
          <p className="text-3xl">$1,234</p> {/* Placeholder */} 
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
