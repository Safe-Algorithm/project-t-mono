import { useEffect, useState } from 'react';

interface Trip {
  id: string;
  name: string;
  provider_id: string;
  start_date: string;
  end_date: string;
  price: number;
  is_active: boolean;
}

const TripsPage = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const response = await fetch('http://localhost:8000/trips'); // Assuming a general trips endpoint
        if (!response.ok) {
          throw new Error('Failed to fetch trips');
        }
        const data = await response.json();
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
  }, []);

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
              <tr key={trip.id}>
                <td className="py-2 px-4 border-b">{trip.name}</td>
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
