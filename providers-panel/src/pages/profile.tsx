import { useState, useEffect } from 'react';
import { useAuth } from '@/context/UserContext';
import { providerService } from '@/services/providerService';

const ProfilePage = () => {
  const { user, isLoading } = useAuth();
  const [provider, setProvider] = useState<any>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchProviderProfile = async () => {
      if (user) {
        try {
          const providerData = await providerService.getProviderProfile();
          setProvider(providerData);
          setCompanyName(providerData.company_name || '');
          setCompanyEmail(providerData.company_email || '');
          setCompanyPhone(providerData.company_phone || '');
        } catch (error) {
          console.error('Failed to fetch provider profile:', error);
          setError('Failed to load profile data');
        }
      }
    };

    fetchProviderProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await providerService.updateProviderProfile({
        company_name: companyName,
        company_email: companyEmail,
        company_phone: companyPhone,
      });
      setSuccess('Profile updated successfully!');
    } catch (error) {
      console.error('Profile update failed:', error);
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !user) return <div className="flex justify-center items-center h-64"><p>Loading...</p></div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Provider Profile</h1>
      
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Company Information</h2>
          <p className="text-sm text-gray-600">Update your company details and contact information.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
          <div>
            <label htmlFor="userEmail" className="block text-sm font-medium text-gray-700 mb-2">
              User Email
            </label>
            <input
              id="userEmail"
              type="email"
              value={user.email}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Your user email cannot be changed</p>
          </div>

          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
              Company Name *
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your company name"
            />
          </div>

          <div>
            <label htmlFor="companyEmail" className="block text-sm font-medium text-gray-700 mb-2">
              Company Email *
            </label>
            <input
              id="companyEmail"
              type="email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your company email"
            />
          </div>

          <div>
            <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700 mb-2">
              Company Phone *
            </label>
            <input
              id="companyPhone"
              type="tel"
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your company phone number"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
