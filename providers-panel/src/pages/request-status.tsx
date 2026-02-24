import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/UserContext';
import { api } from '@/services/api';
import { providerFilesService, ProviderFile } from '@/services/fileDefinitions';

interface ProviderRequest {
  id: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  status: string;
  denial_reason?: string;
  created_at: string;
  updated_at: string;
}

const RequestStatusPage = () => {
  const { user } = useAuth();
  const [request, setRequest] = useState<ProviderRequest | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<ProviderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequestStatus = async () => {
      try {
        const response = await api.get<ProviderRequest>('/providers/request-status');
        setRequest(response);
        
        // Fetch uploaded files
        try {
          const files = await providerFilesService.getUploadedFiles();
          setUploadedFiles(files);
        } catch (fileErr) {
          console.error('Failed to fetch uploaded files:', fileErr);
          // Don't fail the whole page if files can't be fetched
        }
      } catch (err: any) {
        // If request is already approved, redirect to dashboard
        if (err.response?.data?.detail === 'Request already approved') {
          window.location.href = '/dashboard';
          return;
        }
        setError(err.response?.data?.detail || 'Failed to fetch request status');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchRequestStatus();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/2" />
        <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          No provider request found for your account.
        </div>
      </div>
    );
  }

  const statusConfig: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    approved: {
      cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
      label: 'Approved',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    denied: {
      cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
      label: 'Denied',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    pending: {
      cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
      label: 'Under Review',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
  };
  const status = statusConfig[request.status.toLowerCase()] || statusConfig.pending;

  const fileStatusMap: Record<string, { cls: string; label: string }> = {
    accepted: { cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', label: '✓ Accepted' },
    rejected: { cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', label: '✗ Rejected' },
    processing: { cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', label: '⏳ Under Review' },
  };

  const formatDt = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Application Status</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Track the status of your provider application</p>
      </div>

      {/* Status banner */}
      <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${
        request.status.toLowerCase() === 'approved'
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
          : request.status.toLowerCase() === 'denied'
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
      }`}>
        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${status.cls}`}>
          {status.icon} {status.label}
        </span>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {request.status.toLowerCase() === 'pending' && "We're reviewing your application. You'll be notified once a decision is made."}
          {request.status.toLowerCase() === 'approved' && 'Your application has been approved. You can now access all provider features.'}
          {request.status.toLowerCase() === 'denied' && (request.denial_reason ? `Reason: ${request.denial_reason}` : 'Your application was not approved.')}
        </p>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">Company Information</h3>
          <dl className="space-y-3">
            {[
              { label: 'Company Name', value: request.company_name },
              { label: 'Company Email', value: request.company_email },
              { label: 'Company Phone', value: request.company_phone },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs text-slate-400 dark:text-slate-500">{label}</dt>
                <dd className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">Request Details</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-slate-400 dark:text-slate-500">Request ID</dt>
              <dd className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-0.5 break-all">{request.id}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400 dark:text-slate-500">Submitted</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">{request.created_at ? formatDt(request.created_at) : 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400 dark:text-slate-500">Last Updated</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">{request.updated_at ? formatDt(request.updated_at) : 'N/A'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Uploaded Documents */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Uploaded Documents</h3>
        </div>
        <div className="p-5">
          {uploadedFiles.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No documents uploaded yet</p>
          ) : (
            <div className="space-y-3">
              {uploadedFiles.map(file => {
                const badge = fileStatusMap[file.file_verification_status];
                return (
                  <div key={file.id} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div className="min-w-0">
                        {file.file_definition && <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">{file.file_definition.name_en}</p>}
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-sky-500 hover:text-sky-600 hover:underline truncate block">{file.file_name}</a>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{(file.file_size_bytes / 1024 / 1024).toFixed(2)} MB · {file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    </div>
                    {badge && <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.label}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestStatusPage;
