import { useState, useEffect } from 'react';
import { useAuth } from '@/context/UserContext';
import { providerService } from '@/services/providerService';
import { providerFilesService, FileDefinition, ProviderFile } from '@/services/fileDefinitions';
import ImageCropper from '@/components/ui/ImageCropper';

const ProfilePage = () => {
  const { user, isLoading } = useAuth();
  const [provider, setProvider] = useState<any>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAvatar, setCompanyAvatar] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [companyCover, setCompanyCover] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverCropSrc, setCoverCropSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // File management state
  const [requestStatus, setRequestStatus] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<ProviderFile[]>([]);
  const [missingDefinitions, setMissingDefinitions] = useState<FileDefinition[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: boolean }>({});
  const [fileErrors, setFileErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchProviderProfile = async () => {
      if (user) {
        try {
          const providerData = await providerService.getProviderProfile();
          setProvider(providerData);
          setCompanyName(providerData.company_name || '');
          setCompanyEmail(providerData.company_email || '');
          setCompanyPhone(providerData.company_phone || '');
          setCompanyAvatar(providerData.company_avatar_url || null);
          setCompanyCover(providerData.company_cover_url || null);
          
          // Fetch request status - 404 is expected for approved providers
          try {
            const statusData = await providerService.getRequestStatus();
            setRequestStatus(statusData.status || 'pending');
          } catch (statusError: any) {
            // If 404, provider is approved (no pending request)
            if (statusError.message?.includes('404') || statusError.message?.includes('approved')) {
              setRequestStatus('approved');
            } else {
              throw statusError; // Re-throw if it's a different error
            }
          }
          
          // Fetch uploaded files
          const files = await providerFilesService.getUploadedFiles();
          setUploadedFiles(files);
          
          // Fetch missing file definitions
          const missing = await providerFilesService.getMissingFileDefinitions();
          setMissingDefinitions(missing);
        } catch (error) {
          console.error('Failed to fetch provider profile:', error);
          setError('Failed to load profile data');
        }
      }
    };

    fetchProviderProfile();
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarCropSrc(URL.createObjectURL(file));
      e.target.value = '';
    }
  };

  const handleAvatarCropDone = (blob: Blob, previewUrl: string) => {
    setAvatarCropSrc(null);
    setAvatarFile(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
    setAvatarPreview(previewUrl);
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;

    setUploadingAvatar(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await providerService.uploadCompanyAvatar(avatarFile);
      setCompanyAvatar(response.avatar_url);
      setAvatarFile(null);
      setAvatarPreview(null);
      setSuccess('Company avatar uploaded successfully!');
    } catch (error: any) {
      console.error('Avatar upload failed:', error);
      setError(error.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverCropSrc(URL.createObjectURL(file));
      e.target.value = '';
    }
  };

  const handleCoverCropDone = (blob: Blob, previewUrl: string) => {
    setCoverCropSrc(null);
    setCoverFile(new File([blob], 'cover.jpg', { type: 'image/jpeg' }));
    setCoverPreview(previewUrl);
  };

  const handleCoverUpload = async () => {
    if (!coverFile) return;

    setUploadingCover(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await providerService.uploadCompanyCover(coverFile);
      setCompanyCover(response.cover_url);
      setCoverFile(null);
      setCoverPreview(null);
      setSuccess('Cover image uploaded successfully!');
    } catch (error: any) {
      console.error('Cover upload failed:', error);
      setError(error.message || 'Failed to upload cover image');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await providerService.updateProviderProfile({
        company_name: companyName,
        company_email: companyEmail,
        company_phone: companyPhone,
      });
      setSuccess('Profile updated successfully!');
    } catch (error) {
      console.error('Profile update failed:', error);
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (fileDefinitionId: string, file: File, isReplacement: boolean = false) => {
    setUploadingFiles(prev => ({ ...prev, [fileDefinitionId]: true }));
    setFileErrors(prev => ({ ...prev, [fileDefinitionId]: '' }));

    try {
      if (isReplacement) {
        // Use PUT endpoint for replacements (synchronous)
        await providerFilesService.replaceFile(fileDefinitionId, file);
      } else {
        // Use POST endpoint for new uploads (background task)
        await providerFilesService.uploadFile(fileDefinitionId, file);
      }
      
      // Refresh uploaded files and missing definitions
      const files = await providerFilesService.getUploadedFiles();
      setUploadedFiles(files);
      
      const missing = await providerFilesService.getMissingFileDefinitions();
      setMissingDefinitions(missing);
      
      setSuccess(isReplacement ? 'File replaced successfully!' : 'File uploaded successfully!');
    } catch (error: any) {
      console.error('File upload failed:', error);
      setFileErrors(prev => ({ 
        ...prev, 
        [fileDefinitionId]: error.message || 'Failed to upload file' 
      }));
    } finally {
      setUploadingFiles(prev => ({ ...prev, [fileDefinitionId]: false }));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✓ Accepted</span>;
      case 'rejected':
        return <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs rounded">✗ Rejected</span>;
      case 'processing':
        return <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">⏳ Under Review</span>;
      default:
        return null;
    }
  };

  const canReplaceFile = (file: ProviderFile) => {
    // Only allow replacement if file status is rejected
    return file.file_verification_status === 'rejected';
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition text-sm";
  const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";

  if (isLoading || !user) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Company Profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your company information and documents</p>
      </div>
      
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Company Information</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Update your company details and contact information.</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Cover image */}
          <div className="pb-5 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Cover Image</p>
            <div className="relative w-full h-36 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 ring-2 ring-slate-200 dark:ring-slate-700 mb-3">
              {(coverPreview || companyCover) ? (
                <img src={coverPreview || companyCover || ''} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-1">
                  <svg className="w-8 h-8 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-slate-400 dark:text-slate-500">No cover image</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleCoverChange} className="hidden" id="cover-upload" />
              <label htmlFor="cover-upload" className="cursor-pointer px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Choose cover
              </label>
              {coverFile && (
                <button type="button" onClick={handleCoverUpload} disabled={uploadingCover}
                  className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                  {uploadingCover ? 'Uploading...' : 'Upload'}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">JPG, PNG or WEBP · Source image min 1200×400 px · Crop tool opens before upload</p>
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-5 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex-shrink-0">
              {(avatarPreview || companyAvatar) ? (
                <img src={avatarPreview || companyAvatar || ''} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover ring-2 ring-slate-200 dark:ring-slate-700" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-2 ring-slate-200 dark:ring-slate-700">
                  <svg className="w-9 h-9 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              )}
            </div>
            <div>
              <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" id="avatar-upload" />
              <div className="flex items-center gap-2 flex-wrap">
                <label htmlFor="avatar-upload" className="cursor-pointer px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  Choose image
                </label>
                {avatarFile && (
                  <button type="button" onClick={handleAvatarUpload} disabled={uploadingAvatar}
                    className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                    {uploadingAvatar ? 'Uploading...' : 'Upload'}
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">JPG, PNG or WEBP · Crop tool opens before upload</p>
            </div>
          </div>

          <div>
            <label className={labelCls}>User Email</label>
            <input type="email" value={user.email} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Your login email cannot be changed here</p>
          </div>

          <div>
            <label htmlFor="companyName" className={labelCls}>Company Name *</label>
            <input id="companyName" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className={inputCls} placeholder="Your company name" />
          </div>

          <div>
            <label htmlFor="companyEmail" className={labelCls}>Company Email *</label>
            <input id="companyEmail" type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} required className={inputCls} placeholder="company@example.com" />
          </div>

          <div>
            <label htmlFor="companyPhone" className={labelCls}>Company Phone *</label>
            <input id="companyPhone" type="tel" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} required className={inputCls} placeholder="+966 5x xxx xxxx" />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="submit" disabled={loading}
              className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Uploaded Documents */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Uploaded Documents</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">View your documents. You can replace rejected files.</p>
        </div>
        <div className="px-6 py-5">
          {uploadedFiles.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {uploadedFiles.map(file => {
                const statusMap: Record<string, { cls: string; label: string }> = {
                  accepted: { cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', label: '✓ Accepted' },
                  rejected: { cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', label: '✗ Rejected' },
                  processing: { cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', label: '⏳ Under Review' },
                };
                const badge = statusMap[file.file_verification_status];
                return (
                  <div key={file.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {file.file_definition && (
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{file.file_definition.name_en}</p>
                        )}
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-sky-500 hover:text-sky-600 hover:underline truncate block">
                          {file.file_name}
                        </a>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          {(file.file_size_bytes / 1024 / 1024).toFixed(2)} MB · {file.file_extension.toUpperCase()} · {new Date(file.uploaded_at).toLocaleDateString()}
                        </p>
                        {badge && <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.label}</span>}
                        {file.file_verification_status === 'rejected' && file.rejection_reason && (
                          <div className="mt-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs">
                            <p className="font-semibold text-red-700 dark:text-red-400 mb-0.5">Rejection reason:</p>
                            <p className="text-red-600 dark:text-red-300">{file.rejection_reason}</p>
                          </div>
                        )}
                      </div>
                      {canReplaceFile(file) && (
                        <div className="flex-shrink-0">
                          <label className="cursor-pointer">
                            <input type="file" className="hidden"
                              accept={file.file_definition?.accepted_file_extensions?.map((ext: string) => `.${ext}`).join(',')}
                              disabled={uploadingFiles[file.file_definition_id]}
                              onChange={e => {
                                const selectedFile = e.target.files?.[0];
                                if (selectedFile) {
                                  const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
                                  const acceptedExts = file.file_definition?.accepted_file_extensions?.map((ext: string) => ext.toLowerCase());
                                  if (acceptedExts && fileExt && !acceptedExts.includes(fileExt)) {
                                    setFileErrors(prev => ({ ...prev, [file.file_definition_id]: `Invalid type. Accepted: ${acceptedExts.join(', ')}` }));
                                    return;
                                  }
                                  handleFileUpload(file.file_definition_id, selectedFile, true);
                                }
                              }}
                            />
                            <span className="inline-flex items-center px-3 py-1.5 rounded-xl border border-red-300 dark:border-red-700 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              {uploadingFiles[file.file_definition_id] ? 'Uploading...' : 'Replace'}
                            </span>
                          </label>
                          {fileErrors[file.file_definition_id] && (
                            <p className="text-xs text-red-500 mt-1">{fileErrors[file.file_definition_id]}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Additional Documents */}
      {missingDefinitions.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Additional Documents</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">These documents are available for upload but not yet submitted.</p>
          </div>
          <div className="px-6 py-5 space-y-3">
            {missingDefinitions.map(definition => (
              <div key={definition.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{definition.name_en}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{definition.description_en}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      Allowed: {definition.allowed_extensions.join(', ').toUpperCase()} · Max: {definition.max_size_mb}MB
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <label className="cursor-pointer">
                      <input type="file" className="hidden"
                        accept={definition.allowed_extensions.map((ext: string) => `.${ext}`).join(',')}
                        disabled={uploadingFiles[definition.id]}
                        onChange={e => {
                          const selectedFile = e.target.files?.[0];
                          if (selectedFile) handleFileUpload(definition.id, selectedFile);
                        }}
                      />
                      <span className="inline-flex items-center px-3 py-1.5 rounded-xl border border-sky-500 text-sm font-medium text-sky-500 bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors">
                        {uploadingFiles[definition.id] ? 'Uploading...' : 'Upload'}
                      </span>
                    </label>
                    {fileErrors[definition.id] && (
                      <p className="text-xs text-red-500 mt-1">{fileErrors[definition.id]}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cover image crop modal */}
      {coverCropSrc && (
        <ImageCropper
          imageSrc={coverCropSrc}
          aspectRatio={3}
          minWidth={1200}
          minHeight={400}
          label="Crop Cover Image (3:1)"
          onCrop={handleCoverCropDone}
          onCancel={() => setCoverCropSrc(null)}
        />
      )}

      {/* Avatar crop modal */}
      {avatarCropSrc && (
        <ImageCropper
          imageSrc={avatarCropSrc}
          aspectRatio={1}
          minWidth={200}
          minHeight={200}
          label="Crop Profile Avatar (1:1)"
          onCrop={handleAvatarCropDone}
          onCancel={() => setAvatarCropSrc(null)}
        />
      )}
    </div>
  );
};

export default ProfilePage;
