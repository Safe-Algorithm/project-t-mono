import { useState, useEffect } from 'react';
import { fileDefinitionsService, FileDefinition, FileDefinitionCreate, FileDefinitionUpdate } from '@/services/fileDefinitions';
import FileDefinitionModal from '@/components/settings/FileDefinitionModal';

// Simple SVG Icons
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const FileIcon = () => (
  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircleIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function FileDefinitionsPage() {
  const [fileDefinitions, setFileDefinitions] = useState<FileDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState<FileDefinition | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadFileDefinitions();
  }, []);

  const loadFileDefinitions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fileDefinitionsService.getAll(false);
      setFileDefinitions(response.items);
    } catch (err: any) {
      setError(err.message || 'Failed to load file definitions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingDefinition(null);
    setIsModalOpen(true);
  };

  const handleEdit = (definition: FileDefinition) => {
    setEditingDefinition(definition);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    try {
      await fileDefinitionsService.delete(id);
      await loadFileDefinitions();
      setDeleteConfirm(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete file definition');
    }
  };

  const handleSave = async (data: FileDefinitionCreate | FileDefinitionUpdate) => {
    try {
      if (editingDefinition) {
        await fileDefinitionsService.update(editingDefinition.id, data as FileDefinitionUpdate);
      } else {
        await fileDefinitionsService.create(data as FileDefinitionCreate);
      }
      await loadFileDefinitions();
      setIsModalOpen(false);
      setEditingDefinition(null);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to save file definition');
    }
  };

  const thCls = "text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">File Definitions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage required documents for provider registration</p>
        </div>
        <button onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0">
          <PlusIcon />
          Add File Definition
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {fileDefinitions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">No file definitions yet</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs">Create your first file definition to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className={thCls}>#</th>
                  <th className={thCls}>Name (EN)</th>
                  <th className={`${thCls} hidden sm:table-cell`}>Name (AR)</th>
                  <th className={`${thCls} hidden md:table-cell`}>Extensions</th>
                  <th className={`${thCls} hidden md:table-cell`}>Max Size</th>
                  <th className={thCls}>Status</th>
                  <th className="py-3 px-4 text-end text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {fileDefinitions.map((definition) => (
                  <tr key={definition.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-400 dark:text-slate-500 font-mono text-xs">{definition.display_order}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{definition.name_en}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">{definition.key}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 hidden sm:table-cell" dir="rtl">{definition.name_ar}</td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {definition.allowed_extensions.map(ext => (
                          <span key={ext} className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400">.{ext}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 hidden md:table-cell">{definition.max_size_mb} MB</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${definition.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                          {definition.is_active ? <CheckCircleIcon /> : <XCircleIcon />}
                          {definition.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {definition.is_required && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">Required</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleEdit(definition)} title="Edit"
                          className="w-8 h-8 flex items-center justify-center rounded-xl text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors">
                          <EditIcon />
                        </button>
                        <button onClick={() => handleDelete(definition.id)}
                          title={deleteConfirm === definition.id ? 'Click again to confirm' : 'Delete'}
                          className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${deleteConfirm === definition.id ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20' : 'text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'}`}>
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <FileDefinitionModal
          definition={editingDefinition}
          onClose={() => {
            setIsModalOpen(false);
            setEditingDefinition(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
