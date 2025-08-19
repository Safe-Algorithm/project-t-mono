import React, { useState } from 'react';
import { TeamMemberInvitePayload } from '../../services/teamService';

interface TeamInvitationFormProps {
  onSubmit: (payload: TeamMemberInvitePayload) => Promise<void>;
  isSubmitting: boolean;
  errors: Record<string, string>;
}

const TeamInvitationForm: React.FC<TeamInvitationFormProps> = ({ onSubmit, isSubmitting, errors }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({ email, name, phone, password });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {errors.name && <p style={{ color: 'red' }}>{errors.name}</p>}
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {errors.email && <p style={{ color: 'red' }}>{errors.email}</p>}
      </div>
      <div>
        <label htmlFor="phone">Phone</label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        {errors.phone && <p style={{ color: 'red' }}>{errors.phone}</p>}
      </div>
      <div>
        <label htmlFor="password">Temporary Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {errors.password && <p style={{ color: 'red' }}>{errors.password}</p>}
      </div>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Inviting...' : 'Invite Team Member'}
      </button>
    </form>
  );
};

export default TeamInvitationForm;
