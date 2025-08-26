import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';

interface Provider {
  id: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  is_active?: boolean;
}

interface Trip {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  price: number;
  max_participants: number;
  is_active: boolean;
  provider_id: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

const ProviderDetailPage = () => {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (!token || !id || typeof id !== 'string') return;

    const fetchProviderDetails = async () => {
      try {
        setLoading(true);
        
        // Fetch provider details
        const providerResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/providers/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Source': 'admin_panel',
          },
        });
        
        if (!providerResponse.ok) {
          throw new Error('Failed to fetch provider details');
        }
        
        const providerData = await providerResponse.json();
        setProvider(providerData);

        // Fetch provider trips
        const tripsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/providers/${id}/trips`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Source': 'admin_panel',
          },
        });
        
        if (!tripsResponse.ok) {
          throw new Error('Failed to fetch provider trips');
        }
        
        const tripsData = await tripsResponse.json();
        setTrips(tripsData);

        // Fetch provider users
        const usersResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/providers/${id}/users`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Source': 'admin_panel',
          },
        });
        
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setUsers(usersData);
        }
        
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

    fetchProviderDetails();
  }, [token, id]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!provider) return <p>Provider not found</p>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Provider Details</h1>
        <button 
          onClick={() => router.push('/providers')}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          Back to Providers
        </button>
      </div>

      {/* Provider Information */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Company Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Company Name</label>
            <p className="mt-1 text-sm text-gray-900">{provider.company_name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <p className="mt-1 text-sm text-gray-900">{provider.company_email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <p className="mt-1 text-sm text-gray-900">{provider.company_phone}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <p className={`mt-1 text-sm font-semibold ${provider.is_active ? 'text-green-600' : 'text-red-600'}`}>
              {provider.is_active ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>
      </div>

      {/* Provider Trips */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Trips ({trips.length})</h2>
        {trips.length === 0 ? (
          <p className="text-gray-500">No trips found for this provider.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b text-left">Trip Name</th>
                  <th className="py-2 px-4 border-b text-left">Start Date</th>
                  <th className="py-2 px-4 border-b text-left">End Date</th>
                  <th className="py-2 px-4 border-b text-left">Price</th>
                  <th className="py-2 px-4 border-b text-left">Max Participants</th>
                  <th className="py-2 px-4 border-b text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => (
                  <tr 
                    key={trip.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/trips/${trip.id}`)}
                  >
                    <td className="py-2 px-4 border-b">
                      <div>
                        <p className="font-medium text-blue-600 hover:text-blue-800">{trip.name}</p>
                        <p className="text-sm text-gray-500">{trip.description}</p>
                      </div>
                    </td>
                    <td className="py-2 px-4 border-b">{new Date(trip.start_date).toLocaleDateString()}</td>
                    <td className="py-2 px-4 border-b">{new Date(trip.end_date).toLocaleDateString()}</td>
                    <td className="py-2 px-4 border-b">${trip.price}</td>
                    <td className="py-2 px-4 border-b">{trip.max_participants}</td>
                    <td className="py-2 px-4 border-b">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        trip.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {trip.is_active ? 'Active' : 'Cancelled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provider Users */}
      <div className="bg-white shadow-md rounded-lg p-6 mt-6">
        <h2 className="text-2xl font-semibold mb-4">Users ({users.length})</h2>
        {users.length === 0 ? (
          <p className="text-gray-500">No users found for this provider.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b text-left">Name</th>
                  <th className="py-2 px-4 border-b text-left">Email</th>
                  <th className="py-2 px-4 border-b text-left">Phone</th>
                  <th className="py-2 px-4 border-b text-left">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b">{user.name}</td>
                    <td className="py-2 px-4 border-b">{user.email}</td>
                    <td className="py-2 px-4 border-b">{user.phone}</td>
                    <td className="py-2 px-4 border-b">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'admin' 
                          ? 'bg-red-100 text-red-800'
                          : user.role === 'provider'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderDetailPage;
