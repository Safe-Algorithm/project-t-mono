import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar_url?: string;
}

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  avatar_url?: string;
}

const Profile: React.FC = () => {
  const router = useRouter();
  const { logout } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    email: '',
    phone: '',
    avatar_url: '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const userData = await api.get<User>('/users/me');
      setUser(userData);
      setProfileData({
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        avatar_url: userData.avatar_url || '',
      });
      setAvatarPreview(userData.avatar_url || null);
    } catch (error: any) {
      console.error('Failed to fetch user:', error);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setMessage({ type: 'error', text: 'Invalid file type. Please upload a JPG, PNG, GIF, or WebP image.' });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'File size exceeds 5MB limit.' });
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', avatarFile);

      await api.postFormData('/users/me/avatar', formData);
      setMessage({ type: 'success', text: 'Avatar updated successfully!' });
      setAvatarFile(null);
      await fetchUser();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to upload avatar' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailOtp = async () => {
    if (!newEmail || newEmail === user?.email) {
      setMessage({ type: 'error', text: 'Please enter a different email address' });
      return;
    }

    setSendingEmailOtp(true);
    setMessage(null);

    try {
      await api.post('/otp/send-email-change-otp', { email: newEmail });
      setEmailOtpSent(true);
      setMessage({ type: 'success', text: 'OTP sent to new email address' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to send OTP' });
    } finally {
      setSendingEmailOtp(false);
    }
  };

  const handleVerifyEmailChange = async () => {
    if (!emailOtp || emailOtp.length !== 6) {
      setMessage({ type: 'error', text: 'Please enter a valid 6-digit OTP' });
      return;
    }

    setVerifyingEmailOtp(true);
    setMessage(null);

    try {
      await api.post('/otp/verify-email-change', { new_email: newEmail, otp: emailOtp });
      setMessage({ type: 'success', text: 'Email changed successfully! Redirecting to login...' });
      
      // Wait a moment to show success message, then logout and redirect
      setTimeout(() => {
        logout();
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to verify OTP' });
      setVerifyingEmailOtp(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const updateData: any = {};

      if (profileData.name !== user?.name) {
        updateData.name = profileData.name;
      }

      if (profileData.phone !== user?.phone) {
        updateData.phone = profileData.phone;
      }

      if (Object.keys(updateData).length > 0) {
        await api.patch('/users/me', updateData);
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        await fetchUser();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await api.patch('/users/me', { password: newPassword });
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition";
  const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your account information</p>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl border text-sm ${
          message.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Avatar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Profile Picture</h2>
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-700" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-slate-200 dark:border-slate-700">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
            )}
            <label htmlFor="avatar-upload" className="absolute -bottom-1 -right-1 w-7 h-7 bg-sky-500 hover:bg-sky-600 text-white rounded-lg flex items-center justify-center cursor-pointer transition-colors shadow-sm">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <input id="avatar-upload" type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" onChange={handleAvatarChange} className="hidden" />
            </label>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Max size: 5MB</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">JPG, PNG, GIF, WebP</p>
            {avatarFile && (
              <button onClick={handleAvatarUpload} disabled={loading}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {loading ? 'Uploading…' : 'Upload Avatar'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Profile Information</h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div>
            <label className={labelCls}>Name</label>
            <input type="text" value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })} className={inputCls} required />
          </div>

          <div>
            <label className={labelCls}>Email</label>
            {!changingEmail ? (
              <div className="flex gap-2">
                <input type="email" value={profileData.email} disabled
                  className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-sm" />
                <button type="button" onClick={() => setChangingEmail(true)}
                  className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors">
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="New email address" className={inputCls + ' flex-1'} />
                  <button type="button" onClick={handleSendEmailOtp} disabled={sendingEmailOtp || !newEmail}
                    className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex-shrink-0">
                    {sendingEmailOtp ? 'Sending…' : 'Send OTP'}
                  </button>
                </div>
                {emailOtpSent && (
                  <div className="flex gap-2">
                    <input type="text" value={emailOtp} onChange={e => setEmailOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit OTP" maxLength={6} className={inputCls + ' flex-1'} />
                    <button type="button" onClick={handleVerifyEmailChange} disabled={verifyingEmailOtp || emailOtp.length !== 6}
                      className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex-shrink-0">
                      {verifyingEmailOtp ? 'Verifying…' : 'Verify'}
                    </button>
                  </div>
                )}
                <button type="button" onClick={() => { setChangingEmail(false); setNewEmail(''); setEmailOtp(''); setEmailOtpSent(false); }}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Phone</label>
            <input type="tel" value={profileData.phone} onChange={e => setProfileData({ ...profileData, phone: e.target.value })} className={inputCls} />
          </div>

          <button type="submit" disabled={loading || (profileData.name === user?.name && profileData.phone === user?.phone)}
            className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className={labelCls}>New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls} minLength={8} />
          </div>
          <div>
            <label className={labelCls}>Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} minLength={8} />
          </div>
          <button type="submit" disabled={loading || !newPassword || !confirmPassword}
            className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
            {loading ? 'Updating…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;
