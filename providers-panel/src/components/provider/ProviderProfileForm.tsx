import React, { useState, useEffect } from 'react';
import { Provider, ProviderUpdatePayload } from '@/types/provider';

interface ProviderProfileFormProps {
  provider: Provider;
  onSubmit: (payload: ProviderUpdatePayload) => void;
  isSubmitting: boolean;
}

const ProviderProfileForm: React.FC<ProviderProfileFormProps> = ({ provider, onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState<ProviderUpdatePayload>({
    company_name: '',
    company_email: '',
    company_phone: '',
    company_metadata: {},
  });

  useEffect(() => {
    if (provider) {
      setFormData({
        company_name: provider.company_name,
        company_email: provider.company_email,
        company_phone: provider.company_phone,
        company_metadata: provider.company_metadata || {},
      });
    }
  }, [provider]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target; 
    if (['description', 'website', 'address'].includes(name)) {
      setFormData((prev) => ({
        ...prev,
        company_metadata: { ...prev.company_metadata, [name]: value },
      }));
    } else {
    setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="company_name">Company Name</label>
        <input
          type="text"
          id="company_name"
          name="company_name"
          value={formData.company_name || ''}
          onChange={handleChange}
        />
      </div>
      <div>
        <label htmlFor="company_email">Company Email</label>
        <input
          type="email"
          id="company_email"
          name="company_email"
          value={formData.company_email || ''}
          onChange={handleChange}
        />
      </div>
      <div>
        <label htmlFor="company_phone">Company Phone</label>
        <input
          type="tel"
          id="company_phone"
          name="company_phone"
          value={formData.company_phone || ''}
          onChange={handleChange}
        />
      </div>
      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={formData.company_metadata?.description || ''}
          onChange={handleChange}
        />
      </div>
      <div>
        <label htmlFor="website">Website</label>
        <input
          type="url"
          id="website"
          name="website"
          value={formData.company_metadata?.website || ''}
          onChange={handleChange}
        />
      </div>
      <div>
        <label htmlFor="address">Address</label>
        <input
          type="text"
          id="address"
          name="address"
          value={formData.company_metadata?.address || ''}
          onChange={handleChange}
        />
      </div>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
};

export default ProviderProfileForm;
