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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (payload: TeamMemberInvitePayload) => {
    setIsSubmitting(true);
        setError(null);
    setFieldErrors({});
    try {
      await teamService.inviteTeamMember(payload);
      router.push('/team'); // Redirect to team list page on success
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
    <div>
      <h1>Invite New Team Member</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <TeamInvitationForm onSubmit={handleSubmit} isSubmitting={isSubmitting} errors={fieldErrors} />
    </div>
  );
};

export default withAuth(InviteTeamMemberPage);
