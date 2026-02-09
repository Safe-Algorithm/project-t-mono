import { useEffect, useState } from 'react';
import { useAuth } from '@/context/UserContext';
import { api } from '@/services/api';
import { providerFilesService, ProviderFile } from '@/services/fileDefinitions';

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
  const [uploadedFiles, setUploadedFiles] = useState<ProviderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequestStatus = async () => {
      try {
        const response = await api.get<ProviderRequest>('/providers/request-status');
        setRequest(response);
        
        // Fetch uploaded files
        try {
          const files = await providerFilesService.getUploadedFiles();
          setUploadedFiles(files);
        } catch (fileErr) {
          console.error('Failed to fetch uploaded files:', fileErr);
          // Don't fail the whole page if files can't be fetched
        }
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
      
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
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
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 px-4 py-3 rounded mb-4">
              <p className="font-medium">Request Denied</p>
              <p className="text-sm"><strong>Reason:</strong> {request.denial_reason}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Company Information</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Company Name</dt>
                <dd className="text-sm text-gray-900 dark:text-white">{request.company_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Company Email</dt>
                <dd className="text-sm text-gray-900 dark:text-white">{request.company_email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Company Phone</dt>
                <dd className="text-sm text-gray-900 dark:text-white">{request.company_phone}</dd>
              </div>
            </dl>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Request Details</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Request ID</dt>
                <dd className="text-sm text-gray-900 dark:text-white font-mono">{request.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Submitted</dt>
                <dd className="text-sm text-gray-900 dark:text-white">
                  {request.created_at ? new Date(request.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="text-sm text-gray-900 dark:text-white">
                  {request.updated_at ? new Date(request.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'N/A'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Uploaded Files Section */}
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Uploaded Documents</h3>
          {uploadedFiles.length > 0 ? (
            <div className="space-y-2">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200 dark:border-gray-700">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="text-lg mr-2">📄</span>
                      <div>
                        {file.file_definition && (
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            {file.file_definition.name_en}
                          </p>
                        )}
                        <a 
                          href={file.file_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {file.file_name}
                        </a>
                        <p className="text-xs text-gray-500">
                          {(file.file_size_bytes / 1024 / 1024).toFixed(2)} MB • 
                          Uploaded {file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {file.file_verification_status === 'accepted' && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center">
                        <span className="mr-1">✓</span> Accepted
                      </span>
                    )}
                    {file.file_verification_status === 'rejected' && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full flex items-center">
                        <span className="mr-1">✗</span> Rejected
                      </span>
                    )}
                    {file.file_verification_status === 'processing' && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full flex items-center">
                        <span className="mr-1">⏳</span> Under Review
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded p-4 text-center">
              <p className="text-sm text-gray-500">No documents uploaded yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestStatusPage;
