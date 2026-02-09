import { useState, useEffect } from 'react';
import { useAuth } from '@/context/UserContext';
import { providerService } from '@/services/providerService';
import { providerFilesService, FileDefinition, ProviderFile } from '@/services/fileDefinitions';

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
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
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

  if (isLoading || !user) return <div className="flex justify-center items-center h-64"><p>Loading...</p></div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Provider Profile</h1>
      
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Company Information</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Update your company details and contact information.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
          {/* Company Avatar Section */}
          <div className="border-b border-gray-200 pb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Company Avatar
            </label>
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                {(avatarPreview || companyAvatar) ? (
                  <img
                    src={avatarPreview || companyAvatar || ''}
                    alt="Company Avatar"
                    className="h-24 w-24 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300 dark:border-gray-600">
                    <svg className="h-12 w-12 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                  id="avatar-upload"
                />
                <label
                  htmlFor="avatar-upload"
                  className="inline-block px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Choose Image
                </label>
                {avatarFile && (
                  <button
                    type="button"
                    onClick={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="ml-2 inline-block px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {uploadingAvatar ? 'Uploading...' : 'Upload Avatar'}
                  </button>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  JPG, PNG or WEBP. Max size 5MB.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="userEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              User Email
            </label>
            <input
              id="userEmail"
              type="email"
              value={user.email}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Your user email cannot be changed</p>
          </div>

          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Company Name *
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your company name"
            />
          </div>

          <div>
            <label htmlFor="companyEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Company Email *
            </label>
            <input
              id="companyEmail"
              type="email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your company email"
            />
          </div>

          <div>
            <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Company Phone *
            </label>
            <input
              id="companyPhone"
              type="tel"
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your company phone number"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Uploaded Files Section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg mt-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Uploaded Documents</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            View your uploaded documents. You can replace rejected files.
          </p>
        </div>
        <div className="px-6 py-4">
          {uploadedFiles.length === 0 ? (
            <p className="text-gray-500 text-sm">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
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
                      <p className="text-xs text-gray-500 mt-1">
                        {(file.file_size_bytes / 1024 / 1024).toFixed(2)} MB • 
                        {file.file_extension.toUpperCase()} • 
                        Uploaded {new Date(file.uploaded_at).toLocaleDateString()}
                      </p>
                      <div className="mt-2">
                        {getStatusBadge(file.file_verification_status)}
                        {file.file_verification_status === 'rejected' && file.rejection_reason && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs">
                            <p className="font-semibold text-red-800 mb-1">Rejection Reason:</p>
                            <p className="text-red-700">{file.rejection_reason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {canReplaceFile(file) && (
                      <div className="ml-4">
                        {file.file_definition && file.file_definition.accepted_file_extensions && (
                          <p className="text-xs text-gray-500 mb-1">
                            Accepted: {file.file_definition.accepted_file_extensions.join(', ')}
                          </p>
                        )}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept={file.file_definition?.accepted_file_extensions?.map((ext: string) => `.${ext}`).join(',')}
                            onChange={(e) => {
                              const selectedFile = e.target.files?.[0];
                              if (selectedFile) {
                                // Validate file extension
                                const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
                                const acceptedExts = file.file_definition?.accepted_file_extensions?.map((ext: string) => ext.toLowerCase());
                                
                                if (acceptedExts && fileExt && !acceptedExts.includes(fileExt)) {
                                  setFileErrors(prev => ({
                                    ...prev,
                                    [file.file_definition_id]: `Invalid file type. Accepted: ${acceptedExts.join(', ')}`
                                  }));
                                  return;
                                }
                                
                                handleFileUpload(file.file_definition_id, selectedFile, true);
                              }
                            }}
                            disabled={uploadingFiles[file.file_definition_id]}
                          />
                          <span className="inline-flex items-center px-3 py-1 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
                            {uploadingFiles[file.file_definition_id] ? 'Uploading...' : 'Replace'}
                          </span>
                        </label>
                        {fileErrors[file.file_definition_id] && (
                          <p className="text-xs text-red-600 mt-1">{fileErrors[file.file_definition_id]}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Missing File Definitions Section */}
      {missingDefinitions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg mt-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Additional Documents</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              These documents are available for upload but not yet submitted.
            </p>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-3">
              {missingDefinitions.map((definition) => (
                <div key={definition.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{definition.name_en}</p>
                      <p className="text-xs text-gray-600 mt-1">{definition.description_en}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Allowed: {definition.allowed_extensions.join(', ').toUpperCase()} • 
                        Max size: {definition.max_size_mb}MB
                      </p>
                    </div>
                    <div className="ml-4">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept={definition.allowed_extensions.map(ext => `.${ext}`).join(',')}
                          onChange={(e) => {
                            const selectedFile = e.target.files?.[0];
                            if (selectedFile) {
                              handleFileUpload(definition.id, selectedFile);
                            }
                          }}
                          disabled={uploadingFiles[definition.id]}
                        />
                        <span className="inline-flex items-center px-3 py-1 border border-blue-600 rounded-md text-sm font-medium text-blue-600 bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50">
                          {uploadingFiles[definition.id] ? 'Uploading...' : 'Upload'}
                        </span>
                      </label>
                      {fileErrors[definition.id] && (
                        <p className="text-xs text-red-600 mt-1">{fileErrors[definition.id]}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
