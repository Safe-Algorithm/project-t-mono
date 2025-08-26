import React, { useState, useEffect, FormEvent } from 'react';
import { Trip, CreateTripPackage, FieldMetadata } from '../../types/trip';
import { TripCreatePayload, TripUpdatePayload, tripService } from '../../services/tripService';

interface TripFormProps {
  trip?: Trip;
  onSubmit: (payload: TripCreatePayload | TripUpdatePayload, packages?: CreateTripPackage[], packageFields?: { [index: number]: string[] }) => void;
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

  const [packages, setPackages] = useState<CreateTripPackage[]>([
    { name: '', description: '', price: 0 }
  ]);

  const [packageRequiredFields, setPackageRequiredFields] = useState<{ [index: number]: string[] }>({
    0: []
  });

  const [availableFields, setAvailableFields] = useState<FieldMetadata[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    // Load available fields on component mount
    const loadAvailableFields = async () => {
      try {
        const response = await tripService.getAvailableFields();
        setAvailableFields(response.fields || []);
      } catch (err) {
        console.error('Failed to load available fields:', err);
        setAvailableFields([]); // Ensure it's always an array
      }
    };
    
    loadAvailableFields();

    if (trip) {
      // Populate trip form data
      setFormData({
        name: trip.name,
        description: trip.description,
        start_date: new Date(trip.start_date).toISOString().substring(0, 16),
        end_date: new Date(trip.end_date).toISOString().substring(0, 16),
        price: trip.price.toString(),
        max_participants: trip.max_participants.toString(),
        is_active: trip.is_active,
      });

      // Populate existing packages
      if (trip.packages && trip.packages.length > 0) {
        const existingPackages: CreateTripPackage[] = trip.packages.map(pkg => ({
          name: pkg.name,
          description: pkg.description,
          price: Number(pkg.price)
        }));
        setPackages(existingPackages);

        // Populate existing required fields for each package
        const existingPackageFields: { [index: number]: string[] } = {};
        trip.packages.forEach((pkg, index) => {
          existingPackageFields[index] = pkg.required_fields || [];
        });
        setPackageRequiredFields(existingPackageFields);
      }
    }
  }, [trip]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const addPackage = () => {
    const newIndex = packages.length;
    setPackages([...packages, { name: '', description: '', price: 0 }]);
    setPackageRequiredFields(prev => ({ ...prev, [newIndex]: [] }));
  };

  const removePackage = (index: number) => {
    if (packages.length > 1) {
      setPackages(packages.filter((_, i) => i !== index));
      // Remove the fields for this package and reindex
      const newFields: { [index: number]: string[] } = {};
      Object.keys(packageRequiredFields).forEach(key => {
        const keyIndex = parseInt(key);
        if (keyIndex < index) {
          newFields[keyIndex] = packageRequiredFields[keyIndex];
        } else if (keyIndex > index) {
          newFields[keyIndex - 1] = packageRequiredFields[keyIndex];
        }
      });
      setPackageRequiredFields(newFields);
    }
  };

  const updatePackage = (index: number, field: keyof CreateTripPackage, value: string | number) => {
    const updatedPackages = [...packages];
    updatedPackages[index] = { ...updatedPackages[index], [field]: value };
    setPackages(updatedPackages);
  };

  const updatePackageRequiredFields = (packageIndex: number, selectedFields: string[]) => {
    setPackageRequiredFields(prev => ({
      ...prev,
      [packageIndex]: selectedFields
    }));
  };

  const toggleRequiredField = (packageIndex: number, fieldName: string) => {
    const currentFields = packageRequiredFields[packageIndex] || [];
    const updatedFields = currentFields.includes(fieldName)
      ? currentFields.filter(f => f !== fieldName)
      : [...currentFields, fieldName];
    
    updatePackageRequiredFields(packageIndex, updatedFields);
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    // Validate at least one package
    if (packages.length === 0) {
      newErrors.push('At least one package is required');
    }

    // Validate package details
    packages.forEach((pkg, index) => {
      if (!pkg.name.trim()) {
        newErrors.push(`Package ${index + 1}: Name is required`);
      }
      if (!pkg.description.trim()) {
        newErrors.push(`Package ${index + 1}: Description is required`);
      }
      if (pkg.price <= 0) {
        newErrors.push(`Package ${index + 1}: Price must be greater than 0`);
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const payload = {
        ...formData,
        price: parseFloat(formData.price),
        max_participants: parseInt(formData.max_participants, 10),
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
    };
    onSubmit(payload, packages, packageRequiredFields);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
      {errors.length > 0 && (
        <div style={{ color: 'red', backgroundColor: '#ffebee', padding: '1rem', borderRadius: '4px' }}>
          <h4>Please fix the following errors:</h4>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <h3>Trip Details</h3>
      <input name="name" value={formData.name} onChange={handleChange} placeholder="Trip Name" required />
      <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Description" required />
      <input type="datetime-local" name="start_date" value={formData.start_date} onChange={handleChange} required />
      <input type="datetime-local" name="end_date" value={formData.end_date} onChange={handleChange} required />
      <input type="number" name="price" value={formData.price} onChange={handleChange} placeholder="Base Price" required />
      <input type="number" name="max_participants" value={formData.max_participants} onChange={handleChange} placeholder="Max Participants" required />
      <label>
        <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} />
        Active
      </label>

      <h3>Trip Packages (At least one required)</h3>
      {packages.map((pkg, index) => (
        <div key={index} style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4>Package {index + 1}</h4>
            {packages.length > 1 && (
              <button type="button" onClick={() => removePackage(index)} style={{ color: 'red' }}>
                Remove
              </button>
            )}
          </div>
          <input
            value={pkg.name}
            onChange={(e) => updatePackage(index, 'name', e.target.value)}
            placeholder="Package Name"
            required
          />
          <textarea
            value={pkg.description}
            onChange={(e) => updatePackage(index, 'description', e.target.value)}
            placeholder="Package Description"
            required
          />
          <input
            type="number"
            value={pkg.price}
            onChange={(e) => updatePackage(index, 'price', parseFloat(e.target.value) || 0)}
            placeholder="Package Price"
            min="0.01"
            step="0.01"
            required
          />
          
          <div style={{ marginTop: '1rem' }}>
            <h5>Required Fields for This Package</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
              {availableFields.map((field) => (
                <label key={field.field_name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={(packageRequiredFields[index] || []).includes(field.field_name)}
                    onChange={() => toggleRequiredField(index, field.field_name)}
                  />
                  <span>{field.display_name}</span>
                  <small style={{ color: '#666' }}>({field.ui_type})</small>
                </label>
              ))}
            </div>
            {(packageRequiredFields[index] || []).length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <small style={{ color: '#666' }}>
                  Selected: {(packageRequiredFields[index] || []).length} field(s)
                </small>
              </div>
            )}
          </div>
        </div>
      ))}
      
      <button type="button" onClick={addPackage} style={{ backgroundColor: '#4CAF50', color: 'white' }}>
        Add Another Package
      </button>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : (trip ? 'Update Trip' : 'Create Trip')}
      </button>
    </form>
  );
};

export default TripForm;
