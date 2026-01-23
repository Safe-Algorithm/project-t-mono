import { useState, useRef } from 'react';
import { FileDefinition, ProviderFile, providerFilesService } from '@/services/fileDefinitions';

interface FileUploadFieldProps {
  definition: FileDefinition;
  uploadedFile: ProviderFile | null;
  onUploadSuccess: (file: ProviderFile) => void;
  onDeleteSuccess: () => void;
  language: 'en' | 'ar';
}

export default function FileUploadField({
  definition,
  uploadedFile,
  onUploadSuccess,
  onDeleteSuccess,
  language
}: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const name = language === 'ar' ? definition.name_ar : definition.name_en;
  const description = language === 'ar' ? definition.description_ar : definition.description_en;

  const validateFile = (file: File): string | null => {
    // Check extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !definition.allowed_extensions.includes(extension)) {
      return `Invalid file type. Allowed: ${definition.allowed_extensions.join(', ')}`;
    }

    // Check size
    const maxSizeBytes = definition.max_size_mb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File too large. Maximum size: ${definition.max_size_mb}MB`;
    }

    return null;
  };

  const handleFileSelect = async (file: File) => {
    setError(null);

    // Validate
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Upload
    setUploading(true);
    try {
      const response = await providerFilesService.uploadFile(definition.id, file);
      
      // Fetch updated file list to get the full file object
      const files = await providerFilesService.getUploadedFiles();
      const uploadedFile = files.find(f => f.id === response.file_id);
      
      if (uploadedFile) {
        onUploadSuccess(uploadedFile);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!uploadedFile || !confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      await providerFilesService.deleteFile(uploadedFile.id);
      onDeleteSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to delete file');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {name}
        {definition.is_required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <p className="text-sm text-gray-600 mb-3">{description}</p>

      {!uploadedFile ? (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={definition.allowed_extensions.map(ext => `.${ext}`).join(',')}
            onChange={handleChange}
            disabled={uploading}
          />

          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-sm text-gray-600">Uploading...</p>
            </div>
          ) : (
            <>
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm text-gray-600 mb-1">
                <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                {definition.allowed_extensions.map(ext => ext.toUpperCase()).join(', ')} (max {definition.max_size_mb}MB)
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <svg
                className="h-10 w-10 text-blue-600 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {uploadedFile.file_name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatFileSize(uploadedFile.file_size_bytes)} • Uploaded {new Date(uploadedFile.uploaded_at).toLocaleDateString()}
                </p>
                {uploadedFile.file_verification_status === 'accepted' && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Accepted
                  </div>
                )}
                {uploadedFile.file_verification_status === 'rejected' && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Rejected
                  </div>
                )}
                {uploadedFile.file_verification_status === 'processing' && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Under Review
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleDelete}
              className="ml-4 text-red-600 hover:text-red-800 p-1"
              title="Delete file"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
