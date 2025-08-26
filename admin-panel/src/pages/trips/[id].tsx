import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';

interface TripPackage {
  id: string;
  name: string;
  description: string;
  price: number;
  is_active: boolean;
  required_fields: string[];
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
  trip_metadata?: any;
  packages: TripPackage[];
}

interface FieldMetadata {
  [key: string]: {
    display_name: string;
    ui_type: string;
    placeholder?: string;
    options?: string[];
    required: boolean;
  };
}

const TripDetailPage = () => {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [fieldMetadata, setFieldMetadata] = useState<FieldMetadata>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (!token || !id || typeof id !== 'string') return;

    const fetchTripDetails = async () => {
      try {
        setLoading(true);
        
        // Fetch trip details
        const tripResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/trips/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Source': 'admin_panel',
          },
        });
        
        if (!tripResponse.ok) {
          throw new Error('Failed to fetch trip details');
        }
        
        const tripData = await tripResponse.json();
        setTrip(tripData);

        // Fetch field metadata for rendering required fields
        const fieldsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trips/available-fields`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Source': 'admin_panel',
          },
        });
        
        if (fieldsResponse.ok) {
          const fieldsData = await fieldsResponse.json();
          setFieldMetadata(fieldsData);
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

    fetchTripDetails();
  }, [token, id]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!trip) return <p>Trip not found</p>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Trip Details</h1>
        <button 
          onClick={() => router.back()}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          Back
        </button>
      </div>

      {/* Trip Information */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Trip Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Trip Name</label>
            <p className="mt-1 text-sm text-gray-900">{trip.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Provider ID</label>
            <p className="mt-1 text-sm text-gray-900">{trip.provider_id}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Date</label>
            <p className="mt-1 text-sm text-gray-900">{new Date(trip.start_date).toLocaleDateString()}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">End Date</label>
            <p className="mt-1 text-sm text-gray-900">{new Date(trip.end_date).toLocaleDateString()}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Price</label>
            <p className="mt-1 text-sm text-gray-900">${trip.price}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Max Participants</label>
            <p className="mt-1 text-sm text-gray-900">{trip.max_participants}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <p className={`mt-1 text-sm font-semibold ${trip.is_active ? 'text-green-600' : 'text-red-600'}`}>
              {trip.is_active ? 'Active' : 'Cancelled'}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <p className="mt-1 text-sm text-gray-900">{trip.description}</p>
        </div>
      </div>

      {/* Trip Packages */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Trip Packages ({trip.packages.length})</h2>
        {trip.packages.length === 0 ? (
          <p className="text-gray-500">No packages found for this trip.</p>
        ) : (
          <div className="space-y-6">
            {trip.packages.map((pkg, index) => (
              <div key={pkg.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold">{pkg.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    pkg.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {pkg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <p className="mt-1 text-sm text-gray-900">{pkg.description}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Price</label>
                    <p className="mt-1 text-sm text-gray-900">${pkg.price}</p>
                  </div>
                </div>

                {/* Required Fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Required Fields</label>
                  {pkg.required_fields.length === 0 ? (
                    <p className="text-sm text-gray-500">No required fields</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {pkg.required_fields.map((fieldType) => {
                        const metadata = fieldMetadata[fieldType];
                        return (
                          <div key={fieldType} className="bg-gray-50 p-2 rounded border">
                            <p className="text-sm font-medium">
                              {metadata?.display_name || fieldType}
                            </p>
                            <p className="text-xs text-gray-500">
                              Type: {metadata?.ui_type || 'text'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TripDetailPage;
