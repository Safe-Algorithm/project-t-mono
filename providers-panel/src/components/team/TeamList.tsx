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
          <select 
            value={member.role} 
            onChange={(e) => onUpdateRole(member.id, e.target.value)}
            disabled={isUpdating === member.id}
          >
            <option value="provider">Provider</option>
            <option value="super_provider">Super Provider</option>
          </select>
          <button 
            onClick={() => onDelete(member.id)} 
            disabled={isDeleting === member.id}
          >
            {isDeleting === member.id ? 'Deleting...' : 'Delete'}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default TeamList;
