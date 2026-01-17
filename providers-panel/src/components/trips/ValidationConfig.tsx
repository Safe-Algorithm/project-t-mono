import React, { useState, useEffect } from 'react';
import { ValidationConfig, ValidationMetadata, FieldMetadata } from '../../types/trip';
import { tripService } from '../../services/tripService';

interface ValidationConfigProps {
  fieldMetadata: FieldMetadata;
  currentConfig: ValidationConfig;
  onConfigChange: (config: ValidationConfig) => void;
  onValidate?: (isValid: boolean, errors: string[]) => void;
}

const ValidationConfigComponent: React.FC<ValidationConfigProps> = ({
  fieldMetadata,
  currentConfig,
  onConfigChange,
  onValidate
}) => {
  const [availableValidations, setAvailableValidations] = useState<Record<string, ValidationMetadata>>({});
  const [validationMetadata, setValidationMetadata] = useState<Record<string, ValidationMetadata>>({});
  const [loading, setLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    const loadValidationData = async () => {
      try {
        setLoading(true);
        console.log('Loading validation data for field:', fieldMetadata.field_name);
        console.log('Field available_validations:', fieldMetadata.available_validations);
        
        // Load all validation metadata
        const metadataResponse = await tripService.getAllValidationMetadata();
        console.log('Loaded validation metadata response:', Object.keys(metadataResponse));
        
        // The API returns data nested under 'validation_metadata' key
        const metadata = (metadataResponse as any).validation_metadata || metadataResponse;
        console.log('Actual validation metadata:', Object.keys(metadata));
        setValidationMetadata(metadata);
        
        // Filter available validations for this field type from the field metadata
        const available: Record<string, ValidationMetadata> = {};
        if (fieldMetadata.available_validations && fieldMetadata.available_validations.length > 0) {
          fieldMetadata.available_validations.forEach(validationType => {
            console.log(`Checking validation type: ${validationType}`);
            if ((metadata as any)[validationType]) {
              available[validationType] = (metadata as any)[validationType];
              console.log(`Added validation ${validationType}:`, (metadata as any)[validationType]);
            } else {
              console.warn(`Validation type ${validationType} not found in metadata. Available keys:`, Object.keys(metadata));
            }
          });
        } else {
          console.warn('No available_validations found in field metadata');
        }
        console.log('Final available validations:', available);
        setAvailableValidations(available);
      } catch (error) {
        console.error('Failed to load validation data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadValidationData();
  }, [fieldMetadata.field_name, fieldMetadata.available_validations]);

  useEffect(() => {
    // Validate config whenever it changes
    const validateConfig = async () => {
      if (Object.keys(currentConfig).length === 0) {
        setValidationErrors([]);
        onValidate?.(true, []);
        return;
      }

      try {
        const result = await tripService.validateConfig(fieldMetadata.field_name, currentConfig);
        setValidationErrors(result.errors);
        onValidate?.(result.is_valid, result.errors);
      } catch (error) {
        console.error('Failed to validate config:', error);
        setValidationErrors(['Failed to validate configuration']);
        onValidate?.(false, ['Failed to validate configuration']);
      }
    };

    validateConfig();
  }, [currentConfig, fieldMetadata.field_name, onValidate]);

  const handleValidationToggle = (validationType: string) => {
    const newConfig = { ...currentConfig };
    
    if (newConfig[validationType]) {
      delete newConfig[validationType];
    } else {
      // Initialize with default values
      const metadata = validationMetadata[validationType];
      const defaultConfig: Record<string, any> = {};
      
      if (metadata?.parameters) {
        Object.entries(metadata.parameters).forEach(([paramName, paramInfo]) => {
          if (paramInfo.default !== undefined) {
            defaultConfig[paramName] = paramInfo.default;
          } else if (paramInfo.type === 'number') {
            defaultConfig[paramName] = 0;
          } else if (paramInfo.type === 'string') {
            defaultConfig[paramName] = '';
          } else if (paramInfo.type === 'array') {
            defaultConfig[paramName] = [];
          }
        });
      }
      
      newConfig[validationType] = defaultConfig;
    }
    
    onConfigChange(newConfig);
  };

  const handleParameterChange = (validationType: string, paramName: string, value: any) => {
    const newConfig = { ...currentConfig };
    if (!newConfig[validationType]) {
      newConfig[validationType] = {};
    }
    newConfig[validationType][paramName] = value;
    onConfigChange(newConfig);
  };

  const renderParameterInput = (validationType: string, paramName: string, paramInfo: any) => {
    const currentValue = currentConfig[validationType]?.[paramName] || '';
    
    if (paramInfo.type === 'number') {
      return (
        <input
          type="number"
          value={currentValue}
          onChange={(e) => handleParameterChange(validationType, paramName, parseFloat(e.target.value) || 0)}
          placeholder={paramInfo.description}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
        />
      );
    } else if (paramInfo.type === 'array' && validationType === 'gender_restrictions' && paramName === 'allowed_genders') {
      // Special handling for gender restrictions - multi-select from available gender options
      const genderOptions = [
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
        { value: 'prefer_not_to_say', label: 'Prefer not to say' }
      ];
      
      const selectedValues = Array.isArray(currentValue) ? currentValue : [];
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {genderOptions.map((option) => (
            <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={selectedValues.includes(option.value)}
                onChange={(e) => {
                  let newValues;
                  if (e.target.checked) {
                    newValues = [...selectedValues, option.value];
                  } else {
                    newValues = selectedValues.filter(v => v !== option.value);
                  }
                  handleParameterChange(validationType, paramName, newValues);
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      );
    } else if (paramInfo.type === 'array') {
      return (
        <input
          type="text"
          value={Array.isArray(currentValue) ? currentValue.join(', ') : currentValue}
          onChange={(e) => {
            const arrayValue = e.target.value.split(',').map(v => v.trim()).filter(v => v);
            handleParameterChange(validationType, paramName, arrayValue);
          }}
          placeholder={`${paramInfo.description} (comma-separated)`}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
        />
      );
    } else {
      return (
        <input
          type="text"
          value={currentValue}
          onChange={(e) => handleParameterChange(validationType, paramName, e.target.value)}
          placeholder={paramInfo.description}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
        />
      );
    }
  };

  if (loading) {
    return <div>Loading validation options...</div>;
  }

  const availableValidationKeys = Object.keys(availableValidations);
  const hasAvailableValidations = availableValidationKeys.length > 0;

  // Debug logging
  console.log('ValidationConfig render:', {
    fieldName: fieldMetadata.field_name,
    availableValidationKeys,
    hasAvailableValidations,
    loading,
    fieldAvailableValidations: fieldMetadata.available_validations,
    availableValidations,
    validationMetadata
  });

  return (
    <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      <h4 style={{ margin: '0 0 1rem 0', color: '#333' }}>
        Validation Rules for {fieldMetadata.display_name}
      </h4>
      
      {!hasAvailableValidations ? (
        <p style={{ color: '#666', fontStyle: 'italic' }}>
          No validation options available for this field type.
        </p>
      ) : (
        <>
          <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 1rem 0' }}>
            Configure validation rules that participants must meet for this field:
          </p>
          
          {validationErrors.length > 0 && (
            <div style={{ 
              color: '#d32f2f', 
              backgroundColor: '#ffebee', 
              padding: '0.5rem', 
              borderRadius: '4px', 
              marginBottom: '1rem',
              fontSize: '0.9rem'
            }}>
              <strong>Validation Errors:</strong>
              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {availableValidationKeys.map((validationType) => {
              const metadata = availableValidations[validationType] || validationMetadata[validationType];
              const isEnabled = !!currentConfig[validationType];
              
              if (!metadata) {
                return null;
              }

              return (
                <div key={validationType} style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '6px', 
                  padding: '1rem',
                  backgroundColor: isEnabled ? '#f0f8ff' : '#fff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleValidationToggle(validationType)}
                      style={{ transform: 'scale(1.2)' }}
                    />
                    <label style={{ fontWeight: 'bold', color: '#333' }}>
                      {metadata.display_name}
                    </label>
                  </div>
                  
                  <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 1rem 0' }}>
                    {metadata.description}
                  </p>

                  {isEnabled && metadata.parameters && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {Object.entries(metadata.parameters).map(([paramName, paramInfo]) => (
                        <div key={paramName}>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '0.9rem', 
                            fontWeight: '500', 
                            marginBottom: '0.25rem',
                            color: '#555'
                          }}>
                            {paramName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            {paramInfo.required && <span style={{ color: '#d32f2f' }}> *</span>}
                          </label>
                          {renderParameterInput(validationType, paramName, paramInfo)}
                          <small style={{ color: '#666', fontSize: '0.8rem' }}>
                            {paramInfo.description}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {Object.keys(currentConfig).length > 0 && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.75rem', 
              backgroundColor: '#f5f5f5', 
              borderRadius: '4px',
              fontSize: '0.8rem'
            }}>
              <strong>Current Configuration:</strong>
              <pre style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#333' }}>
                {JSON.stringify(currentConfig, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ValidationConfigComponent;
