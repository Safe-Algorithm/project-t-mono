import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';

interface Provider {
  id: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_avatar_url?: string;
  company_cover_url?: string;
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

  const fileStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">Accepted</span>;
      case 'rejected':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">Rejected</span>;
      case 'processing':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Under Review</span>;
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

  const thCls = "text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide";
  const lCls = "text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1";

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-3"><p className="text-red-500 dark:text-red-400 text-sm">{error}</p><button onClick={() => router.push('/providers')} className="text-sm text-sky-600 dark:text-sky-400 hover:underline">Back to Providers</button></div>;
  if (!provider) return <div className="flex items-center justify-center h-64"><p className="text-slate-500 dark:text-slate-400 text-sm">Provider not found</p></div>;

  const providerStatusCls =
    provider.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
    provider.status === 'pending'  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
    provider.status === 'denied'   ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
    'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';

  return (
    <div className="space-y-6">
      {/* Cover + Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 relative">
        {/* Cover image — rounded top corners, fixed height */}
        <div className="w-full h-40 bg-slate-100 dark:bg-slate-800 rounded-t-2xl overflow-hidden">
          {provider.company_cover_url ? (
            <img src={provider.company_cover_url} alt="Cover" className="w-full h-full object-cover object-center" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <svg className="w-10 h-10 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
        {/* Avatar + name row — avatar sits below cover with border overlap effect */}
        <div className="px-5 pb-5 pt-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              {/* Avatar with white ring to look like it overlaps cover */}
              <div className="-mt-10 flex-shrink-0 rounded-2xl ring-4 ring-white dark:ring-slate-900 shadow-md">
                {provider.company_avatar_url ? (
                  <img src={provider.company_avatar_url} alt={provider.company_name} className="w-16 h-16 rounded-2xl object-cover object-center" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                    <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{provider.company_name}</h1>
                <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${providerStatusCls}`}>{provider.status || 'unknown'}</span>
              </div>
            </div>
            <button onClick={() => router.push('/providers')} className="inline-flex items-center gap-1.5 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to Providers
            </button>
          </div>
        </div>
      </div>

      {/* Company Info */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Company Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><p className={lCls}>Company Name</p><p className="text-sm text-slate-900 dark:text-white font-medium">{provider.company_name}</p></div>
          <div><p className={lCls}>Email</p><p className="text-sm text-slate-900 dark:text-white">{provider.company_email}</p></div>
          <div><p className={lCls}>Phone</p><p className="text-sm text-slate-900 dark:text-white">{provider.company_phone}</p></div>
          <div><p className={lCls}>Status</p><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${providerStatusCls}`}>{provider.status || 'unknown'}</span></div>
        </div>
      </div>

      {/* Trips */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Trips <span className="text-slate-400 font-normal">({trips.length})</span></h2>
        </div>
        {trips.length === 0 ? (
          <div className="py-12 text-center"><p className="text-slate-400 dark:text-slate-500 text-sm">No trips found for this provider.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className={thCls}>Trip Name</th>
                  <th className={`${thCls} hidden sm:table-cell`}>Dates</th>
                  <th className={`${thCls} hidden md:table-cell`}>Price</th>
                  <th className={`${thCls} hidden md:table-cell`}>Max</th>
                  <th className={thCls}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {trips.map(trip => (
                  <tr key={trip.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors" onClick={() => router.push(`/trips/${trip.id}`)}>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-sky-600 dark:text-sky-400">{trip.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{trip.description}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-xs hidden sm:table-cell">{new Date(trip.start_date).toLocaleDateString()} – {new Date(trip.end_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 hidden md:table-cell">{trip.packages.length > 0 ? trip.packages.map(p => `${p.price} ${p.currency || 'SAR'}`).join(', ') : '—'}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 hidden md:table-cell">{trip.max_participants}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${trip.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
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

      {/* Documents */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Uploaded Documents <span className="text-slate-400 font-normal">({files.length})</span></h2>
        </div>
        {files.length === 0 ? (
          <div className="py-12 text-center"><p className="text-slate-400 dark:text-slate-500 text-sm">No documents uploaded yet.</p></div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {files.map(file => (
              <div key={file.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  {file.file_definition && <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{file.file_definition.name_en}</p>}
                  <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-sky-600 dark:text-sky-400 hover:underline truncate block">{file.file_name}</a>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{(file.file_size_bytes / 1024 / 1024).toFixed(2)} MB · {file.file_extension.toUpperCase()} · {new Date(file.uploaded_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {fileStatusBadge(file.file_verification_status)}
                  {file.file_verification_status !== 'accepted' && (
                    <button onClick={() => updateFileStatus(file.id, 'accepted')} disabled={updatingFileStatus[file.id]}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                      {updatingFileStatus[file.id] ? '…' : 'Accept'}
                    </button>
                  )}
                  {file.file_verification_status !== 'rejected' && (
                    <button onClick={() => handleRejectClick(file.id)} disabled={updatingFileStatus[file.id]}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                      {updatingFileStatus[file.id] ? '…' : 'Reject'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Users */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Users <span className="text-slate-400 font-normal">({users.length})</span></h2>
        </div>
        {users.length === 0 ? (
          <div className="py-12 text-center"><p className="text-slate-400 dark:text-slate-500 text-sm">No users found for this provider.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className={thCls}>Name</th>
                  <th className={`${thCls} hidden sm:table-cell`}>Email</th>
                  <th className={`${thCls} hidden md:table-cell`}>Phone</th>
                  <th className={thCls}>Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{user.name}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{user.email}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 hidden md:table-cell">{user.phone}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        user.role === 'admin'    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                        user.role === 'provider' ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>{user.role}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectingFileId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Reject File</h3>
              <button onClick={handleRejectCancel} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Please provide a reason for rejecting this file. The provider will see this message.</p>
            <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Enter rejection reason…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm min-h-[100px] resize-none transition mb-4"
              autoFocus />
            <div className="flex justify-end gap-2">
              <button onClick={handleRejectCancel} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={handleRejectSubmit} disabled={!rejectionReason.trim()}
                className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
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
