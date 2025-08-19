import React, { useState, useEffect, FormEvent } from 'react';
import { Trip } from '../../types/trip';
import { TripCreatePayload, TripUpdatePayload } from '../../services/tripService';

interface TripFormProps {
  trip?: Trip;
  onSubmit: (payload: TripCreatePayload | TripUpdatePayload) => void;
  isSubmitting: boolean;
}

const TripForm: React.FC<TripFormProps> = ({ trip, onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    price: '',
    max_participants: '',
    is_active: true,
  });

  useEffect(() => {
    if (trip) {
      setFormData({
        name: trip.name,
        description: trip.description,
        start_date: new Date(trip.start_date).toISOString().substring(0, 16),
        end_date: new Date(trip.end_date).toISOString().substring(0, 16),
        price: trip.price.toString(),
        max_participants: trip.max_participants.toString(),
        is_active: trip.is_active,
      });
    }
  }, [trip]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
        ...formData,
        price: parseFloat(formData.price),
        max_participants: parseInt(formData.max_participants, 10),
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
      <input name="name" value={formData.name} onChange={handleChange} placeholder="Trip Name" required />
      <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Description" required />
      <input type="datetime-local" name="start_date" value={formData.start_date} onChange={handleChange} required />
      <input type="datetime-local" name="end_date" value={formData.end_date} onChange={handleChange} required />
      <input type="number" name="price" value={formData.price} onChange={handleChange} placeholder="Price" required />
      <input type="number" name="max_participants" value={formData.max_participants} onChange={handleChange} placeholder="Max Participants" required />
      <label>
        <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} />
        Active
      </label>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : (trip ? 'Update Trip' : 'Create Trip')}
      </button>
    </form>
  );
};

export default TripForm;
