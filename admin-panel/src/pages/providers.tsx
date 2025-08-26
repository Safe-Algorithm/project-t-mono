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
        <table className="min-w-full bg-white">
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
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/providers/${provider.id}`)}
              >
                <td className="py-2 px-4 border-b text-blue-600 hover:text-blue-800">{provider.company_name}</td>
                <td className="py-2 px-4 border-b">{provider.company_email}</td>
                <td className="py-2 px-4 border-b">{provider.company_phone}</td>
                <td className="py-2 px-4 border-b">{provider.is_active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProvidersPage;
