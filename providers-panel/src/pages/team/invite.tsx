import React, { useState } from 'react';
import { useRouter } from 'next/router';
import TeamInvitationForm from '@/components/team/TeamInvitationForm';
import { teamService, TeamMemberInvitePayload } from '@/services/teamService';
import { ApiError } from '@/services/api';
import withAuth from '@/components/auth/withAuth';

const InviteTeamMemberPage = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (payload: TeamMemberInvitePayload) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    try {
      await teamService.inviteTeamMember(payload);
      setSuccess(`Invitation email sent to ${payload.email}! They will receive an email with instructions to join your team.`);
      // Redirect after 3 seconds to show success message
      setTimeout(() => {
        router.push('/team');
      }, 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.fieldErrors) {
          setFieldErrors(err.fieldErrors);
        }
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Invite New Team Member</h1>
        <p className="mt-2 text-sm text-gray-600">Send an invitation to add a new member to your team</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Success!</p>
          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <TeamInvitationForm onSubmit={handleSubmit} isSubmitting={isSubmitting} errors={fieldErrors} />
      </div>
    </div>
  );
};

export default withAuth(InviteTeamMemberPage);
