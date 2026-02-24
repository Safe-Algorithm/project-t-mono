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

  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition placeholder:text-slate-400 dark:placeholder:text-slate-500";

  const renderParameterInput = (validationType: string, paramName: string, paramInfo: any) => {
    const currentValue = currentConfig[validationType]?.[paramName] || '';

    if (paramInfo.type === 'number') {
      return (
        <input
          type="number"
          value={currentValue}
          onChange={(e) => handleParameterChange(validationType, paramName, parseFloat(e.target.value) || 0)}
          placeholder={paramInfo.description}
          className={inputCls}
        />
      );
    } else if (paramInfo.type === 'array' && validationType === 'gender_restrictions' && paramName === 'allowed_genders') {
      const genderOptions = [
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
        { value: 'prefer_not_to_say', label: 'Prefer not to say' }
      ];
      const selectedValues = Array.isArray(currentValue) ? currentValue : [];
      return (
        <div className="flex flex-col gap-2 mt-1">
          {genderOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={selectedValues.includes(option.value)}
                onChange={(e) => {
                  const newValues = e.target.checked
                    ? [...selectedValues, option.value]
                    : selectedValues.filter(v => v !== option.value);
                  handleParameterChange(validationType, paramName, newValues);
                }}
                className="accent-sky-500"
              />
              {option.label}
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
          className={inputCls}
        />
      );
    } else {
      return (
        <input
          type="text"
          value={currentValue}
          onChange={(e) => handleParameterChange(validationType, paramName, e.target.value)}
          placeholder={paramInfo.description}
          className={inputCls}
        />
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 mt-3 py-2 text-sm text-slate-400 dark:text-slate-500">
        <div className="w-4 h-4 rounded-full border-2 border-sky-500 border-t-transparent animate-spin flex-shrink-0" />
        Loading validation options…
      </div>
    );
  }

  const availableValidationKeys = Object.keys(availableValidations);
  const hasAvailableValidations = availableValidationKeys.length > 0;

  return (
    <div className="mt-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        Validation Rules — {fieldMetadata.display_name}
      </p>

      {!hasAvailableValidations ? (
        <p className="text-sm italic text-slate-400 dark:text-slate-500">
          No validation options available for this field type.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure validation rules that participants must meet for this field:
          </p>

          {validationErrors.length > 0 && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
              <p className="font-semibold mb-1">Validation Errors:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {availableValidationKeys.map((validationType) => {
              const metadata = availableValidations[validationType] || validationMetadata[validationType];
              const isEnabled = !!currentConfig[validationType];

              if (!metadata) return null;

              return (
                <div
                  key={validationType}
                  className={`rounded-xl border p-3 transition-colors ${
                    isEnabled
                      ? 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
                  }`}
                >
                  <label className="flex items-center gap-2 cursor-pointer mb-1">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleValidationToggle(validationType)}
                      className="accent-sky-500"
                    />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {metadata.display_name}
                    </span>
                  </label>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 ml-5">
                    {metadata.description}
                  </p>

                  {isEnabled && metadata.parameters && (
                    <div className="ml-5 flex flex-col gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                      {Object.entries(metadata.parameters).map(([paramName, paramInfo]) => (
                        <div key={paramName}>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            {paramName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            {(paramInfo as any).required && <span className="text-red-500 dark:text-red-400"> *</span>}
                          </label>
                          {renderParameterInput(validationType, paramName, paramInfo)}
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {(paramInfo as any).description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {Object.keys(currentConfig).length > 0 && (
            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Current Configuration:</p>
              <pre className="text-xs text-slate-700 dark:text-slate-300 overflow-x-auto">
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
