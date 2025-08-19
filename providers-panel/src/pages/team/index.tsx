import React, { useState } from 'react';
import Link from 'next/link';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import TeamList from '@/components/team/TeamList';
import { teamService } from '@/services/teamService';
import withAuth from '@/components/auth/withAuth';

const TeamManagementPage = () => {
  const { members, isLoading, error, refreshMembers } = useTeamMembers();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleDelete = async (userId: string) => {
    setIsDeleting(userId);
    setDeleteError(null);
    try {
      await teamService.deleteTeamMember(userId);
      refreshMembers(); // Refresh the list after deletion
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete team member');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    setIsUpdating(userId);
    setUpdateError(null);
    try {
      await teamService.updateTeamMemberRole(userId, role);
      refreshMembers();
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update role');
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div>
      <h1>Team Management</h1>
      <Link href="/team/invite">
        <button>Invite New Member</button>
      </Link>

      {isLoading && <p>Loading team members...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {deleteError && <p style={{ color: 'red' }}>{deleteError}</p>}
      {updateError && <p style={{ color: 'red' }}>{updateError}</p>}

      {!isLoading && !error && (
        <TeamList 
          members={members} 
          onDelete={handleDelete} 
          isDeleting={isDeleting} 
          onUpdateRole={handleUpdateRole}
          isUpdating={isUpdating}
        />
      )}
    </div>
  );
};

export default withAuth(TeamManagementPage);
