import { useState, FormEvent } from 'react';
import { providerService } from '../services/providerService';
import { FullRegistrationPayload } from '../types/user';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    companyName: '',
    companyEmail: '',
    companyPhone: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

    const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload: FullRegistrationPayload = {
      user: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      },
      provider: {
        company_name: formData.companyName,
        company_email: formData.companyEmail,
        company_phone: formData.companyPhone,
      },
    };

    try {
      const result = await providerService.registerProvider(payload);
      setSuccess('Registration successful! Your application is under review.');
      console.log('Registration successful:', result);
    } catch (err) {
       if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during registration.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Provider Registration</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxWidth: '400px', gap: '1rem' }}>
        <h2>User Details</h2>
        <input type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} required />
        <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
        <input type="text" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required />
        <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
        
        <h2>Company Details</h2>
        <input type="text" name="companyName" placeholder="Company Name" value={formData.companyName} onChange={handleChange} required />
        <input type="email" name="companyEmail" placeholder="Company Email" value={formData.companyEmail} onChange={handleChange} required />
        <input type="text" name="companyPhone" placeholder="Company Phone" value={formData.companyPhone} onChange={handleChange} required />
        
                <button type="submit" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
        {success && <p style={{ color: 'green' }}>{success}</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </div>
  );
};

export default RegisterPage;
