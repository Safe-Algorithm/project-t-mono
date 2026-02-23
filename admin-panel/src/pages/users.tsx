import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';

interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  is_active?: boolean;
  provider_id?: string;
  provider_company_name?: string;
  source?: string;
}

interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  is_active: boolean;
  source: string;
  provider_id: string | null;
  provider_company_name: string | null;
  preferred_language: string;
  created_at: string | null;
  updated_at: string | null;
  registrations: RegistrationSummary[];
}

interface RegistrationSummary {
  id: string;
  booking_reference: string;
  trip_id: string;
  trip_name: string | null;
  trip_reference: string | null;
  status: string;
  total_participants: number;
  total_amount: string;
  registration_date: string | null;
  payments: PaymentSummary[];
}

interface PaymentSummary {
  id: string;
  moyasar_payment_id: string;
  amount: string;
  currency: string;
  status: string;
  created_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  pending_payment: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

type UserTab = 'admin' | 'provider' | 'normal';

const UsersPage = () => {
  const [activeTab, setActiveTab] = useState<UserTab>('admin');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  const openUserDetail = async (userId: string) => {
    setUserDetailLoading(true);
    setSelectedUser(null);
    try {
      const detail = await api.get<UserDetail>(`/admin/users/${userId}`);
      setSelectedUser(detail);
    } catch (err) {
      console.error('Failed to load user detail:', err);
    } finally {
      setUserDetailLoading(false);
    }
  };
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const fetchUsers = async () => {
      try {
        setLoading(true);
        const data = await api.get<User[]>(`/admin/users`);
        
        // Filter users based on active tab and source
        let filteredUsers = data;
        if (activeTab === 'admin') {
          // Admin tab: only show users from admin_panel source
          filteredUsers = data.filter(u => u.source === 'admin_panel');
        } else if (activeTab === 'provider') {
          // Provider tab: only show users from providers_panel source
          filteredUsers = data.filter(u => u.source === 'providers_panel');
        } else if (activeTab === 'normal') {
          // Normal tab: only show users from mobile_app source
          filteredUsers = data.filter(u => u.source === 'mobile_app');
        }
        
        setUsers(filteredUsers);
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

    fetchUsers();
  }, [token, activeTab]);

  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      await api.post('/admin/invite-admin', {
        email: inviteEmail,
        name: inviteName,
        phone: invitePhone,
        password: invitePassword
      });
      setInviteSuccess(`Invitation email sent to ${inviteEmail}! They will receive an email to activate their admin account.`);
      setInviteEmail('');
      setInviteName('');
      setInvitePhone('');
      setInvitePassword('');
      
      // Refresh user list
      const data = await api.get<User[]>(`/admin/users/${activeTab}`);
      setUsers(data);
      
      // Close modal after 3 seconds
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccess(null);
      }, 3000);
    } catch (err) {
      if (err instanceof Error) {
        setInviteError(err.message);
      } else {
        setInviteError('Failed to send invitation');
      }
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  const getTabTitle = () => {
    switch (activeTab) {
      case 'admin': return 'Admin Users';
      case 'provider': return 'Provider Users';
      case 'normal': return 'Normal Users';
      default: return 'Users';
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        {activeTab === 'admin' && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Invite Admin
          </button>
        )}
      </div>
      
      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {(['admin', 'provider', 'normal'] as UserTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'admin' ? 'Admin Users' : tab === 'provider' ? 'Provider Users' : 'Normal Users'}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">{getTabTitle()} ({users.length})</h2>
        
        {users.length === 0 ? (
          <p className="text-gray-500">No {activeTab} users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white dark:bg-gray-800">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b text-left">Name</th>
                  <th className="py-2 px-4 border-b text-left">Email</th>
                  <th className="py-2 px-4 border-b text-left">Phone</th>
                  <th className="py-2 px-4 border-b text-left">Role</th>
                  {activeTab === 'provider' && (
                    <th className="py-2 px-4 border-b text-left">Company</th>
                  )}
                  <th className="py-2 px-4 border-b text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => openUserDetail(user.id)}>
                    <td className="py-2 px-4 border-b font-medium text-blue-600 hover:underline">{user.name}</td>
                    <td className="py-2 px-4 border-b">{user.email}</td>
                    <td className="py-2 px-4 border-b">{user.phone}</td>
                    <td className="py-2 px-4 border-b">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'admin' 
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          : user.role === 'provider'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    {activeTab === 'provider' && (
                      <td className="py-2 px-4 border-b">
                        {user.provider_company_name ? (
                          <span className="text-sm text-gray-700 dark:text-gray-300">{user.provider_company_name}</span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    )}
                    <td className="py-2 px-4 border-b">
                      {user.is_active ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                          Pending Invitation
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Detail Drawer */}
      {(selectedUser || userDetailLoading) && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black bg-opacity-40" onClick={() => setSelectedUser(null)} />
          <div className="w-full max-w-2xl bg-white dark:bg-gray-900 h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-bold text-lg">User Detail</h3>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            {userDetailLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">Loading…</p>
              </div>
            ) : selectedUser ? (
              <div className="p-4 space-y-6 flex-1">
                {/* Profile */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-3">Profile</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500 block text-xs">Name</span><span className="font-medium">{selectedUser.name}</span></div>
                    <div><span className="text-gray-500 block text-xs">Email</span><span className="font-medium">{selectedUser.email || '—'}</span></div>
                    <div><span className="text-gray-500 block text-xs">Phone</span><span className="font-medium">{selectedUser.phone || '—'}</span></div>
                    <div><span className="text-gray-500 block text-xs">Role</span><span className="font-medium capitalize">{selectedUser.role}</span></div>
                    <div><span className="text-gray-500 block text-xs">Source</span><span className="font-medium">{selectedUser.source}</span></div>
                    <div><span className="text-gray-500 block text-xs">Language</span><span className="font-medium uppercase">{selectedUser.preferred_language}</span></div>
                    <div><span className="text-gray-500 block text-xs">Status</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${selectedUser.is_active ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {selectedUser.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {selectedUser.provider_company_name && (
                      <div><span className="text-gray-500 block text-xs">Company</span><span className="font-medium">{selectedUser.provider_company_name}</span></div>
                    )}
                    {selectedUser.created_at && (
                      <div><span className="text-gray-500 block text-xs">Registered</span><span className="font-medium">{new Date(selectedUser.created_at).toLocaleString()}</span></div>
                    )}
                    {selectedUser.updated_at && (
                      <div><span className="text-gray-500 block text-xs">Last Updated</span><span className="font-medium">{new Date(selectedUser.updated_at).toLocaleString()}</span></div>
                    )}
                  </div>
                </div>

                {/* Registrations */}
                <div>
                  <h4 className="font-semibold text-sm mb-3">Bookings ({selectedUser.registrations.length})</h4>
                  {selectedUser.registrations.length === 0 ? (
                    <p className="text-gray-500 text-sm">No bookings found.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedUser.registrations.map(reg => (
                        <div key={reg.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-sm">{reg.trip_name || 'Unknown Trip'}</p>
                              <p className="text-xs text-gray-500 font-mono">{reg.booking_reference}</p>
                              {reg.trip_reference && <p className="text-xs text-gray-400">Trip ref: {reg.trip_reference}</p>}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[reg.status] || 'bg-gray-100 text-gray-700'}`}>
                              {reg.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2">
                            <span>👥 {reg.total_participants} participant{reg.total_participants !== 1 ? 's' : ''}</span>
                            <span>💰 {reg.total_amount} SAR</span>
                            {reg.registration_date && <span>📅 {new Date(reg.registration_date).toLocaleDateString()}</span>}
                          </div>
                          {/* Payments */}
                          {reg.payments.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                              <p className="text-xs font-medium text-gray-500 mb-1">Payments</p>
                              <div className="space-y-1">
                                {reg.payments.map(p => (
                                  <div key={p.id} className="flex justify-between items-center text-xs">
                                    <span className="font-mono text-gray-400">{p.moyasar_payment_id || p.id.slice(0, 8)}</span>
                                    <span>{p.amount} {p.currency}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-700'}`}>{p.status}</span>
                                    {p.created_at && <span className="text-gray-400">{new Date(p.created_at).toLocaleDateString()}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Invite New Admin</h2>
            
            {inviteError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                {inviteError}
              </div>
            )}
            
            {inviteSuccess && (
              <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
                {inviteSuccess}
              </div>
            )}
            
            <form onSubmit={handleInviteAdmin}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Phone</label>
                <input
                  type="tel"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Temporary Password</label>
                <input
                  type="password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteError(null);
                    setInviteSuccess(null);
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                  disabled={inviteLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  disabled={inviteLoading}
                >
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
