import React from 'react';
import { User } from '@/types/user';

interface TeamListProps {
  members: User[];
  onDelete: (userId: string) => void;
  isDeleting: string | null;
  onUpdateRole: (userId: string, role: string) => void;
  isUpdating: string | null;
}

const TeamList: React.FC<TeamListProps> = ({ members, onDelete, isDeleting, onUpdateRole, isUpdating }) => {
  if (members.length === 0) {
    return <p>No team members found.</p>;
  }

  return (
    <ul>
      {members.map((member) => (
        <li key={member.id}>
          <span>{member.name} ({member.email})</span>
          {!member.is_active && (
            <span style={{ 
              marginLeft: '10px', 
              padding: '2px 8px', 
              backgroundColor: '#FEF3C7', 
              color: '#92400E',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              Pending Invitation
            </span>
          )}
          {member.is_active && (
            <>
              <select 
                value={member.role} 
                onChange={(e) => onUpdateRole(member.id, e.target.value)}
                disabled={isUpdating === member.id}
                style={{ marginLeft: '10px' }}
              >
                <option value="normal">Normal</option>
                <option value="super_user">Super User</option>
              </select>
              <button 
                onClick={() => onDelete(member.id)} 
                disabled={isDeleting === member.id}
                style={{ marginLeft: '10px' }}
              >
                {isDeleting === member.id ? 'Deleting...' : 'Delete'}
              </button>
            </>
          )}
          {!member.is_active && (
            <button 
              onClick={() => onDelete(member.id)} 
              disabled={isDeleting === member.id}
              style={{ marginLeft: '10px' }}
            >
              {isDeleting === member.id ? 'Canceling...' : 'Cancel Invitation'}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};

export default TeamList;
