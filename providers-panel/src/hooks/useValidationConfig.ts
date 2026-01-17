import { useState, useEffect, useCallback } from 'react';
import { ValidationConfig, ValidationMetadata, FieldMetadata } from '../types/trip';
import { tripService } from '../services/tripService';

interface UseValidationConfigReturn {
  availableValidations: Record<string, ValidationMetadata>;
  allValidationMetadata: Record<string, ValidationMetadata>;
  loading: boolean;
  error: string | null;
  validateConfig: (fieldType: string, config: ValidationConfig) => Promise<{ isValid: boolean; errors: string[] }>;
  validateValue: (fieldType: string, value: string, config: ValidationConfig) => Promise<{ isValid: boolean; errors: string[] }>;
}

export const useValidationConfig = (fieldType?: string): UseValidationConfigReturn => {
  const [availableValidations, setAvailableValidations] = useState<Record<string, ValidationMetadata>>({});
  const [allValidationMetadata, setAllValidationMetadata] = useState<Record<string, ValidationMetadata>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadValidationData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const promises = [
          tripService.getAllValidationMetadata()
        ];
        
        if (fieldType) {
          promises.push(tripService.getAvailableValidations(fieldType));
        }
        
        const results = await Promise.all(promises);
        setAllValidationMetadata(results[0]);
        
        if (fieldType && results[1]) {
          setAvailableValidations(results[1]);
        }
      } catch (err) {
        console.error('Failed to load validation data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load validation data');
      } finally {
        setLoading(false);
      }
    };

    loadValidationData();
  }, [fieldType]);

  const validateConfig = useCallback(async (fieldType: string, config: ValidationConfig) => {
    try {
      const result = await tripService.validateConfig(fieldType, config);
      return { isValid: result.is_valid, errors: result.errors };
    } catch (err) {
      console.error('Failed to validate config:', err);
      return { isValid: false, errors: ['Failed to validate configuration'] };
    }
  }, []);

  const validateValue = useCallback(async (fieldType: string, value: string, config: ValidationConfig) => {
    try {
      const result = await tripService.validateValue(fieldType, value, config);
      return { isValid: result.is_valid, errors: result.errors };
    } catch (err) {
      console.error('Failed to validate value:', err);
      return { isValid: false, errors: ['Failed to validate value'] };
    }
  }, []);

  return {
    availableValidations,
    allValidationMetadata,
    loading,
    error,
    validateConfig,
    validateValue
  };
};
