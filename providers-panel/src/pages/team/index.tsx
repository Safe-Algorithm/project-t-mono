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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Team Management</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Manage your team members and their roles</p>
          </div>
          <Link href="/team/invite">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105">
              + Invite New Member
            </button>
          </Link>
        </div>
      </div>

      {/* Error Messages */}
      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {deleteError && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 px-4 py-3 rounded-lg">
          {deleteError}
        </div>
      )}
      {updateError && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 px-4 py-3 rounded-lg">
          {updateError}
        </div>
      )}

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <TeamList 
            members={members} 
            onDelete={handleDelete} 
            isDeleting={isDeleting} 
            onUpdateRole={handleUpdateRole}
            isUpdating={isUpdating}
          />
        )}
      </div>
    </div>
  );
};

export default withAuth(TeamManagementPage);
