import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import ProtectedRoute from '../components/ProtectedRoute';

interface ProviderRequest {
  id: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  status: string;
  user: {
    name: string;
    email: string;
  };
}

const ProviderRequestsPageContent = () => {
  const [requests, setRequests] = useState<ProviderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const fetchRequests = async () => {
      try {
        const data = await api.get<ProviderRequest[]>('/admin/provider-requests');
        setRequests(data);
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

    fetchRequests();
  }, [token]);

  const handleUpdateRequest = async (id: string, status: 'approved' | 'denied') => {
    if (!token) return;

    try {
      let url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/provider-requests/${id}`;
      if (status === 'approved') {
        url += '/approve';
      } else {
        url += '/deny';
      }
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Source': 'admin_panel',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${status} request`);
      }

      setRequests(requests.map((req: ProviderRequest) => req.id === id ? { ...req, status } : req));

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Provider Applications</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Company Name</th>
              <th className="py-2 px-4 border-b">Company Email</th>
              <th className="py-2 px-4 border-b">Applicant Name</th>
              <th className="py-2 px-4 border-b">Status</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td className="py-2 px-4 border-b">{request.company_name}</td>
                <td className="py-2 px-4 border-b">{request.company_email}</td>
                <td className="py-2 px-4 border-b">{request.user.name}</td>
                <td className="py-2 px-4 border-b">{request.status}</td>
                <td className="py-2 px-4 border-b">
                  {request.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleUpdateRequest(request.id, 'approved')}
                        className="bg-green-500 text-white px-2 py-1 rounded mr-2"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleUpdateRequest(request.id, 'denied')}
                        className="bg-red-500 text-white px-2 py-1 rounded"
                      >
                        Deny
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ProviderRequestsPage = () => (
  <ProtectedRoute>
    <ProviderRequestsPageContent />
  </ProtectedRoute>
);

export default ProviderRequestsPage;
