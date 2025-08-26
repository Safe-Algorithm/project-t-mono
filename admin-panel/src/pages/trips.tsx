import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { useRouter } from 'next/router';

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

const TripsPage = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!token) return;

    const fetchTrips = async () => {
      try {
        const data = await api.get<Trip[]>('/admin/trips');
        setTrips(data);
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

    fetchTrips();
  }, [token]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">All Trips</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Trip Name</th>
              <th className="py-2 px-4 border-b">Provider ID</th>
              <th className="py-2 px-4 border-b">Start Date</th>
              <th className="py-2 px-4 border-b">End Date</th>
              <th className="py-2 px-4 border-b">Price</th>
              <th className="py-2 px-4 border-b">Status</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => (
              <tr 
                key={trip.id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/trips/${trip.id}`)}
              >
                <td className="py-2 px-4 border-b text-blue-600 hover:text-blue-800">{trip.name}</td>
                <td className="py-2 px-4 border-b">{trip.provider_id}</td>
                <td className="py-2 px-4 border-b">{new Date(trip.start_date).toLocaleDateString()}</td>
                <td className="py-2 px-4 border-b">{new Date(trip.end_date).toLocaleDateString()}</td>
                <td className="py-2 px-4 border-b">${trip.price}</td>
                <td className="py-2 px-4 border-b">{trip.is_active ? 'Active' : 'Cancelled'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TripsPage;
