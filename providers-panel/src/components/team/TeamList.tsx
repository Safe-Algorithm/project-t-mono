import React from 'react';
import { User } from '@/types/user';

interface TeamListProps {
  members: User[];
  onDelete: (userId: string) => void;
  isDeleting: string | null;
  onUpdateRole: (userId: string, role: string) => void;
  isUpdating: string | null;
}

const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const AVATAR_COLORS = [
  'bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
];

const TeamList: React.FC<TeamListProps> = ({ members, onDelete, isDeleting, onUpdateRole, isUpdating }) => {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No team members yet</p>
        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Invite someone to get started</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {members.map((member, idx) => {
        const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
        const isPending = !member.is_active;

        return (
          <div key={member.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-xl ${avatarColor} flex items-center justify-center flex-shrink-0`}>
              <span className="text-white text-sm font-bold">{getInitials(member.name || member.email)}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{member.name || '—'}</p>
                {isPending && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    Pending Invitation
                  </span>
                )}
                {!isPending && member.role === 'super_user' && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                    Super User
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{member.email}</p>
              {member.phone && (
                <p className="text-xs text-slate-400 dark:text-slate-500">{member.phone}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isPending && (
                <select
                  value={member.role}
                  onChange={e => onUpdateRole(member.id, e.target.value)}
                  disabled={isUpdating === member.id}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 transition"
                >
                  <option value="normal">Normal</option>
                  <option value="super_user">Super User</option>
                </select>
              )}

              <button
                onClick={() => onDelete(member.id)}
                disabled={isDeleting === member.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-60 transition-colors"
              >
                {isDeleting === member.id ? (
                  <>
                    <div className="w-3 h-3 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                    {isPending ? 'Canceling...' : 'Removing...'}
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {isPending ? 'Cancel' : 'Remove'}
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TeamList;
