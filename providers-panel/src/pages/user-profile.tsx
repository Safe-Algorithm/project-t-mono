import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { api } from '@/services/api';
import { useAuth } from '@/context/UserContext';
import { rolesService, Role } from '@/services/rolesService';
import { useTranslation } from 'react-i18next';

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

const UserProfile: React.FC = () => {
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [myRoles, setMyRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
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
    fetchMyRoles();
  }, []);

  const fetchMyRoles = async () => {
    try {
      const roles = await rolesService.getMyRoles();
      setMyRoles(roles);
    } catch {
      setMyRoles([]);
    } finally {
      setRolesLoading(false);
    }
  };

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
        setMessage({ type: 'error', text: t('userProfile.invalidImageType') });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: t('userProfile.imageTooLarge') });
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
      setMessage({ type: 'success', text: t('userProfile.avatarUpdated') });
      setAvatarFile(null);
      await fetchUser();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t('userProfile.avatarUploadFailed') });
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailOtp = async () => {
    if (!newEmail || newEmail === user?.email) {
      setMessage({ type: 'error', text: t('userProfile.enterDifferentEmail') });
      return;
    }

    setSendingEmailOtp(true);
    setMessage(null);

    try {
      await api.post('/otp/send-email-change-otp', { email: newEmail });
      setEmailOtpSent(true);
      setMessage({ type: 'success', text: t('userProfile.emailOtpSent') });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t('userProfile.sendOtpFailed') });
    } finally {
      setSendingEmailOtp(false);
    }
  };

  const handleVerifyEmailChange = async () => {
    if (!emailOtp || emailOtp.length !== 6) {
      setMessage({ type: 'error', text: t('userProfile.enterValidOtp') });
      return;
    }

    setVerifyingEmailOtp(true);
    setMessage(null);

    try {
      await api.post('/otp/verify-email-change', { new_email: newEmail, otp: emailOtp });
      setMessage({ type: 'success', text: t('userProfile.emailChanged') });
      
      // Wait a moment to show success message, then logout and redirect
      setTimeout(() => {
        logout();
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t('userProfile.verifyOtpFailed') });
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
        setMessage({ type: 'success', text: t('userProfile.profileUpdated') });
        await fetchUser();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t('userProfile.profileUpdateFailed') });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: t('userProfile.passwordsDontMatch') });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: t('userProfile.passwordTooShort') });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await api.patch('/users/me', { password: newPassword });
      setMessage({ type: 'success', text: t('userProfile.passwordChanged') });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t('userProfile.passwordChangeFailed') });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition text-sm";
  const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";

  const Alert = ({ type, text }: { type: 'success' | 'error'; text: string }) => (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
      type === 'success'
        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
    }`}>
      {type === 'success'
        ? <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        : <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      }
      {text}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('userProfile.title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('userProfile.subtitle')}</p>
      </div>

      {message && <Alert type={message.type} text={message.text} />}

      {/* Avatar + Profile Info */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('userProfile.profilePicture')}</h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover ring-2 ring-slate-200 dark:ring-slate-700" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-2 ring-slate-200 dark:ring-slate-700">
                  <svg className="w-9 h-9 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              )}
              <label htmlFor="avatar-upload" className="absolute -bottom-1 -right-1 w-7 h-7 bg-sky-500 hover:bg-sky-600 text-white rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <input id="avatar-upload" type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" onChange={handleAvatarChange} className="hidden" />
              </label>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t('userProfile.uploadProfilePicture')}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t('userProfile.supportedImageTypes')}</p>
              {avatarFile && (
                <button onClick={handleAvatarUpload} disabled={loading}
                  className="mt-2 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-xs font-medium rounded-xl transition-colors">
                  {t('userProfile.upload')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('userProfile.profileInformation')}</h2>
        </div>
        <form onSubmit={handleProfileUpdate} className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>{t('userProfile.fullName')}</label>
            <input type="text" value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })} className={inputCls} required />
          </div>

          <div>
            <label className={labelCls}>{t('userProfile.emailAddress')}</label>
            {!changingEmail ? (
              <div className="flex gap-2">
                <input type="email" value={profileData.email} disabled className={`${inputCls} flex-1 opacity-60 cursor-not-allowed`} />
                <button type="button" onClick={() => setChangingEmail(true)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
                  {t('userProfile.change')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={t('userProfile.newEmailAddress')} className={`${inputCls} flex-1`} />
                  <button type="button" onClick={handleSendEmailOtp} disabled={sendingEmailOtp || !newEmail}
                    className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-sm font-medium transition-colors whitespace-nowrap">
                    {sendingEmailOtp ? t('userProfile.sending') : t('userProfile.sendOtp')}
                  </button>
                </div>
                {emailOtpSent && (
                  <div className="flex gap-2">
                    <input type="text" value={emailOtp} onChange={e => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={t('userProfile.otpPlaceholder')} maxLength={6} className={`${inputCls} flex-1 text-center tracking-widest`} />
                    <button type="button" onClick={handleVerifyEmailChange} disabled={verifyingEmailOtp || emailOtp.length !== 6}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                      {verifyingEmailOtp ? t('userProfile.verifying') : t('userProfile.verify')}
                    </button>
                  </div>
                )}
                <button type="button" onClick={() => { setChangingEmail(false); setNewEmail(''); setEmailOtp(''); setEmailOtpSent(false); }}
                  className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                  {t('team.cancel')}
                </button>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>{t('userProfile.phoneNumber')}</label>
            <input type="tel" value={profileData.phone} onChange={e => setProfileData({ ...profileData, phone: e.target.value })} className={inputCls} placeholder="+966 5x xxx xxxx" />
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="submit" disabled={loading || (profileData.name === user?.name && profileData.phone === user?.phone)}
              className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
              {loading ? t('roles.saving') : t('userProfile.saveChanges')}
            </button>
          </div>
        </form>
      </div>

      {/* My Roles */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('userProfile.myRoles')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('userProfile.rolesAssigned')}</p>
        </div>
        <div className="px-6 py-5">
          {rolesLoading ? (
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-sm">
              <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-transparent animate-spin" />
              {t('userProfile.loadingRoles')}
            </div>
          ) : myRoles.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('userProfile.noRolesAssigned')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {myRoles.map(role => (
                <span key={role.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-400 text-sm font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  {role.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('userProfile.changePassword')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('userProfile.changePasswordHint')}</p>
        </div>
        <form onSubmit={handlePasswordChange} className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>{t('userProfile.newPassword')}</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls} minLength={8} placeholder={t('userProfile.newPasswordPlaceholder')} />
          </div>
          <div>
            <label className={labelCls}>{t('userProfile.confirmNewPassword')}</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} minLength={8} placeholder={t('userProfile.confirmNewPasswordPlaceholder')} />
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="submit" disabled={loading || !newPassword || !confirmPassword}
              className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
              {loading ? t('userProfile.updating') : t('userProfile.updatePassword')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserProfile;
