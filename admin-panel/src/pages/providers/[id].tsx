import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';

interface Provider {
  id: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_avatar_url?: string;
  is_active?: boolean;
  status?: string;
}

interface TripPackage {
  id: string;
  name: string;
  price: number;
  currency: string;
}

interface Trip {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  max_participants: number;
  is_active: boolean;
  provider_id: string;
  packages: TripPackage[];
}

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

interface ProviderFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size_bytes: number;
  file_extension: string;
  file_verification_status: 'processing' | 'accepted' | 'rejected';
  uploaded_at: string;
  file_definition?: {
    name_en: string;
    name_ar: string;
  };
}

const ProviderDetailPage = () => {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [files, setFiles] = useState<ProviderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingFileStatus, setUpdatingFileStatus] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [rejectingFileId, setRejectingFileId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const { token } = useAuth();
  const router = useRouter();
  const { id } = router.query;

  const updateFileStatus = async (fileId: string, status: 'accepted' | 'rejected' | 'processing', rejection_reason?: string) => {
    setUpdatingFileStatus(prev => ({ ...prev, [fileId]: true }));
    try {
      const body: any = { file_verification_status: status };
      if (status === 'rejected' && rejection_reason) {
        body.rejection_reason = rejection_reason;
      }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/files/admin/provider-files/${fileId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Source': 'admin_panel',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update file status');
      }

      // Refresh files list
      const filesResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/files/provider/${id}/files`,
        {
          headers: {
            'X-Source': 'admin_panel',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        }
      );

      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        setFiles(filesData);
      }
    } catch (err) {
      console.error('Error updating file status:', err);
      setError('Failed to update file status');
    } finally {
      setUpdatingFileStatus(prev => ({ ...prev, [fileId]: false }));
    }
  };

  const handleRejectClick = (fileId: string) => {
    setRejectingFileId(fileId);
    setRejectionReason('');
  };

  const handleRejectSubmit = async () => {
    if (!rejectingFileId || !rejectionReason.trim()) {
      setError('Rejection reason is required');
      return;
    }

    await updateFileStatus(rejectingFileId, 'rejected', rejectionReason);
    setRejectingFileId(null);
    setRejectionReason('');
  };

  const handleRejectCancel = () => {
    setRejectingFileId(null);
    setRejectionReason('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center">
            <span className="mr-1">✓</span> Accepted
          </span>
        );
      case 'rejected':
        return (
          <span className="px-3 py-1 bg-red-100 text-red-800 text-xs rounded-full flex items-center">
            <span className="mr-1">✗</span> Rejected
          </span>
        );
      case 'processing':
        return (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full flex items-center">
            <span className="mr-1">⏳</span> Under Review
          </span>
        );
      default:
        return null;
    }
  };

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

        // Fetch provider files
        const filesResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/files/provider/${id}/files`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Source': 'admin_panel',
          },
        });
        
        if (filesResponse.ok) {
          const filesData = await filesResponse.json();
          setFiles(filesData);
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
        
        {/* Company Avatar */}
        {provider.company_avatar_url && (
          <div className="mb-6 flex justify-center">
            <img
              src={provider.company_avatar_url}
              alt={`${provider.company_name} avatar`}
              className="h-32 w-32 rounded-full object-cover border-4 border-gray-200 shadow-lg"
            />
          </div>
        )}
        
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
            <span className={`mt-1 inline-block px-2 py-1 rounded-full text-xs font-semibold ${
              provider.status === 'approved' 
                ? 'bg-green-100 text-green-800' 
                : provider.status === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : provider.status === 'denied'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {provider.status || 'unknown'}
            </span>
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
                    <td className="py-2 px-4 border-b">
                      {trip.packages.length > 0 ? 
                        trip.packages.map(pkg => `${pkg.price} ${pkg.currency || 'SAR'}`).join(', ') : 
                        'No packages'
                      }
                    </td>
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

      {/* Provider Files */}
      <div className="bg-white shadow-md rounded-lg p-6 mt-6">
        <h2 className="text-2xl font-semibold mb-4">Uploaded Documents ({files.length})</h2>
        {files.length === 0 ? (
          <p className="text-gray-500">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-4 bg-gray-50 rounded border border-gray-200">
                <div className="flex-1">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">📄</span>
                    <div>
                      {file.file_definition && (
                        <p className="text-xs font-semibold text-gray-700 mb-1">
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
                        {file.file_extension.toUpperCase()} • 
                        Uploaded {new Date(file.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(file.file_verification_status)}
                  {file.file_verification_status !== 'accepted' && (
                    <button
                      onClick={() => updateFileStatus(file.id, 'accepted')}
                      disabled={updatingFileStatus[file.id]}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded disabled:opacity-50"
                    >
                      {updatingFileStatus[file.id] ? 'Updating...' : 'Accept'}
                    </button>
                  )}
                  {file.file_verification_status !== 'rejected' && (
                    <button
                      onClick={() => handleRejectClick(file.id)}
                      disabled={updatingFileStatus[file.id]}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded disabled:opacity-50"
                    >
                      {updatingFileStatus[file.id] ? 'Updating...' : 'Reject'}
                    </button>
                  )}
                </div>
              </div>
            ))}
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

      {/* Rejection Reason Modal */}
      {rejectingFileId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Reject File</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this file. The provider will see this message.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 min-h-[100px] focus:ring-2 focus:ring-red-500 focus:border-transparent"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleRejectCancel}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!rejectionReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderDetailPage;
