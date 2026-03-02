import { useState, FormEvent, useEffect } from 'react';
import { providerService } from '../services/providerService';
import { FullRegistrationPayload } from '../types/user';
import { fileDefinitionsService, FileDefinition, ProviderFileGroup } from '../services/fileDefinitions';
import FileSelector from '../components/registration/FileSelector';
import { useTranslation } from 'react-i18next';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const RegisterPage = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    companyName: '',
    companyEmail: '',
    companyPhone: '',
  });

  const [emailVerified, setEmailVerified] = useState(false);
  const [emailEditable, setEmailEditable] = useState(true);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');

  // File groups
  const [fileGroups, setFileGroups] = useState<ProviderFileGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // File definitions (from the selected group, or global if no groups exist)
  const [fileDefinitions, setFileDefinitions] = useState<FileDefinition[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{ [key: string]: File | null }>({});
  const [loadingFiles, setLoadingFiles] = useState(false);

  // 1. Load available file groups on mount
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const resp = await fileDefinitionsService.getFileGroups();
        setFileGroups(resp.items);
        // If no groups configured, fall back to global definitions
        if (resp.items.length === 0) {
          setLoadingFiles(true);
          const defs = await fileDefinitionsService.getProviderRegistrationRequirements();
          setFileDefinitions(defs);
          const initialFiles: { [key: string]: File | null } = {};
          defs.forEach(d => { initialFiles[d.id] = null; });
          setUploadedFiles(initialFiles);
          setLoadingFiles(false);
        }
      } catch (err) {
        console.error('Failed to fetch file groups:', err);
      } finally {
        setLoadingGroups(false);
      }
    };
    fetchGroups();
  }, []);

  // 2. When provider selects a group, load its definitions
  useEffect(() => {
    if (!selectedGroupId) {
      setFileDefinitions([]);
      setUploadedFiles({});
      return;
    }
    const fetchGroupDefs = async () => {
      setLoadingFiles(true);
      try {
        const group = await fileDefinitionsService.getFileGroupById(selectedGroupId);
        const defs = group.file_definitions.filter(d => d.is_active);
        setFileDefinitions(defs);
        const initialFiles: { [key: string]: File | null } = {};
        defs.forEach(d => { initialFiles[d.id] = null; });
        setUploadedFiles(initialFiles);
      } catch (err) {
        console.error('Failed to fetch group definitions:', err);
      } finally {
        setLoadingFiles(false);
      }
    };
    fetchGroupDefs();
  }, [selectedGroupId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSendOTP = async () => {
    if (!formData.email) {
      setError('Please enter an email address');
      return;
    }

    setSendingOtp(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/otp/send-email-otp-registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'providers_panel',
        },
        body: JSON.stringify({ email: formData.email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to send OTP');
      }

      setOtpSent(true);
      setEmailEditable(false);
      setSuccess('OTP sent to your email. Please check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setVerifyingOtp(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/otp/verify-email-otp-registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'providers_panel',
        },
        body: JSON.stringify({ email: formData.email, otp }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Invalid OTP');
      }

      const data = await response.json();
      setVerificationToken(data.verification_token);
      setEmailVerified(true);
      setSuccess('Email verified successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleEditEmail = () => {
    setEmailEditable(true);
    setEmailVerified(false);
    setOtpSent(false);
    setOtp('');
    setVerificationToken('');
    setSuccess(null);
  };

  const handleFileChange = (fileDefinitionId: string) => (file: File | null) => {
    setUploadedFiles(prev => ({
      ...prev,
      [fileDefinitionId]: file
    }));
  };

    const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Check email verification
    if (!emailVerified) {
      setError(t('register.errorVerifyEmail'));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validate required files
    const requiredFiles = fileDefinitions.filter(def => def.is_required);
    const missingFiles = requiredFiles.filter(def => !uploadedFiles[def.id]);
    
    if (missingFiles.length > 0) {
      setError(t('register.missingFiles', { files: missingFiles.map(f => f.name_en).join(', ') }));
      setLoading(false);
      return;
    }

    const payload: FullRegistrationPayload = {
      user: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      },
      provider: {
        company_name: formData.companyName,
        company_email: formData.companyEmail,
        company_phone: formData.companyPhone,
        ...(selectedGroupId ? { file_group_id: selectedGroupId } : {}),
      },
    };

    try {
      // Step 1: Register provider (creates user and provider)
      const result = await providerService.registerProvider(payload);
      console.log('Registration successful:', result);
      
      // Step 2: Login to get access token for file uploads
      const loginResult = await providerService.login({
        email: formData.email,
        password: formData.password
      });
      
      // Store token temporarily for file uploads
      localStorage.setItem('provider_access_token', loginResult.access_token);
      
      // Step 3: Upload files - backend processes them in background
      const filesToUpload = Object.entries(uploadedFiles).filter(([_, file]) => file !== null);
      
      if (filesToUpload.length > 0) {
        const { providerFilesService } = await import('../services/fileDefinitions');
        
        // Upload all files - backend returns immediately and processes in background
        const uploadPromises = filesToUpload.map(async ([fileDefinitionId, file]) => {
          if (file) {
            try {
              await providerFilesService.uploadFile(fileDefinitionId, file);
              console.log(`File accepted for definition ${fileDefinitionId}`);
            } catch (uploadErr) {
              console.error(`Failed to upload file for definition ${fileDefinitionId}:`, uploadErr);
            }
          }
        });
        
        // Send all files - backend validates and accepts them immediately
        await Promise.all(uploadPromises);
      }
      
      setSuccess(t('register.successMsg'));
      
      // Redirect to login page after brief delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      
    } catch (err) {
       if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during registration.');
      }
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition text-sm';
  const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5';
  const sectionTitleCls = 'text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-sky-500 to-sky-700 flex-col items-center justify-center p-12 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-white" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-white" />
        </div>
        <div className="relative z-10 text-center text-white">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h1 className="text-5xl font-bold mb-2">رحلة</h1>
          <p className="text-xl font-light opacity-90 mb-1">Rihla</p>
          <p className="text-sm opacity-75 mt-4 max-w-xs leading-relaxed">
            {t('register.subtitle')}
          </p>
          <div className="mt-8 space-y-3 text-start">
            {[
              t('register.feature1'),
              t('register.feature2'),
              t('register.feature3'),
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-white/90 text-sm">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Top controls */}
        <div className="flex justify-end items-center gap-2 p-4 flex-shrink-0">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>

        <div className="flex-1 flex items-start justify-center px-6 py-6">
          <div className="w-full max-w-lg">
            {/* Mobile brand */}
            <div className="lg:hidden text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-sky-500 flex items-center justify-center mx-auto mb-3 shadow-md">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">رحلة</h2>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              {t('register.title')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {t('register.subtitle')}
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* ── User Details ── */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <p className={sectionTitleCls}>{t('register.userDetails')}</p>

                <div>
                  <label className={labelCls}>{t('register.fullName')}</label>
                  <input type="text" name="name" placeholder={t('register.fullNamePlaceholder')} value={formData.name} onChange={handleChange} required className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>{t('register.emailAddress')}</label>
                  <div className="flex gap-2">
                    <input
                      type="email" name="email" placeholder="you@company.com"
                      value={formData.email} onChange={handleChange}
                      disabled={!emailEditable} required
                      className={`${inputCls} flex-1 ${!emailEditable ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                    {!emailVerified && emailEditable && (
                      <button type="button" onClick={handleSendOTP} disabled={sendingOtp || !formData.email}
                        className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap">
                        {sendingOtp
                          ? <span className="flex items-center gap-1.5"><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{t('register.sending')}</span>
                          : t('register.verify')}
                      </button>
                    )}
                    {emailVerified && (
                      <button type="button" onClick={handleEditEmail}
                        className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium rounded-xl transition-colors whitespace-nowrap">
                        {t('register.edit')}
                      </button>
                    )}
                  </div>

                  {otpSent && !emailVerified && (
                    <div className="mt-3 p-3 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl space-y-2">
                      <p className="text-xs text-sky-700 dark:text-sky-400">{t('register.otpSentHint')}</p>
                      <div className="flex gap-2">
                        <input type="text" placeholder={t('register.enterOtp')}
                          value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6}
                          className={`${inputCls} flex-1 tracking-widest font-mono`} />
                        <button type="button" onClick={handleVerifyOTP} disabled={verifyingOtp || otp.length !== 6}
                          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap">
                          {verifyingOtp
                            ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                            : t('register.confirm')}
                        </button>
                        <button type="button" onClick={handleSendOTP} disabled={sendingOtp}
                          className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm rounded-xl transition-colors whitespace-nowrap">
                          {t('register.resend')}
                        </button>
                      </div>
                    </div>
                  )}

                  {emailVerified && (
                    <div className="mt-2 flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {t('register.emailVerified')}
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelCls}>{t('register.phone')}</label>
                  <input type="text" name="phone" placeholder="+966 50 123 4567" value={formData.phone} onChange={handleChange} required className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>{t('register.password')}</label>
                  <input type="password" name="password" placeholder="••••••••" value={formData.password} onChange={handleChange} required className={inputCls} />
                </div>
              </div>
            
              {/* ── Company Details ── */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <p className={sectionTitleCls}>{t('register.companyDetails')}</p>

                <div>
                  <label className={labelCls}>{t('register.companyName')}</label>
                  <input type="text" name="companyName" placeholder={t('register.companyNamePlaceholder')} value={formData.companyName} onChange={handleChange} required className={inputCls} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>{t('register.companyEmail')}</label>
                    <input type="email" name="companyEmail" placeholder="info@company.com" value={formData.companyEmail} onChange={handleChange} required className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('register.companyPhone')}</label>
                    <input type="text" name="companyPhone" placeholder="+966 11 123 4567" value={formData.companyPhone} onChange={handleChange} required className={inputCls} />
                  </div>
                </div>
              </div>

              {/* ── Registration Category (File Group) ── */}
              {fileGroups.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                  <p className={sectionTitleCls}>{t('register.registrationCategory') || 'Registration Category'}</p>
                  {loadingGroups ? (
                    <div className="flex items-center gap-3 py-4">
                      <div className="w-4 h-4 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">Loading categories...</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('register.selectGroupHint') || 'Select the category that matches your company type. The required documents will update accordingly.'}
                      </p>
                      <div className="grid grid-cols-1 gap-3">
                        {fileGroups.map((group) => (
                          <label
                            key={group.id}
                            className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              selectedGroupId === group.id
                                ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <input
                              type="radio"
                              name="file_group"
                              value={group.id}
                              checked={selectedGroupId === group.id}
                              onChange={() => setSelectedGroupId(group.id)}
                              className="mt-1 accent-sky-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                {isRTL ? group.name_ar : group.name_en}
                              </p>
                              {(isRTL ? group.description_ar : group.description_en) && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {isRTL ? group.description_ar : group.description_en}
                                </p>
                              )}
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                {group.file_definitions.length} document{group.file_definitions.length !== 1 ? 's' : ''} required
                              </p>
                            </div>
                            {selectedGroupId === group.id && (
                              <svg className="w-5 h-5 text-sky-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Required Documents ── */}
              {(fileGroups.length === 0 || selectedGroupId) && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                  <p className={sectionTitleCls}>{t('register.requiredDocs')}</p>
                  {loadingFiles ? (
                    <div className="flex items-center justify-center gap-3 py-8">
                      <div className="w-5 h-5 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('register.loadingRequirements')}</p>
                    </div>
                  ) : fileDefinitions.length > 0 ? (
                    <div className="space-y-3">
                      {fileDefinitions.map(definition => (
                        <FileSelector
                          key={definition.id}
                          definition={definition}
                          onFileChange={handleFileChange(definition.id)}
                          currentFile={uploadedFiles[definition.id]}
                          language={isRTL ? 'ar' : 'en'}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
                      {t('register.noDocRequirements')}
                    </p>
                  )}
                </div>
              )}

              {/* ── Alerts ── */}
              {success && (
                <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* ── Submit ── */}
              <button
                type="submit"
                disabled={loading || !emailVerified}
                className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('register.registering')}
                  </span>
                ) : emailVerified
                  ? t('register.completeRegistration')
                  : t('register.verifyEmailFirst')}
              </button>

              <p className="text-center text-sm text-slate-500 dark:text-slate-400 pb-6">
                {t('register.alreadyHaveAccount')}{' '}
                <a href="/login" className="text-sky-500 hover:text-sky-600 font-semibold">
                  {t('register.signIn')}
                </a>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
