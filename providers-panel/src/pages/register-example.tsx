import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { fileDefinitionsService, providerFilesService, FileDefinition, ProviderFile } from '@/services/fileDefinitions';
import FileUploadField from '@/components/registration/FileUploadField';

export default function ProviderRegistrationExample() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  
  // File definitions and uploaded files
  const [fileDefinitions, setFileDefinitions] = useState<FileDefinition[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, ProviderFile>>({});
  
  // Basic registration form data
  const [formData, setFormData] = useState({
    company_name: '',
    company_email: '',
    company_phone: '',
  });

  useEffect(() => {
    loadFileRequirements();
  }, []);

  const loadFileRequirements = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch file requirements (public endpoint - no auth needed)
      const definitions = await fileDefinitionsService.getProviderRegistrationRequirements();
      setFileDefinitions(definitions);
      
      // If user is logged in, fetch their uploaded files
      try {
        const files = await providerFilesService.getUploadedFiles();
        const filesMap = files.reduce((acc, file) => {
          acc[file.file_definition_id] = file;
          return acc;
        }, {} as Record<string, ProviderFile>);
        setUploadedFiles(filesMap);
      } catch (err) {
        // User not logged in yet - that's okay
        console.log('No uploaded files yet');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load file requirements');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUploadSuccess = (definitionId: string, file: ProviderFile) => {
    setUploadedFiles(prev => ({
      ...prev,
      [definitionId]: file
    }));
  };

  const handleFileDeleteSuccess = (definitionId: string) => {
    setUploadedFiles(prev => {
      const newFiles = { ...prev };
      delete newFiles[definitionId];
      return newFiles;
    });
  };

  const validateForm = (): string | null => {
    // Validate basic fields
    if (!formData.company_name.trim()) {
      return 'Company name is required';
    }
    if (!formData.company_email.trim()) {
      return 'Company email is required';
    }
    if (!formData.company_phone.trim()) {
      return 'Company phone is required';
    }

    // Validate required files are uploaded
    const requiredDefinitions = fileDefinitions.filter(def => def.is_required && def.is_active);
    const missingFiles = requiredDefinitions.filter(def => !uploadedFiles[def.id]);
    
    if (missingFiles.length > 0) {
      const missingNames = missingFiles.map(def => 
        language === 'ar' ? def.name_ar : def.name_en
      ).join(', ');
      return `Please upload required files: ${missingNames}`;
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Submit registration data
      // In real implementation, this would call your provider registration API
      console.log('Submitting registration:', {
        ...formData,
        uploaded_files: Object.keys(uploadedFiles)
      });

      // Redirect to success page or dashboard
      // router.push('/registration-success');
      alert('Registration submitted successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to submit registration');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {language === 'ar' ? 'تسجيل مزود الخدمة' : 'Provider Registration'}
              </h1>
              <button
                onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                {language === 'en' ? 'العربية' : 'English'}
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {language === 'ar' 
                ? 'يرجى ملء جميع الحقول المطلوبة وتحميل المستندات اللازمة'
                : 'Please fill in all required fields and upload necessary documents'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {language === 'ar' ? 'معلومات الشركة' : 'Company Information'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'ar' ? 'اسم الشركة' : 'Company Name'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'ar' ? 'البريد الإلكتروني للشركة' : 'Company Email'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.company_email}
                    onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'ar' ? 'هاتف الشركة' : 'Company Phone'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.company_phone}
                    onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Required Documents */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {language === 'ar' ? 'المستندات المطلوبة' : 'Required Documents'}
              </h2>
              
              {fileDefinitions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {language === 'ar' 
                    ? 'لا توجد مستندات مطلوبة في الوقت الحالي'
                    : 'No documents required at this time'}
                </p>
              ) : (
                <div className="space-y-6">
                  {fileDefinitions.map((definition) => (
                    <FileUploadField
                      key={definition.id}
                      definition={definition}
                      uploadedFile={uploadedFiles[definition.id] || null}
                      onUploadSuccess={(file) => handleFileUploadSuccess(definition.id, file)}
                      onDeleteSuccess={() => handleFileDeleteSuccess(definition.id)}
                      language={language}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting 
                  ? (language === 'ar' ? 'جاري الإرسال...' : 'Submitting...')
                  : (language === 'ar' ? 'إرسال الطلب' : 'Submit Application')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
