import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';

interface DashboardStats {
  provider_requests: {
    pending: number;
    approved: number;
    denied: number;
  };
  providers: {
    total: number;
    active: number;
    inactive: number;
  };
  trips: {
    total: number;
    upcoming: number;
    current: number;
    past: number;
  };
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
}

const StatCard = ({ title, value, subtitle, color }: StatCardProps) => {
  const colorClasses = {
    blue: 'bg-blue-500 text-white',
    green: 'bg-green-500 text-white',
    yellow: 'bg-yellow-500 text-white',
    red: 'bg-red-500 text-white',
    purple: 'bg-purple-500 text-white',
    gray: 'bg-gray-500 text-white',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 border-l-current">
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${colorClasses[color]} mb-4`}>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>}
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const fetchDashboardStats = async () => {
      try {
        const data = await api.get<DashboardStats>('/dashboard/stats');
        setStats(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, [token]);

  if (loading) return <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>;
  if (error) return <p className="text-red-600 dark:text-red-400">Error: {error}</p>;
  if (!stats) return <p className="text-gray-600 dark:text-gray-400">No data available</p>;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Admin Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Overview of system statistics and metrics</p>
      </div>

      {/* Provider Requests Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Provider Requests</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Pending Requests"
            value={stats.provider_requests.pending}
            subtitle="Awaiting review"
            color="yellow"
          />
          <StatCard
            title="Approved Requests"
            value={stats.provider_requests.approved}
            subtitle="Successfully approved"
            color="green"
          />
          <StatCard
            title="Denied Requests"
            value={stats.provider_requests.denied}
            subtitle="Rejected applications"
            color="red"
          />
        </div>
      </div>

      {/* Providers Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Providers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Total Providers"
            value={stats.providers.total}
            subtitle="All registered providers"
            color="blue"
          />
          <StatCard
            title="Active Providers"
            value={stats.providers.active}
            subtitle="Currently operational"
            color="green"
          />
          <StatCard
            title="Inactive Providers"
            value={stats.providers.inactive}
            subtitle="Temporarily disabled"
            color="gray"
          />
        </div>
      </div>

      {/* Trips Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Trips</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Trips"
            value={stats.trips.total}
            subtitle="All trips in system"
            color="purple"
          />
          <StatCard
            title="Upcoming Trips"
            value={stats.trips.upcoming}
            subtitle="Starting in the future"
            color="blue"
          />
          <StatCard
            title="Current Trips"
            value={stats.trips.current}
            subtitle="Currently in progress"
            color="green"
          />
          <StatCard
            title="Past Trips"
            value={stats.trips.past}
            subtitle="Completed trips"
            color="gray"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
            Review Requests
          </button>
          <button className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
            Manage Providers
          </button>
          <button className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
            View All Trips
          </button>
          <button className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
            System Settings
          </button>
        </div>
      </div>
    </div>
  );
}
