import { useState, useRef } from 'react';
import { FileDefinition } from '@/services/fileDefinitions';

interface FileSelectorProps {
  definition: FileDefinition;
  onFileChange: (file: File | null) => void;
  currentFile: File | null;
  language?: 'en' | 'ar';
}

export default function FileSelector({
  definition,
  onFileChange,
  currentFile,
  language = 'en'
}: FileSelectorProps) {
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

  const handleFileSelect = (file: File) => {
    setError(null);
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      onFileChange(null);
      return;
    }

    onFileChange(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
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

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = () => {
    setError(null);
    onFileChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {name}
          {definition.is_required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
        </p>
        <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
          {definition.allowed_extensions.join(', ').toUpperCase()} · max {definition.max_size_mb}MB
        </span>
      </div>

      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{description}</p>
      )}

      {!currentFile ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 px-4 cursor-pointer transition-colors ${
            dragActive
              ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/20'
              : 'border-slate-300 dark:border-slate-600 hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/10'
          }`}
        >
          <svg className={`w-8 h-8 ${dragActive ? 'text-sky-500' : 'text-slate-400 dark:text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-sky-600 dark:text-sky-400">Click to upload</span> or drag and drop
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={definition.allowed_extensions.map(ext => `.${ext}`).join(',')}
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 truncate">{currentFile.name}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">{(currentFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
