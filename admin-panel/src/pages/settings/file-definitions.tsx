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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">File Definitions</h1>
            <p className="text-gray-600 mt-1">
              Manage required documents for provider registration
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon />
            Add File Definition
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name (EN)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name (AR)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Extensions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Max Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {fileDefinitions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <div className="mx-auto text-gray-400 mb-3">
                    <FileIcon />
                  </div>
                  <p className="text-lg font-medium">No file definitions yet</p>
                  <p className="text-sm mt-1">Create your first file definition to get started</p>
                </td>
              </tr>
            ) : (
              fileDefinitions.map((definition) => (
                <tr key={definition.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {definition.display_order}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {definition.name_en}
                    </div>
                    <div className="text-xs text-gray-500">{definition.key}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {definition.name_ar}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {definition.allowed_extensions.map((ext) => (
                        <span
                          key={ext}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          .{ext}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {definition.max_size_mb} MB
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          definition.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {definition.is_active ? (
                          <CheckCircleIcon />
                        ) : (
                          <XCircleIcon />
                        )}
                        {definition.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {definition.is_required && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Required
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(definition)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Edit"
                      >
                        <EditIcon />
                      </button>
                      <button
                        onClick={() => handleDelete(definition.id)}
                        className={`p-1 rounded ${
                          deleteConfirm === definition.id
                            ? 'text-red-600 bg-red-50'
                            : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title={deleteConfirm === definition.id ? 'Click again to confirm' : 'Delete'}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
