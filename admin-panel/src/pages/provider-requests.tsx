import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import ProtectedRoute from '../components/ProtectedRoute';

interface ProviderRequest {
  id: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  status: string;
  provider_id: string;
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
  const router = useRouter();

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
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.detail || `Failed to ${status} request`;
        throw new Error(errorMessage);
      }

      setRequests(requests.map((req: ProviderRequest) => req.id === id ? { ...req, status } : req));
      setError(null); // Clear any previous errors on success

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Provider Applications</h1>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800">
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
              <tr 
                key={request.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => router.push(`/providers/${request.provider_id}`)}
              >
                <td className="py-2 px-4 border-b text-blue-600 hover:text-blue-800">{request.company_name}</td>
                <td className="py-2 px-4 border-b">{request.company_email}</td>
                <td className="py-2 px-4 border-b">{request.user.name}</td>
                <td className="py-2 px-4 border-b">{request.status}</td>
                <td className="py-2 px-4 border-b">
                  {request.status === 'pending' && (
                    <>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateRequest(request.id, 'approved');
                        }}
                        className="bg-green-500 text-white px-2 py-1 rounded mr-2"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateRequest(request.id, 'denied');
                        }}
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
