import React, { useState } from 'react';
import { useProviderProfile } from '@/hooks/useProviderProfile';
import ProviderProfileForm from '@/components/provider/ProviderProfileForm';
import { providerService } from '@/services/providerService';
import { ProviderUpdatePayload } from '@/types/provider';
import withAuth from '@/components/auth/withAuth';

const EditProfilePage = () => {
  const { profile, isLoading, error, refreshProfile } = useProviderProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (payload: ProviderUpdatePayload) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await providerService.updateProviderProfile(payload);
      setSuccessMessage('Profile updated successfully!');
      refreshProfile();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h1>Edit Company Profile</h1>
      {isLoading && <p>Loading profile...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {submitError && <p style={{ color: 'red' }}>{submitError}</p>}
      {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}

      {profile && (
        <ProviderProfileForm 
          provider={profile} 
          onSubmit={handleSubmit} 
          isSubmitting={isSubmitting} 
        />
      )}
    </div>
  );
};

export default withAuth(EditProfilePage);
