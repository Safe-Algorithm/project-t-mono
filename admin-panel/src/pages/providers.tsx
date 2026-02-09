import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';

interface Provider {
  id: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  is_active?: boolean;
  status?: string;
}

const ProvidersPage = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!token) return;

    const fetchProviders = async () => {
      try {
        const data = await api.get<Provider[]>('/admin/providers');
        setProviders(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, [token]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Providers</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Company Name</th>
              <th className="py-2 px-4 border-b">Email</th>
              <th className="py-2 px-4 border-b">Phone</th>
              <th className="py-2 px-4 border-b">Status</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => (
              <tr 
                key={provider.id} 
                className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => router.push(`/providers/${provider.id}`)}
              >
                <td className="py-2 px-4 border-b text-blue-600 hover:text-blue-800">{provider.company_name}</td>
                <td className="py-2 px-4 border-b">{provider.company_email}</td>
                <td className="py-2 px-4 border-b">{provider.company_phone}</td>
                <td className="py-2 px-4 border-b">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    provider.status === 'approved' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                      : provider.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      : provider.status === 'denied'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {provider.status || 'unknown'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProvidersPage;
