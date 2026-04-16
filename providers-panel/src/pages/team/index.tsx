import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import TeamList from '@/components/team/TeamList';
import { teamService } from '@/services/teamService';
import { rolesService, Role } from '@/services/rolesService';
import withAuth from '@/components/auth/withAuth';
import { useTranslation } from 'react-i18next';

const TeamManagementPage = () => {
  const { t } = useTranslation();
  const { members, isLoading, error, refreshMembers } = useTeamMembers();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [memberRoles, setMemberRoles] = useState<Record<string, Role[]>>({});

  useEffect(() => {
    if (members.length === 0) return;
    const fetchAllRoles = async () => {
      const results = await Promise.allSettled(
        members.map(m => rolesService.getUserRoles(m.id).then(roles => ({ id: m.id, roles })))
      );
      const map: Record<string, Role[]> = {};
      results.forEach(r => { if (r.status === 'fulfilled') map[r.value.id] = r.value.roles; });
      setMemberRoles(map);
    };
    fetchAllRoles();
  }, [members]);

  const handleDelete = async (userId: string) => {
    setIsDeleting(userId);
    setDeleteError(null);
    try {
      await teamService.deleteTeamMember(userId);
      refreshMembers(); // Refresh the list after deletion
    } catch (err: any) {
      setDeleteError(err.message || t('team.deleteMemberFail'));
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
      setUpdateError(err.message || t('team.updateRoleFail'));
    } finally {
      setIsUpdating(null);
    }
  };

  const ErrorBanner = ({ msg }: { msg: string }) => (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      {msg}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('team.pageTitle')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('team.pageSubtitle')}</p>
        </div>
        <Link href="/team/invite"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {t('team.inviteNewMember')}
        </Link>
      </div>

      {error && <ErrorBanner msg={error} />}
      {deleteError && <ErrorBanner msg={deleteError} />}
      {updateError && <ErrorBanner msg={updateError} />}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" />
          </div>
        ) : (
          <TeamList
            members={members}
            onDelete={handleDelete}
            isDeleting={isDeleting}
            onUpdateRole={handleUpdateRole}
            isUpdating={isUpdating}
            memberRoles={memberRoles}
          />
        )}
      </div>
    </div>
  );
};

export default withAuth(TeamManagementPage);
