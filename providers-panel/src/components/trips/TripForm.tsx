import React, { useState, useEffect, FormEvent } from 'react';
import { Trip, CreateTripPackage, FieldMetadata, ValidationConfig, TripAmenity } from '../../types/trip';
import { TripCreatePayload, TripUpdatePayload, tripService } from '../../services/tripService';
import ValidationConfigComponent from './ValidationConfig';

interface TripFormProps {
  trip?: Trip;
  onSubmit: (
    payload: TripCreatePayload | TripUpdatePayload, 
    packages?: CreateTripPackage[], 
    packageFields?: { [index: number]: string[] }, 
    validationConfigs?: { [packageIndex: number]: { [fieldName: string]: ValidationConfig } },
    imageData?: { newImages: File[], imagesToDelete: string[] }
  ) => void;
  isSubmitting: boolean;
}

const TripForm: React.FC<TripFormProps> = ({ trip, onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    max_participants: '',
    is_active: true,
    is_refundable: true,
    has_meeting_place: false,
    meeting_location: '',
    meeting_time: '',
  });

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const [tripImages, setTripImages] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);

  const [packages, setPackages] = useState<CreateTripPackage[]>([
    { name: '', description: '', price: 0, currency: 'SAR' }
  ]);

  const [packageRequiredFields, setPackageRequiredFields] = useState<{ [index: number]: string[] }>({
    0: ['name', 'date_of_birth'] // Always include mandatory fields
  });

  const [packageValidationConfigs, setPackageValidationConfigs] = useState<{ [packageIndex: number]: { [fieldName: string]: ValidationConfig } }>({
    0: {} // Initialize with empty validation configs for first package
  });

  const [availableFields, setAvailableFields] = useState<FieldMetadata[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [showValidationConfig, setShowValidationConfig] = useState<{ [packageIndex: number]: { [fieldName: string]: boolean } }>({});

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
    
    // Ensure mandatory fields are always selected for existing packages
    const ensureMandatoryFields = () => {
      setPackageRequiredFields(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          const mandatoryFields = ['name', 'date_of_birth'];
          const currentFields = updated[parseInt(key)] || [];
          const allFields = Array.from(new Set([...mandatoryFields, ...currentFields]));
          updated[parseInt(key)] = allFields;
        });
        return updated;
      });
    };
    
    ensureMandatoryFields();

    if (trip) {
      // Populate trip form data
      setFormData({
        name: trip.name,
        description: trip.description,
        start_date: new Date(trip.start_date).toISOString().substring(0, 16),
        end_date: new Date(trip.end_date).toISOString().substring(0, 16),
        max_participants: trip.max_participants.toString(),
        is_active: trip.is_active,
        is_refundable: trip.is_refundable ?? true,
        has_meeting_place: trip.has_meeting_place ?? false,
        meeting_location: trip.meeting_location ?? '',
        meeting_time: trip.meeting_time ? new Date(trip.meeting_time).toISOString().substring(0, 16) : '',
      });

      // Populate amenities
      if (trip.amenities && trip.amenities.length > 0) {
        setSelectedAmenities(trip.amenities);
      }

      // Load existing images
      if (trip.images && trip.images.length > 0) {
        setTripImages(trip.images);
      }

      // Populate existing packages
      if (trip.packages && trip.packages.length > 0) {
        const existingPackages: CreateTripPackage[] = trip.packages.map(pkg => ({
          name: pkg.name,
          description: pkg.description,
          price: Number(pkg.price),
          currency: pkg.currency || 'SAR'
        }));
        setPackages(existingPackages);

        // Populate existing required fields for each package
        const existingPackageFields: { [index: number]: string[] } = {};
        const existingValidationConfigs: { [packageIndex: number]: { [fieldName: string]: ValidationConfig } } = {};
        
        trip.packages.forEach((pkg, index) => {
          const fields = pkg.required_fields || [];
          // Always ensure mandatory fields are included
          const mandatoryFields = ['name', 'date_of_birth'];
          const allFields = Array.from(new Set([...mandatoryFields, ...fields]));
          existingPackageFields[index] = allFields;
          
          // Populate existing validation configs
          const packageValidationConfigs: { [fieldName: string]: ValidationConfig } = {};
          if (pkg.required_fields_details) {
            pkg.required_fields_details.forEach((fieldDetail: any) => {
              if (fieldDetail.validation_config && Object.keys(fieldDetail.validation_config).length > 0) {
                packageValidationConfigs[fieldDetail.field_type] = fieldDetail.validation_config;
              }
            });
          }
          existingValidationConfigs[index] = packageValidationConfigs;
        });
        
        setPackageRequiredFields(existingPackageFields);
        setPackageValidationConfigs(existingValidationConfigs);
      }
    }
  }, [trip]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    // For datetime inputs, ensure seconds are always set to 00
    if ((name === 'start_date' || name === 'end_date' || name === 'meeting_time') && value) {
      const dateValue = value + ':00'; // Append :00 for seconds
      setFormData((prev) => ({ ...prev, [name]: dateValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity) 
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  const amenityLabels: Record<string, string> = {
    [TripAmenity.FLIGHT_TICKETS]: 'Flight Tickets',
    [TripAmenity.BUS]: 'Bus Transportation',
    [TripAmenity.TOUR_GUIDE]: 'Tour Guide',
    [TripAmenity.TOURS]: 'Tours',
    [TripAmenity.HOTEL]: 'Hotel Accommodation',
    [TripAmenity.MEALS]: 'Meals',
    [TripAmenity.INSURANCE]: 'Travel Insurance',
    [TripAmenity.VISA_ASSISTANCE]: 'Visa Assistance',
  };

  const addPackage = () => {
    const newIndex = packages.length;
    setPackages([...packages, { name: '', description: '', price: 0, currency: 'SAR' }]);
    // Always include mandatory fields for new packages
    setPackageRequiredFields(prev => ({ ...prev, [newIndex]: ['name', 'date_of_birth'] }));
    // Initialize empty validation configs for new package
    setPackageValidationConfigs(prev => ({ ...prev, [newIndex]: {} }));
  };

  const removePackage = (index: number) => {
    if (packages.length > 1) {
      setPackages(packages.filter((_, i) => i !== index));
      // Remove the fields for this package and reindex
      const newFields: { [index: number]: string[] } = {};
      const newValidationConfigs: { [packageIndex: number]: { [fieldName: string]: ValidationConfig } } = {};
      
      Object.keys(packageRequiredFields).forEach(key => {
        const keyIndex = parseInt(key);
        if (keyIndex < index) {
          newFields[keyIndex] = packageRequiredFields[keyIndex];
          newValidationConfigs[keyIndex] = packageValidationConfigs[keyIndex] || {};
        } else if (keyIndex > index) {
          newFields[keyIndex - 1] = packageRequiredFields[keyIndex];
          newValidationConfigs[keyIndex - 1] = packageValidationConfigs[keyIndex] || {};
        }
      });
      setPackageRequiredFields(newFields);
      setPackageValidationConfigs(newValidationConfigs);
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
    // Don't allow removal of mandatory fields
    const mandatoryFields = ['name', 'date_of_birth'];
    if (mandatoryFields.includes(fieldName)) {
      return; // Do nothing for mandatory fields
    }
    
    const currentFields = packageRequiredFields[packageIndex] || [];
    const updatedFields = currentFields.includes(fieldName)
      ? currentFields.filter(f => f !== fieldName)
      : [...currentFields, fieldName];
    
    updatePackageRequiredFields(packageIndex, updatedFields);
    
    // If removing a field, also remove its validation config
    if (currentFields.includes(fieldName) && !updatedFields.includes(fieldName)) {
      const newValidationConfigs = { ...packageValidationConfigs };
      if (newValidationConfigs[packageIndex]) {
        delete newValidationConfigs[packageIndex][fieldName];
      }
      setPackageValidationConfigs(newValidationConfigs);
    }
  };

  const updateFieldValidationConfig = (packageIndex: number, fieldName: string, config: ValidationConfig) => {
    setPackageValidationConfigs(prev => ({
      ...prev,
      [packageIndex]: {
        ...prev[packageIndex],
        [fieldName]: config
      }
    }));
  };

  const toggleValidationConfigVisibility = (packageIndex: number, fieldName: string) => {
    setShowValidationConfig(prev => ({
      ...prev,
      [packageIndex]: {
        ...prev[packageIndex],
        [fieldName]: !prev[packageIndex]?.[fieldName]
      }
    }));
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setNewImageFiles(prev => [...prev, ...filesArray]);
    }
  };

  const removeNewImage = (index: number) => {
    setNewImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (imageUrl: string) => {
    setTripImages(prev => prev.filter(url => url !== imageUrl));
    setImagesToDelete(prev => [...prev, imageUrl]);
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
        max_participants: parseInt(formData.max_participants, 10),
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
        meeting_time: formData.has_meeting_place && formData.meeting_time 
          ? new Date(formData.meeting_time).toISOString() 
          : undefined,
    };
    
    const imageData = {
      newImages: newImageFiles,
      imagesToDelete: imagesToDelete
    };
    
    onSubmit(payload, packages, packageRequiredFields, packageValidationConfigs, imageData);
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
      <input type="number" name="max_participants" value={formData.max_participants} onChange={handleChange} placeholder="Max Participants" required />
      <label>
        <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} />
        Active
      </label>

      <h3>Trip Policies</h3>
      <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input 
            type="checkbox" 
            name="is_refundable" 
            checked={formData.is_refundable} 
            onChange={handleChange} 
          />
          <span>Refundable Trip</span>
        </label>
        <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.5rem 0 0 1.5rem' }}>
          If checked, customers can request refunds for this trip
        </p>
      </div>

      <h3>Trip Amenities & Inclusions</h3>
      <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
          Select what's included in this trip package:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {Object.entries(amenityLabels).map(([value, label]) => (
            <label 
              key={value}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                padding: '0.5rem',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                backgroundColor: selectedAmenities.includes(value) ? '#e3f2fd' : '#fff',
                cursor: 'pointer'
              }}
            >
              <input
                type="checkbox"
                checked={selectedAmenities.includes(value)}
                onChange={() => toggleAmenity(value)}
              />
              <span style={{ fontSize: '0.9rem' }}>{label}</span>
            </label>
          ))}
        </div>
        {selectedAmenities.length > 0 && (
          <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.75rem' }}>
            Selected: {selectedAmenities.length} amenity/amenities
          </p>
        )}
      </div>

      <h3>Meeting Place (Optional)</h3>
      <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <input 
            type="checkbox" 
            name="has_meeting_place" 
            checked={formData.has_meeting_place} 
            onChange={handleChange} 
          />
          <span>This trip has a designated meeting place</span>
        </label>
        
        {formData.has_meeting_place && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginLeft: '1.5rem' }}>
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>
                Meeting Location
              </label>
              <input
                type="text"
                name="meeting_location"
                value={formData.meeting_location}
                onChange={handleChange}
                placeholder="e.g., Airport Terminal 3, Hotel Lobby"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>
                Meeting Time
              </label>
              <input
                type="datetime-local"
                name="meeting_time"
                value={formData.meeting_time}
                onChange={handleChange}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}
      </div>

      <h3>Trip Images</h3>
      <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px' }}>
        <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
          Upload images to showcase your trip destination (max 5MB per image)
        </p>
        
        {/* Existing images */}
        {tripImages.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Current Images:</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
              {tripImages.map((imageUrl, index) => (
                <div key={index} style={{ position: 'relative', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                  <img src={imageUrl} alt={`Trip ${index + 1}`} style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(imageUrl)}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'rgba(255, 0, 0, 0.8)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New images to upload */}
        {newImageFiles.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>New Images to Upload:</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
              {newImageFiles.map((file, index) => (
                <div key={index} style={{ position: 'relative', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                  <img 
                    src={URL.createObjectURL(file)} 
                    alt={`New ${index + 1}`} 
                    style={{ width: '100%', height: '150px', objectFit: 'cover' }} 
                  />
                  <button
                    type="button"
                    onClick={() => removeNewImage(index)}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'rgba(255, 0, 0, 0.8)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    Remove
                  </button>
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '4px', 
                    left: '4px', 
                    background: 'rgba(0, 0, 0, 0.7)', 
                    color: 'white', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    fontSize: '0.75rem'
                  }}>
                    {file.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload button */}
        <div>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            onChange={handleImageFileChange}
            style={{ display: 'none' }}
            id="trip-image-upload"
          />
          <label
            htmlFor="trip-image-upload"
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              backgroundColor: '#4CAF50',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            + Add Images
          </label>
        </div>
      </div>

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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="number"
              value={pkg.price}
              onChange={(e) => updatePackage(index, 'price', parseFloat(e.target.value) || 0)}
              placeholder="Package Price"
              min="0.01"
              step="0.01"
              required
              style={{ flex: 1 }}
            />
            <select
              value={pkg.currency}
              onChange={(e) => updatePackage(index, 'currency', e.target.value)}
              style={{ minWidth: '80px' }}
            >
              <option value="SAR">SAR</option>
            </select>
          </div>
          
          <div style={{ marginTop: '1rem' }}>
            <h5>Required Fields for This Package</h5>
            <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.5rem 0' }}>
              <strong>Note:</strong> Name and Date of Birth are always required and cannot be removed.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              {availableFields.map((field) => {
                const mandatoryFields = ['name', 'date_of_birth'];
                const isMandatory = mandatoryFields.includes(field.field_name);
                const isChecked = (packageRequiredFields[index] || []).includes(field.field_name) || isMandatory;
                const hasValidations = field.available_validations && field.available_validations.length > 0;
                const showConfig = showValidationConfig[index]?.[field.field_name] || false;
                
                return (
                  <div key={field.field_name} style={{ 
                    border: '1px solid #e0e0e0', 
                    borderRadius: '6px', 
                    padding: '1rem',
                    backgroundColor: isChecked ? '#f8f9fa' : '#fff'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        fontSize: '0.9rem',
                        opacity: isMandatory ? 0.7 : 1,
                        flex: 1
                      }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isMandatory}
                          onChange={() => toggleRequiredField(index, field.field_name)}
                          style={{ transform: 'scale(1.1)' }}
                        />
                        <span style={{ fontWeight: '500' }}>{field.display_name}</span>
                        <small style={{ color: '#666' }}>({field.ui_type})</small>
                        {isMandatory && <small style={{ color: '#ff6b6b', fontWeight: 'bold' }}>(Required)</small>}
                      </label>
                      
                      {isChecked && hasValidations && (
                        <button
                          type="button"
                          onClick={() => toggleValidationConfigVisibility(index, field.field_name)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            backgroundColor: showConfig ? '#2196F3' : '#f0f0f0',
                            color: showConfig ? 'white' : '#333',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          {showConfig ? 'Hide' : 'Configure'} Validations
                        </button>
                      )}
                    </div>

                    {isChecked && hasValidations && showConfig && (
                      <ValidationConfigComponent
                        fieldMetadata={field}
                        currentConfig={packageValidationConfigs[index]?.[field.field_name] || {}}
                        onConfigChange={(config) => updateFieldValidationConfig(index, field.field_name, config)}
                      />
                    )}
                  </div>
                );
              })}
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
