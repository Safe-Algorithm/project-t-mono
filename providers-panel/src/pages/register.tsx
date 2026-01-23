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
    <div style={{ padding: '2rem' }}>
      <h1>Provider Registration</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxWidth: '400px', gap: '1rem' }}>
        <h2>User Details</h2>
        <input type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} required />
        <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
        <input type="text" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required />
        <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
        
        <h2>Company Details</h2>
        <input type="text" name="companyName" placeholder="Company Name" value={formData.companyName} onChange={handleChange} required />
        <input type="email" name="companyEmail" placeholder="Company Email" value={formData.companyEmail} onChange={handleChange} required />
        <input type="text" name="companyPhone" placeholder="Company Phone" value={formData.companyPhone} onChange={handleChange} required />
        
        <h2>Required Documents</h2>
        {loadingFiles ? (
          <p>Loading file requirements...</p>
        ) : fileDefinitions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
          <p>No file requirements configured.</p>
        )}
        
        <button type="submit" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
        {success && <p style={{ color: 'green' }}>{success}</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </div>
  );
};

export default RegisterPage;
