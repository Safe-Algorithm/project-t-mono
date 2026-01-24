import { useState, FormEvent, useEffect } from 'react';
import { providerService } from '../services/providerService';
import { FullRegistrationPayload } from '../types/user';
import { fileDefinitionsService, FileDefinition } from '../services/fileDefinitions';
import FileSelector from '../components/registration/FileSelector';

const RegisterPage = () => {
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

  const [fileDefinitions, setFileDefinitions] = useState<FileDefinition[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{ [key: string]: File | null }>({});
  const [loadingFiles, setLoadingFiles] = useState(true);

  useEffect(() => {
    const fetchFileRequirements = async () => {
      try {
        const definitions = await fileDefinitionsService.getProviderRegistrationRequirements();
        setFileDefinitions(definitions);
        // Initialize uploadedFiles state
        const initialFiles: { [key: string]: File | null } = {};
        definitions.forEach(def => {
          initialFiles[def.id] = null;
        });
        setUploadedFiles(initialFiles);
      } catch (err) {
        console.error('Failed to fetch file requirements:', err);
      } finally {
        setLoadingFiles(false);
      }
    };
    fetchFileRequirements();
  }, []);

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
      setError('Please verify your email before submitting');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validate required files
    const requiredFiles = fileDefinitions.filter(def => def.is_required);
    const missingFiles = requiredFiles.filter(def => !uploadedFiles[def.id]);
    
    if (missingFiles.length > 0) {
      setError(`Please upload all required files: ${missingFiles.map(f => f.name_en).join(', ')}`);
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
      
      setSuccess('Registration successful! Your documents are being processed.');
      
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Provider Registration</h1>
          <p className="mt-2 text-sm text-gray-600">Create your provider account to start offering trips</p>
        </div>
        
        <div className="bg-white shadow-lg rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">User Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    name="name" 
                    placeholder="John Doe" 
                    value={formData.name} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <div className="flex gap-2">
                    <input 
                      type="email" 
                      name="email" 
                      placeholder="john@example.com" 
                      value={formData.email} 
                      onChange={handleChange} 
                      disabled={!emailEditable}
                      required 
                      className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!emailEditable ? 'bg-gray-100' : ''}`}
                    />
                    {!emailVerified && emailEditable && (
                      <button 
                        type="button" 
                        onClick={handleSendOTP} 
                        disabled={sendingOtp || !formData.email}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
                      >
                        {sendingOtp ? 'Sending...' : 'Verify Email'}
                      </button>
                    )}
                    {emailVerified && (
                      <button 
                        type="button" 
                        onClick={handleEditEmail}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 whitespace-nowrap transition-colors"
                      >
                        Edit Email
                      </button>
                    )}
                  </div>
                  
                  {otpSent && !emailVerified && (
                    <div className="flex gap-2 mt-2">
                      <input 
                        type="text" 
                        placeholder="Enter 6-digit OTP" 
                        value={otp} 
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button 
                        type="button" 
                        onClick={handleVerifyOTP} 
                        disabled={verifyingOtp || otp.length !== 6}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
                      >
                        {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
                      </button>
                      <button 
                        type="button" 
                        onClick={handleSendOTP} 
                        disabled={sendingOtp}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
                      >
                        Resend
                      </button>
                    </div>
                  )}
                  
                  {emailVerified && (
                    <p className="text-green-600 text-sm mt-2 flex items-center">
                      <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Email verified
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input 
                    type="text" 
                    name="phone" 
                    placeholder="+966 50 123 4567" 
                    value={formData.phone} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input 
                    type="password" 
                    name="password" 
                    placeholder="••••••••" 
                    value={formData.password} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Company Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input 
                    type="text" 
                    name="companyName" 
                    placeholder="ABC Travel Company" 
                    value={formData.companyName} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Email</label>
                  <input 
                    type="email" 
                    name="companyEmail" 
                    placeholder="info@company.com" 
                    value={formData.companyEmail} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Phone</label>
                  <input 
                    type="text" 
                    name="companyPhone" 
                    placeholder="+966 11 123 4567" 
                    value={formData.companyPhone} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Required Documents</h2>
              {loadingFiles ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="ml-3 text-gray-600">Loading file requirements...</p>
                </div>
              ) : fileDefinitions.length > 0 ? (
                <div className="space-y-4">
                  {fileDefinitions.map(definition => (
                    <FileSelector
                      key={definition.id}
                      definition={definition}
                      onFileChange={handleFileChange(definition.id)}
                      currentFile={uploadedFiles[definition.id]}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No file requirements configured.</p>
              )}
            </div>
            
            <div className="pt-6">
              <button 
                type="submit" 
                disabled={loading || !emailVerified}
                className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Registering...
                  </span>
                ) : emailVerified ? 'Complete Registration' : 'Verify Email First'}
              </button>
              
              {success && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {success}
                  </p>
                </div>
              )}
              
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </p>
                </div>
              )}
            </div>
          </form>
        </div>
        
        <p className="text-center mt-6 text-sm text-gray-600">
          Already have an account?{' '}
          <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in here</a>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
