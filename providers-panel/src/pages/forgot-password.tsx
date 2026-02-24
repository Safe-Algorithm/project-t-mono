import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const ForgotPassword: React.FC = () => {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/otp/send-password-reset-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'providers_panel',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to send OTP');
      }

      setOtpSent(true);
      setStep('otp');
      setMessage({ type: 'success', text: 'OTP sent to your email. Please check your inbox.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to send OTP' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/otp/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'providers_panel',
        },
        body: JSON.stringify({
          email,
          otp,
          new_password: newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to reset password');
      }

      setStep('success');
      setMessage({ type: 'success', text: 'Password reset successfully! Redirecting to login...' });
      
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to reset password' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/otp/send-password-reset-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'providers_panel',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to resend OTP');
      }

      setMessage({ type: 'success', text: 'OTP resent successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to resend OTP' });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition text-sm";
  const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-500 shadow-lg mb-4">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reset Password</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {step === 'email' && 'Enter your email to receive a verification code'}
            {step === 'otp' && `Enter the code sent to ${email}`}
            {step === 'success' && 'Password reset successfully!'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm space-y-5">
          {message && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
            }`}>
              {message.type === 'success'
                ? <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                : <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              }
              {message.text}
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label htmlFor="email" className={labelCls}>Email Address</label>
                <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
              <div className="text-center">
                <Link href="/login" className="text-sm text-sky-500 hover:text-sky-600 font-medium transition-colors">
                  Back to Login
                </Link>
              </div>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="otp" className={labelCls}>Verification Code</label>
                <input id="otp" type="text" required maxLength={6} value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  className={`${inputCls} text-center text-2xl tracking-widest`} placeholder="000000" />
              </div>
              <div>
                <label htmlFor="newPassword" className={labelCls}>New Password</label>
                <input id="newPassword" type="password" required minLength={8} value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} className={inputCls} placeholder="Min. 8 characters" />
              </div>
              <div>
                <label htmlFor="confirmPassword" className={labelCls}>Confirm Password</label>
                <input id="confirmPassword" type="password" required minLength={8} value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} className={inputCls} placeholder="Repeat new password" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={handleResendOTP} disabled={loading}
                  className="text-sky-500 hover:text-sky-600 font-medium disabled:opacity-50 transition-colors">
                  Resend Code
                </button>
                <button type="button" onClick={() => { setStep('email'); setOtp(''); setNewPassword(''); setConfirmPassword(''); setMessage(null); }}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                  Change Email
                </button>
              </div>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center py-4">
              <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
                <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Redirecting to login...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
