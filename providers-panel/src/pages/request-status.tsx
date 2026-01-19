import { useEffect, useState } from 'react';
import { useAuth } from '@/context/UserContext';
import { api } from '@/services/api';

interface ProviderRequest {
  id: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  status: string;
  denial_reason?: string;
  created_at: string;
  updated_at: string;
}

const RequestStatusPage = () => {
  const { user } = useAuth();
  const [request, setRequest] = useState<ProviderRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequestStatus = async () => {
      try {
        const response = await api.get<ProviderRequest>('/providers/request-status');
        setRequest(response);
      } catch (err: any) {
        // If request is already approved, redirect to dashboard
        if (err.response?.data?.detail === 'Request already approved') {
          window.location.href = '/dashboard';
          return;
        }
        setError(err.response?.data?.detail || 'Failed to fetch request status');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchRequestStatus();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (!user) {
    return <p>Loading...</p>;
  }

  // Remove the provider_id check since all providers now have provider_id

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <strong className="font-bold">No Request Found</strong>
          <span className="block sm:inline"> No provider request found for your account.</span>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'text-green-600 bg-green-100';
      case 'denied':
        return 'text-red-600 bg-red-100';
      case 'pending':
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return '✅';
      case 'denied':
        return '❌';
      case 'pending':
      default:
        return '⏳';
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Provider Request Status</h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <span className="text-2xl mr-3">{getStatusIcon(request.status)}</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </span>
          </div>
          
          {request.status.toLowerCase() === 'pending' && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-4">
              <p className="font-medium">Your request is under review</p>
              <p className="text-sm">We're currently reviewing your provider application. You'll be notified once a decision is made.</p>
            </div>
          )}
          
          {request.status.toLowerCase() === 'denied' && request.denial_reason && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
              <p className="font-medium">Request Denied</p>
              <p className="text-sm"><strong>Reason:</strong> {request.denial_reason}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Company Information</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Company Name</dt>
                <dd className="text-sm text-gray-900">{request.company_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Company Email</dt>
                <dd className="text-sm text-gray-900">{request.company_email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Company Phone</dt>
                <dd className="text-sm text-gray-900">{request.company_phone}</dd>
              </div>
            </dl>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Request Details</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Request ID</dt>
                <dd className="text-sm text-gray-900 font-mono">{request.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Submitted</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(request.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(request.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestStatusPage;
