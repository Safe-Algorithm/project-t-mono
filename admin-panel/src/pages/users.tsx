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

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition";
  const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5";
  const roleCls: Record<string, string> = {
    super_user: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    normal:     'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    admin:      'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
  };
  const tabLabels: Record<UserTab, string> = { admin: 'Admin Users', provider: 'Provider Users', normal: 'App Users' };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" />
    </div>
  );
  if (error) return (
    <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">{error}</div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{users.length} {tabLabels[activeTab].toLowerCase()}</p>
        </div>
        {activeTab === 'admin' && (
          <button onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Invite Admin
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {(['admin', 'provider', 'normal'] as UserTab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Name</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Email</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden lg:table-cell">Phone</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Role</th>
                  {activeTab === 'provider' && <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Company</th>}
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group" onClick={() => openUserDetail(user.id)}>
                    <td className="py-3 px-4 font-semibold text-sky-600 dark:text-sky-400 group-hover:text-sky-700">{user.name}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 hidden md:table-cell">{user.email}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 hidden lg:table-cell">{user.phone || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${roleCls[user.role] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>{user.role}</span>
                    </td>
                    {activeTab === 'provider' && <td className="py-3 px-4 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{user.provider_company_name || '—'}</td>}
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${user.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
                        {user.is_active ? 'Active' : 'Pending'}
                      </span>
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
          <div className="flex-1 bg-black/50" onClick={() => setSelectedUser(null)} />
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full overflow-y-auto shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">User Detail</h3>
              <button onClick={() => setSelectedUser(null)} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xl leading-none">&times;</button>
            </div>

            {userDetailLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-7 h-7 rounded-full border-4 border-sky-500 border-t-transparent" />
              </div>
            ) : selectedUser ? (
              <div className="p-5 space-y-5 flex-1">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white mb-3">Profile</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: 'Name', value: selectedUser.name },
                      { label: 'Email', value: selectedUser.email || '—' },
                      { label: 'Phone', value: selectedUser.phone || '—' },
                      { label: 'Role', value: selectedUser.role },
                      { label: 'Source', value: selectedUser.source },
                      { label: 'Language', value: selectedUser.preferred_language?.toUpperCase() || '—' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <span className="text-xs text-slate-400 dark:text-slate-500 block">{label}</span>
                        <span className="font-medium text-slate-900 dark:text-white capitalize">{value}</span>
                      </div>
                    ))}
                    <div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 block">Status</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${selectedUser.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
                        {selectedUser.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {selectedUser.provider_company_name && (
                      <div>
                        <span className="text-xs text-slate-400 dark:text-slate-500 block">Company</span>
                        <span className="font-medium text-slate-900 dark:text-white">{selectedUser.provider_company_name}</span>
                      </div>
                    )}
                    {selectedUser.created_at && (
                      <div className="col-span-2">
                        <span className="text-xs text-slate-400 dark:text-slate-500 block">Registered</span>
                        <span className="font-medium text-slate-900 dark:text-white">{new Date(selectedUser.created_at).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white mb-3">Bookings ({selectedUser.registrations.length})</h4>
                  {selectedUser.registrations.length === 0 ? (
                    <p className="text-slate-400 dark:text-slate-500 text-sm">No bookings found.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedUser.registrations.map(reg => (
                        <div key={reg.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-semibold text-sm text-slate-900 dark:text-white">{reg.trip_name || 'Unknown Trip'}</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{reg.booking_reference}</p>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[reg.status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                              {reg.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 mb-2">
                            <span>{reg.total_participants} participant{reg.total_participants !== 1 ? 's' : ''}</span>
                            <span>{reg.total_amount} SAR</span>
                            {reg.registration_date && <span>{new Date(reg.registration_date).toLocaleDateString()}</span>}
                          </div>
                          {reg.payments.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">Payments</p>
                              {reg.payments.map(p => (
                                <div key={p.id} className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                                  <span className="font-mono">{p.moyasar_payment_id || p.id.slice(0, 8)}</span>
                                  <span>{p.amount} {p.currency}</span>
                                  <span className={`px-1.5 py-0.5 rounded-full font-semibold ${STATUS_COLORS[p.status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>{p.status}</span>
                                </div>
                              ))}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Invite New Admin</h2>
              <button onClick={() => { setShowInviteModal(false); setInviteError(null); setInviteSuccess(null); }}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xl leading-none">&times;</button>
            </div>

            {inviteError && (
              <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">{inviteError}</div>
            )}
            {inviteSuccess && (
              <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-sm">{inviteSuccess}</div>
            )}

            <form onSubmit={handleInviteAdmin} className="space-y-4">
              {[
                { label: 'Name', type: 'text', value: inviteName, onChange: setInviteName },
                { label: 'Email', type: 'email', value: inviteEmail, onChange: setInviteEmail },
                { label: 'Phone', type: 'tel', value: invitePhone, onChange: setInvitePhone },
                { label: 'Temporary Password', type: 'password', value: invitePassword, onChange: setInvitePassword },
              ].map(({ label, type, value, onChange }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">{label}</label>
                  <input type={type} value={value} onChange={e => onChange(e.target.value)} required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition" />
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" disabled={inviteLoading}
                  onClick={() => { setShowInviteModal(false); setInviteError(null); setInviteSuccess(null); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60">
                  Cancel
                </button>
                <button type="submit" disabled={inviteLoading}
                  className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                  {inviteLoading ? 'Sending…' : 'Send Invitation'}
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
