import { useState, useEffect } from 'react';
import { FileDefinition, FileDefinitionCreate, FileDefinitionUpdate } from '@/services/fileDefinitions';

interface FileDefinitionModalProps {
  definition: FileDefinition | null;
  onClose: () => void;
  onSave: (data: FileDefinitionCreate | FileDefinitionUpdate) => Promise<void>;
}

const COMMON_EXTENSIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'jpg', label: 'JPG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'doc', label: 'DOC' },
  { value: 'docx', label: 'DOCX' },
  { value: 'xls', label: 'XLS' },
  { value: 'xlsx', label: 'XLSX' },
];

export default function FileDefinitionModal({ definition, onClose, onSave }: FileDefinitionModalProps) {
  const [activeTab, setActiveTab] = useState<'en' | 'ar'>('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    key: '',
    name_en: '',
    name_ar: '',
    description_en: '',
    description_ar: '',
    allowed_extensions: [] as string[],
    max_size_mb: 10,
    is_required: true,
    is_active: true,
    display_order: 0,
  });

  useEffect(() => {
    if (definition) {
      setFormData({
        key: definition.key,
        name_en: definition.name_en,
        name_ar: definition.name_ar,
        description_en: definition.description_en,
        description_ar: definition.description_ar,
        allowed_extensions: definition.allowed_extensions,
        max_size_mb: definition.max_size_mb,
        is_required: definition.is_required,
        is_active: definition.is_active,
        display_order: definition.display_order,
      });
    }
  }, [definition]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate
      if (!formData.key && !definition) {
        throw new Error('Key is required');
      }
      if (!formData.name_en || !formData.name_ar) {
        throw new Error('Names in both languages are required');
      }
      if (!formData.description_en || !formData.description_ar) {
        throw new Error('Descriptions in both languages are required');
      }
      if (formData.allowed_extensions.length === 0) {
        throw new Error('At least one file extension must be selected');
      }

      if (definition) {
        // Update - don't send key
        const { key, ...updateData } = formData;
        await onSave(updateData);
      } else {
        // Create - send all data
        await onSave(formData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save file definition');
      setLoading(false);
    }
  };

  const toggleExtension = (ext: string) => {
    setFormData(prev => ({
      ...prev,
      allowed_extensions: prev.allowed_extensions.includes(ext)
        ? prev.allowed_extensions.filter(e => e !== ext)
        : [...prev.allowed_extensions, ext]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {definition ? 'Edit File Definition' : 'Create File Definition'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Key (only for create) */}
          {!definition && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., zakat_certificate"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Unique identifier (lowercase, alphanumeric, underscores only)
              </p>
            </div>
          )}

          {/* Language Tabs */}
          <div className="mb-4">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setActiveTab('en')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'en'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ar')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'ar'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                العربية (Arabic)
              </button>
            </div>
          </div>

          {/* English Fields */}
          {activeTab === 'en' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name (English) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Zakat Registration Certificate"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (English) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description_en}
                  onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Hint text shown to users..."
                  required
                />
              </div>
            </div>
          )}

          {/* Arabic Fields */}
          {activeTab === 'ar' && (
            <div className="space-y-4" dir="rtl">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  الاسم (عربي) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name_ar}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="مثال: شهادة تسجيل الزكاة"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  الوصف (عربي) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description_ar}
                  onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="نص التلميح المعروض للمستخدمين..."
                  required
                />
              </div>
            </div>
          )}

          {/* Allowed Extensions */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Allowed File Extensions <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {COMMON_EXTENSIONS.map((ext) => (
                <label
                  key={ext.value}
                  className={`flex items-center justify-center px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                    formData.allowed_extensions.includes(ext.value)
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.allowed_extensions.includes(ext.value)}
                    onChange={() => toggleExtension(ext.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">.{ext.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Max Size */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Maximum File Size: {formData.max_size_mb} MB
            </label>
            <input
              type="range"
              min="1"
              max="500"
              value={formData.max_size_mb}
              onChange={(e) => setFormData({ ...formData, max_size_mb: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 MB</span>
              <span>500 MB</span>
            </div>
          </div>

          {/* Display Order */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Order
            </label>
            <input
              type="number"
              min="0"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Lower numbers appear first in the form
            </p>
          </div>

          {/* Toggles */}
          <div className="mt-4 space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_required}
                onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Required field</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Active</span>
            </label>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : definition ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
