import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/UserContext';
import { UserRole } from '@/types/user';
import { rolesService, Role, RoleWithPermissions, Permission, UserRoleLink } from '@/services/rolesService';
import { PermissionDeniedError } from '@/services/api';
import { teamService } from '@/services/teamService';
import { User } from '@/types/user';
import PermissionDenied from '@/components/common/PermissionDenied';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'roles' | 'permissions';

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByGroup(permissions: Permission[]): Record<string, Permission[]> {
  return permissions.reduce((acc, p) => {
    if (!acc[p.group_name]) acc[p.group_name] = [];
    acc[p.group_name].push(p);
    return acc;
  }, {} as Record<string, Permission[]>);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const Badge: React.FC<{ label: string; color?: string }> = ({ label, color = 'bg-blue-100 text-blue-800' }) => (
  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
      </div>
      <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { user } = useAuth();
  const isSuperProvider = user?.role === UserRole.SUPER_USER;

  const [tab, setTab] = useState<Tab>('roles');
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [allPerms, setAllPerms] = useState<Permission[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Modals
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [managingPermsRole, setManagingPermsRole] = useState<RoleWithPermissions | null>(null);
  const [managingUsersRole, setManagingUsersRole] = useState<RoleWithPermissions | null>(null);
  const [roleUsers, setRoleUsers] = useState<UserRoleLink[]>([]);

  // Form state
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, p, t] = await Promise.all([
        rolesService.listRoles(),
        rolesService.listPermissions(),
        teamService.getTeamMembers(),
      ]);
      setRoles(r);
      setAllPerms(p);
      setTeamMembers(t);
    } catch (e: any) {
      setError(e instanceof Error ? e : new Error(e?.message || 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Create Role ─────────────────────────────────────────────────────────────

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    setSaving(true);
    try {
      await rolesService.createRole(newRoleName.trim(), newRoleDesc.trim() || undefined);
      setNewRoleName('');
      setNewRoleDesc('');
      setShowCreateRole(false);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete Role ─────────────────────────────────────────────────────────────

  const handleDeleteRole = async (role: Role) => {
    if (role.is_system) { alert('System roles cannot be deleted.'); return; }
    if (!confirm(`Delete role "${role.name}"? This will also remove it from all assigned users.`)) return;
    try {
      await rolesService.deleteRole(role.id);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to delete role');
    }
  };

  // ── Toggle Active ───────────────────────────────────────────────────────────

  const handleToggleActive = async (role: Role) => {
    if (role.is_system) return;
    try {
      await rolesService.updateRole(role.id, { is_active: !role.is_active });
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to update role');
    }
  };

  // ── Permissions Modal ───────────────────────────────────────────────────────

  const openManagePerms = (role: RoleWithPermissions) => {
    setManagingPermsRole(role);
    setSelectedPermIds(new Set(role.permissions.map(p => p.id)));
  };

  const handleSavePerms = async () => {
    if (!managingPermsRole) return;
    setSaving(true);
    try {
      const currentIds = new Set(managingPermsRole.permissions.map(p => p.id));
      const toAdd = Array.from(selectedPermIds).filter(id => !currentIds.has(id));
      const toRemove = Array.from(currentIds).filter(id => !selectedPermIds.has(id));

      if (toAdd.length > 0) await rolesService.addPermissions(managingPermsRole.id, toAdd);
      for (const id of toRemove) await rolesService.removePermission(managingPermsRole.id, id);

      setManagingPermsRole(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const togglePerm = (id: string) => {
    setSelectedPermIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Users Modal ─────────────────────────────────────────────────────────────

  const openManageUsers = async (role: RoleWithPermissions) => {
    setManagingUsersRole(role);
    try {
      const links = await rolesService.listRoleUsers(role.id);
      setRoleUsers(links);
    } catch {
      setRoleUsers([]);
    }
  };

  const handleAssignUser = async (userId: string) => {
    if (!managingUsersRole) return;
    try {
      await rolesService.assignUsersToRole(managingUsersRole.id, [userId]);
      const links = await rolesService.listRoleUsers(managingUsersRole.id);
      setRoleUsers(links);
    } catch (e: any) {
      alert(e?.message || 'Failed to assign user');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!managingUsersRole) return;
    try {
      await rolesService.removeUserFromRole(managingUsersRole.id, userId);
      setRoleUsers(prev => prev.filter(l => l.user_id !== userId));
    } catch (e: any) {
      alert(e?.message || 'Failed to remove user');
    }
  };

  const assignedUserIds = new Set(roleUsers.map(l => l.user_id));
  const unassignedMembers = teamMembers.filter(m => !assignedUserIds.has(m.id));

  // ── Permissions grouped ─────────────────────────────────────────────────────

  const permGroups = groupByGroup(allPerms);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!isSuperProvider) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Only the workspace owner can manage roles and permissions.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Roles & Permissions</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Create custom roles, attach permissions, and assign roles to team members.
            </p>
          </div>
          {tab === 'roles' && (
            <button
              onClick={() => setShowCreateRole(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              + New Role
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          {(['roles', 'permissions'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition -mb-px ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {t === 'roles' ? 'Roles' : 'Available Permissions'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : error instanceof PermissionDeniedError ? (
          <PermissionDenied action="manage roles" />
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error.message}</div>
        ) : tab === 'roles' ? (
          // ── Roles tab ──────────────────────────────────────────────────────
          <div className="space-y-3">
            {roles.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                No roles yet. Create one to get started.
              </div>
            )}
            {roles.map(role => (
              <div
                key={role.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 dark:text-white">{role.name}</span>
                    {role.is_system && <Badge label="System" color="bg-purple-100 text-purple-800" />}
                    {!role.is_active && <Badge label="Inactive" color="bg-gray-100 text-gray-600" />}
                  </div>
                  {role.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{role.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {role.permissions.length === 0 ? (
                      <span className="text-xs text-gray-400 italic">No permissions assigned</span>
                    ) : (
                      role.permissions.slice(0, 4).map(p => (
                        <Badge key={p.id} label={p.name} color="bg-blue-50 text-blue-700" />
                      ))
                    )}
                    {role.permissions.length > 4 && (
                      <Badge label={`+${role.permissions.length - 4} more`} color="bg-gray-100 text-gray-600" />
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => openManagePerms(role)}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition"
                  >
                    Permissions
                  </button>
                  <button
                    onClick={() => openManageUsers(role)}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition"
                  >
                    Members
                  </button>
                  {!role.is_system && (
                    <>
                      <button
                        onClick={() => handleToggleActive(role)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                          role.is_active
                            ? 'border border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                            : 'border border-green-300 text-green-700 hover:bg-green-50'
                        }`}
                      >
                        {role.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role)}
                        className="px-3 py-1.5 text-xs font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // ── Permissions tab ───────────────────────────────────────────────
          <div className="space-y-6">
            {Object.entries(permGroups).map(([group, perms]) => (
              <div key={group}>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{group}</h3>
                <div className="space-y-2">
                  {perms.map(perm => (
                    <div
                      key={perm.id}
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{perm.name}</p>
                          {perm.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{perm.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {perm.rules.map(rule => (
                          <code
                            key={rule.id}
                            className="inline-block bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-2 py-0.5 rounded font-mono"
                          >
                            <span className="font-semibold text-blue-600 dark:text-blue-400">{rule.http_method}</span>
                            {' '}{rule.path_pattern}
                          </code>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Create Role Modal */}
      {showCreateRole && (
        <Modal title="Create New Role" onClose={() => setShowCreateRole(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role Name *</label>
              <input
                type="text"
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                placeholder="e.g. Trip Manager"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={newRoleDesc}
                onChange={e => setNewRoleDesc(e.target.value)}
                placeholder="Optional description"
                rows={3}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCreateRole(false)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRole}
                disabled={saving || !newRoleName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? 'Creating…' : 'Create Role'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manage Permissions Modal */}
      {managingPermsRole && (
        <Modal title={`Permissions — ${managingPermsRole.name}`} onClose={() => setManagingPermsRole(null)}>
          <div className="space-y-5">
            {Object.entries(permGroups).map(([group, perms]) => (
              <div key={group}>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{group}</h4>
                <div className="space-y-1.5">
                  {perms.map(perm => (
                    <label
                      key={perm.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermIds.has(perm.id)}
                        onChange={() => togglePerm(perm.id)}
                        className="mt-0.5 accent-blue-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{perm.name}</p>
                        {perm.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{perm.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setManagingPermsRole(null)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePerms}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? 'Saving…' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manage Members Modal */}
      {managingUsersRole && (
        <Modal title={`Members — ${managingUsersRole.name}`} onClose={() => setManagingUsersRole(null)}>
          <div className="space-y-5">
            {/* Currently assigned */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Assigned Members</h4>
              {roleUsers.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No members assigned yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {roleUsers.map(link => {
                    const member = teamMembers.find(m => m.id === link.user_id);
                    return (
                      <div key={link.user_id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{member?.name || link.user_id}</p>
                          {member?.email && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveUser(link.user_id)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Unassigned members */}
            {unassignedMembers.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Add Member</h4>
                <div className="space-y-1.5">
                  {unassignedMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-dashed border-gray-200 dark:border-gray-600">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</p>
                        {member.email && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleAssignUser(member.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Assign
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setManagingUsersRole(null)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
