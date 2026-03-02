import { useState, useEffect } from 'react';
import { FileDefinition, FileDefinitionCreate, FileDefinitionUpdate, ProviderFileGroup, fileGroupsService } from '@/services/fileDefinitions';

interface FileDefinitionModalProps {
  definition: FileDefinition | null;
  onClose: () => void;
  onSave: (data: FileDefinitionCreate | FileDefinitionUpdate) => Promise<void>;
  defaultGroupId?: string | null;
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

export default function FileDefinitionModal({ definition, onClose, onSave, defaultGroupId }: FileDefinitionModalProps) {
  const [activeTab, setActiveTab] = useState<'en' | 'ar'>('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [groups, setGroups] = useState<ProviderFileGroup[]>([]);

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
    file_group_id: defaultGroupId ?? null,
  });

  useEffect(() => {
    fileGroupsService.getAll(true).then((r) => setGroups(r.items)).catch(() => {});
  }, []);

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
        file_group_id: definition.file_group_id ?? null,
      });
    } else {
      setFormData((prev) => ({ ...prev, file_group_id: defaultGroupId ?? null }));
    }
  }, [definition, defaultGroupId]);

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

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition";
  const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {definition ? 'Edit File Definition' : 'Create File Definition'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Key (only for create) */}
          {!definition && (
            <div>
              <label className={labelCls}>Key <span className="text-red-500 normal-case">*</span></label>
              <input type="text" value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                className={inputCls} placeholder="e.g., zakat_certificate" required />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Unique identifier (lowercase, alphanumeric, underscores only)</p>
            </div>
          )}

          {/* Language Tabs */}
          <div>
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
              <button type="button" onClick={() => setActiveTab('en')}
                className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'en' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                English
              </button>
              <button type="button" onClick={() => setActiveTab('ar')}
                className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'ar' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                العربية
              </button>
            </div>

            {activeTab === 'en' && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Name (English) <span className="text-red-500 normal-case">*</span></label>
                  <input type="text" value={formData.name_en}
                    onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                    className={inputCls} placeholder="e.g., Zakat Registration Certificate" required />
                </div>
                <div>
                  <label className={labelCls}>Description (English) <span className="text-red-500 normal-case">*</span></label>
                  <textarea value={formData.description_en}
                    onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                    className={`${inputCls} resize-none`} rows={3} placeholder="Hint text shown to users..." required />
                </div>
              </div>
            )}

            {activeTab === 'ar' && (
              <div className="space-y-4" dir="rtl">
                <div>
                  <label className={labelCls}>الاسم (عربي) <span className="text-red-500 normal-case">*</span></label>
                  <input type="text" value={formData.name_ar}
                    onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                    className={inputCls} placeholder="مثال: شهادة تسجيل الزكاة" required />
                </div>
                <div>
                  <label className={labelCls}>الوصف (عربي) <span className="text-red-500 normal-case">*</span></label>
                  <textarea value={formData.description_ar}
                    onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                    className={`${inputCls} resize-none`} rows={3} placeholder="نص التلميح المعروض للمستخدمين..." required />
                </div>
              </div>
            )}
          </div>

          {/* Allowed Extensions */}
          <div>
            <label className={labelCls}>Allowed File Extensions <span className="text-red-500 normal-case">*</span></label>
            <div className="grid grid-cols-4 gap-2">
              {COMMON_EXTENSIONS.map((ext) => (
                <label key={ext.value}
                  className={`flex items-center justify-center px-3 py-2 border rounded-xl cursor-pointer transition-colors text-sm font-semibold ${
                    formData.allowed_extensions.includes(ext.value)
                      ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-400 dark:border-sky-600 text-sky-700 dark:text-sky-400'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-sky-300 dark:hover:border-sky-700'
                  }`}>
                  <input type="checkbox" checked={formData.allowed_extensions.includes(ext.value)}
                    onChange={() => toggleExtension(ext.value)} className="sr-only" />
                  .{ext.label}
                </label>
              ))}
            </div>
          </div>

          {/* Max Size */}
          <div>
            <label className={labelCls}>Maximum File Size: <span className="text-slate-900 dark:text-white normal-case font-bold">{formData.max_size_mb} MB</span></label>
            <input type="range" min="1" max="500" value={formData.max_size_mb}
              onChange={(e) => setFormData({ ...formData, max_size_mb: parseInt(e.target.value) })}
              className="w-full accent-sky-500" />
            <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-1">
              <span>1 MB</span><span>500 MB</span>
            </div>
          </div>

          {/* File Group */}
          <div>
            <label className={labelCls}>File Group</label>
            {defaultGroupId && !definition ? (
              <p className="text-sm text-slate-600 dark:text-slate-400 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                {groups.find((g) => g.id === defaultGroupId)?.name_en ?? 'Selected group'}
                <span className="text-xs text-slate-400 ml-2">(set by context)</span>
              </p>
            ) : (
              <select
                value={formData.file_group_id ?? ''}
                onChange={(e) => setFormData({ ...formData, file_group_id: e.target.value || null })}
                className={inputCls}
              >
                <option value="">— No group (ungrouped / global) —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name_en} ({g.name_ar})</option>
                ))}
              </select>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Providers who select this group will be required to upload this document.
            </p>
          </div>

          {/* Display Order */}
          <div>
            <label className={labelCls}>Display Order</label>
            <input type="number" min="0" value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
              className={inputCls} />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Lower numbers appear first in the form</p>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={formData.is_required}
                onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                className="w-4 h-4 accent-sky-500 rounded" />
              <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Required field</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 accent-sky-500 rounded" />
              <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Active</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Saving…' : definition ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
