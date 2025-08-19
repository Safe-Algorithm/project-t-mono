import { useEffect, useState } from 'react';

interface Provider {
  id: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  is_active: boolean;
}

const ProvidersPage = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch('http://localhost:8000/admin/providers');
        if (!response.ok) {
          throw new Error('Failed to fetch providers');
        }
        const data = await response.json();
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
  }, []);

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
              <tr key={provider.id}>
                <td className="py-2 px-4 border-b">{provider.company_name}</td>
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
