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
    <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <strong>{name}</strong>
        {definition.is_required && <span style={{ color: 'red', marginLeft: '0.25rem' }}>*</span>}
      </div>
      
      {description && (
        <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>{description}</p>
      )}

      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>
        Allowed: {definition.allowed_extensions.join(', ')} | Max size: {definition.max_size_mb}MB
      </div>

      {!currentFile ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? '#4CAF50' : '#ccc'}`,
            borderRadius: '4px',
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: dragActive ? '#f0f8f0' : '#fafafa',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
          <p>Click to select or drag and drop</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={definition.allowed_extensions.map(ext => `.${ext}`).join(',')}
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f0f8f0', 
          borderRadius: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontWeight: 'bold' }}>✓ {currentFile.name}</div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              {(currentFile.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Remove
          </button>
        </div>
      )}

      {error && (
        <div style={{ 
          marginTop: '0.5rem', 
          padding: '0.5rem', 
          backgroundColor: '#ffebee', 
          color: '#c62828',
          borderRadius: '4px',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
