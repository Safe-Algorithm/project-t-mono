import React from 'react';

interface ValidationConfig {
  [key: string]: any;
}

interface ValidationDisplayProps {
  fieldType: string;
  fieldDisplayName: string;
  validationConfig: ValidationConfig | null;
}

const ValidationDisplay: React.FC<ValidationDisplayProps> = ({
  fieldType,
  fieldDisplayName,
  validationConfig
}) => {
  if (!validationConfig || Object.keys(validationConfig).length === 0) {
    return (
      <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        No validation rules configured
      </div>
    );
  }

  const formatValidationRule = (ruleType: string, ruleConfig: any) => {
    switch (ruleType) {
      case 'min_age':
        return `Minimum age: ${ruleConfig.min_value} years`;
      case 'max_age':
        return `Maximum age: ${ruleConfig.max_value} years`;
      case 'min_length':
        return `Minimum length: ${ruleConfig.min_length} characters`;
      case 'max_length':
        return `Maximum length: ${ruleConfig.max_length} characters`;
      case 'phone_country_codes':
        return `Allowed country codes: ${ruleConfig.allowed_codes?.join(', ') || 'None'}`;
      case 'phone_min_length':
        return `Minimum phone length: ${ruleConfig.min_length} digits`;
      case 'phone_max_length':
        return `Maximum phone length: ${ruleConfig.max_length} digits`;
      case 'gender_restrictions':
        return `Allowed genders: ${ruleConfig.allowed_genders?.join(', ') || 'None'}`;
      case 'nationality_restriction':
        return `Allowed nationalities: ${ruleConfig.allowed_nationalities?.join(', ') || 'None'}`;
      case 'regex_pattern':
        return `Pattern: ${ruleConfig.pattern}`;
      case 'saudi_id_format':
        return 'Must be valid Saudi ID format';
      case 'iqama_format':
        return 'Must be valid Iqama format';
      case 'passport_format':
        return 'Must be valid passport format';
      case 'required_format':
        return `Required format: ${ruleConfig.format}`;
      default:
        return `${ruleType}: ${JSON.stringify(ruleConfig)}`;
    }
  };

  return (
    <div className="mt-2 p-2 bg-sky-50 dark:bg-sky-900/20 rounded-lg border-l-4 border-sky-300 dark:border-sky-700">
      <div className="text-xs font-semibold text-sky-800 dark:text-sky-300 mb-1">
        Validation Rules:
      </div>
      <div className="space-y-0.5">
        {Object.entries(validationConfig).map(([ruleType, ruleConfig]) => (
          <div key={ruleType} className="text-xs text-sky-700 dark:text-sky-400">
            • {formatValidationRule(ruleType, ruleConfig)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ValidationDisplay;
