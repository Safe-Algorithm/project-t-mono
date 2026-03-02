import React, { useState, useEffect, useCallback } from 'react';
import {
  fileGroupsService,
  fileDefinitionsService,
  ProviderFileGroup,
  ProviderFileGroupCreate,
  ProviderFileGroupUpdate,
  FileDefinition,
  FileDefinitionCreate,
  FileDefinitionUpdate,
} from '../../services/fileDefinitions';
import FileDefinitionModal from '../../components/settings/FileDefinitionModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GroupModalState {
  open: boolean;
  editing: ProviderFileGroup | null;
}

interface DefModalState {
  open: boolean;
  editing: FileDefinition | null;
  groupId: string | null; // null = ungrouped section
}

const EMPTY_GROUP_FORM: ProviderFileGroupCreate = {
  key: '',
  name_en: '',
  name_ar: '',
  description_en: '',
  description_ar: '',
  is_active: true,
  display_order: 0,
};

// ─── Inline definition row ────────────────────────────────────────────────────

function DefRow({
  def,
  onEdit,
  onDelete,
  onToggle,
}: {
  def: FileDefinition;
  onEdit: (d: FileDefinition) => void;
  onDelete: (d: FileDefinition) => void;
  onToggle: (d: FileDefinition) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
      {/* status dot */}
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${def.is_active ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'}`}
      />

      {/* info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{def.name_en}</span>
          <span className="text-gray-400 text-xs">·</span>
          <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{def.name_ar}</span>
          {def.is_required && (
            <span className="text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-medium">
              Required
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <code className="text-xs text-gray-400 dark:text-gray-500">{def.key}</code>
          <span className="text-xs text-gray-400">
            {def.allowed_extensions.map((e) => `.${e}`).join(' ')}
          </span>
          <span className="text-xs text-gray-400">max {def.max_size_mb} MB</span>
        </div>
      </div>

      {/* actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onToggle(def)}
          title={def.is_active ? 'Deactivate' : 'Activate'}
          className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {def.is_active
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            }
          </svg>
        </button>
        <button
          onClick={() => onEdit(def)}
          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(def)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Group card (accordion) ───────────────────────────────────────────────────

function GroupCard({
  group,
  onEditGroup,
  onDeleteGroup,
  onToggleGroup,
  onAddDef,
  onEditDef,
  onDeleteDef,
  onToggleDef,
}: {
  group: ProviderFileGroup;
  onEditGroup: (g: ProviderFileGroup) => void;
  onDeleteGroup: (g: ProviderFileGroup) => void;
  onToggleGroup: (g: ProviderFileGroup) => void;
  onAddDef: (groupId: string) => void;
  onEditDef: (d: FileDefinition, groupId: string) => void;
  onDeleteDef: (d: FileDefinition) => void;
  onToggleDef: (d: FileDefinition) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Group header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* folder icon */}
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${group.is_active ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
          <svg className={`w-4 h-4 ${group.is_active ? 'text-blue-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>

        {/* info */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">{group.name_en}</span>
            <span className="text-gray-400 text-xs">·</span>
            <span className="text-gray-500 dark:text-gray-400 text-sm">{group.name_ar}</span>
            <code className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">{group.key}</code>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${group.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
              {group.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {group.file_definitions.length} definition{group.file_definitions.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* group actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onAddDef(group.id)}
            title="Add definition"
            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add File
          </button>
          <button
            onClick={() => onToggleGroup(group)}
            title={group.is_active ? 'Deactivate group' : 'Activate group'}
            className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {group.is_active
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              }
            </svg>
          </button>
          <button
            onClick={() => onEditGroup(group)}
            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDeleteGroup(group)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Definitions list (expanded) */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-2">
          {group.file_definitions.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-600 italic py-2 text-center">
              No file definitions yet — click "Add File" to create one.
            </p>
          ) : (
            group.file_definitions.map((d) => (
              <DefRow
                key={d.id}
                def={d}
                onEdit={(def) => onEditDef(def, group.id)}
                onDelete={onDeleteDef}
                onToggle={onToggleDef}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Group create/edit modal ──────────────────────────────────────────────────

function GroupFormModal({
  modal,
  form,
  setForm,
  saving,
  formError,
  onClose,
  onSave,
}: {
  modal: GroupModalState;
  form: ProviderFileGroupCreate;
  setForm: (f: ProviderFileGroupCreate) => void;
  saving: boolean;
  formError: string | null;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {modal.editing ? 'Edit File Group' : 'New File Group'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {formError}
            </div>
          )}

          {!modal.editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="e.g. saudi_company"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">Lowercase, alphanumeric and underscores only. Cannot be changed after creation.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name (English) <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.name_en}
                onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                placeholder="Saudi Company"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name (Arabic) <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.name_ar}
                onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                placeholder="شركة سعودية" dir="rtl"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (English)</label>
            <textarea rows={2} value={form.description_en}
              onChange={(e) => setForm({ ...form, description_en: e.target.value })}
              placeholder="Brief description of who this group is for"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Arabic)</label>
            <textarea rows={2} value={form.description_ar}
              onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
              placeholder="وصف مختصر لمن تُعنى هذه المجموعة" dir="rtl"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Order</label>
              <input type="number" min={0} value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input id="group-active" type="checkbox" checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded border-gray-300"
              />
              <label htmlFor="group-active" className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={onSave} disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {saving ? 'Saving...' : modal.editing ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FileGroupsPage() {
  const [groups, setGroups] = useState<ProviderFileGroup[]>([]);
  const [ungrouped, setUngrouped] = useState<FileDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group modal state
  const [groupModal, setGroupModal] = useState<GroupModalState>({ open: false, editing: null });
  const [groupForm, setGroupForm] = useState<ProviderFileGroupCreate>(EMPTY_GROUP_FORM);
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupFormError, setGroupFormError] = useState<string | null>(null);

  // Definition modal state
  const [defModal, setDefModal] = useState<DefModalState>({ open: false, editing: null, groupId: null });

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupsResp, ungroupedResp] = await Promise.all([
        fileGroupsService.getAll(false),
        fileDefinitionsService.getAll({ activeOnly: false, skip: 0, limit: 200 }),
      ]);
      setGroups(groupsResp.items);
      setUngrouped(ungroupedResp.items.filter((d: FileDefinition) => !d.file_group_id));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Group CRUD ────────────────────────────────────────────────────────────

  const openCreateGroup = () => {
    setGroupForm(EMPTY_GROUP_FORM);
    setGroupFormError(null);
    setGroupModal({ open: true, editing: null });
  };

  const openEditGroup = (g: ProviderFileGroup) => {
    setGroupForm({
      key: g.key,
      name_en: g.name_en,
      name_ar: g.name_ar,
      description_en: g.description_en ?? '',
      description_ar: g.description_ar ?? '',
      is_active: g.is_active,
      display_order: g.display_order,
    });
    setGroupFormError(null);
    setGroupModal({ open: true, editing: g });
  };

  const closeGroupModal = () => setGroupModal({ open: false, editing: null });

  const handleSaveGroup = async () => {
    setGroupSaving(true);
    setGroupFormError(null);
    try {
      if (groupModal.editing) {
        const update: ProviderFileGroupUpdate = {
          name_en: groupForm.name_en,
          name_ar: groupForm.name_ar,
          description_en: groupForm.description_en,
          description_ar: groupForm.description_ar,
          is_active: groupForm.is_active,
          display_order: groupForm.display_order,
        };
        await fileGroupsService.update(groupModal.editing.id, update);
      } else {
        await fileGroupsService.create(groupForm);
      }
      closeGroupModal();
      await load();
    } catch (e: any) {
      setGroupFormError(e?.detail ?? e?.message ?? 'Failed to save file group');
    } finally {
      setGroupSaving(false);
    }
  };

  const handleDeleteGroup = async (g: ProviderFileGroup) => {
    if (!confirm(`Delete group "${g.name_en}"? This cannot be undone.`)) return;
    try {
      await fileGroupsService.delete(g.id);
      await load();
    } catch (e: any) {
      alert(e?.detail ?? e?.message ?? 'Failed to delete group');
    }
  };

  const handleToggleGroup = async (g: ProviderFileGroup) => {
    try {
      await fileGroupsService.update(g.id, { is_active: !g.is_active });
      await load();
    } catch (e: any) {
      alert(e?.detail ?? e?.message ?? 'Failed to update group');
    }
  };

  // ── Definition CRUD ───────────────────────────────────────────────────────

  const openAddDef = (groupId: string | null) => {
    setDefModal({ open: true, editing: null, groupId });
  };

  const openEditDef = (d: FileDefinition, groupId: string | null) => {
    setDefModal({ open: true, editing: d, groupId });
  };

  const closeDefModal = () => setDefModal({ open: false, editing: null, groupId: null });

  const handleSaveDef = async (data: FileDefinitionCreate | FileDefinitionUpdate) => {
    if (defModal.editing) {
      await fileDefinitionsService.update(defModal.editing.id, data as FileDefinitionUpdate);
    } else {
      const createData = data as FileDefinitionCreate;
      // Inject the group id from context if not already set
      if (defModal.groupId && !createData.file_group_id) {
        createData.file_group_id = defModal.groupId;
      }
      await fileDefinitionsService.create(createData);
    }
    closeDefModal();
    await load();
  };

  const handleDeleteDef = async (d: FileDefinition) => {
    if (!confirm(`Delete definition "${d.name_en}"? This cannot be undone.`)) return;
    try {
      await fileDefinitionsService.delete(d.id);
      await load();
    } catch (e: any) {
      alert(e?.detail ?? e?.message ?? 'Failed to delete definition');
    }
  };

  const handleToggleDef = async (d: FileDefinition) => {
    try {
      await fileDefinitionsService.update(d.id, { is_active: !d.is_active });
      await load();
    } catch (e: any) {
      alert(e?.detail ?? e?.message ?? 'Failed to update definition');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">File Groups & Definitions</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage document categories and the file definitions inside each one.
              Providers select a group at registration and are required to upload only that group's files.
            </p>
          </div>
          <button
            onClick={openCreateGroup}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Group
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : (
          <div className="space-y-3">
            {/* Groups */}
            {groups.length === 0 ? (
              <div className="text-center py-10 text-gray-400 dark:text-gray-600 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <p className="font-medium text-sm">No file groups yet</p>
                <p className="text-xs mt-1">Create a group to start organising file requirements.</p>
              </div>
            ) : (
              groups.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  onEditGroup={openEditGroup}
                  onDeleteGroup={handleDeleteGroup}
                  onToggleGroup={handleToggleGroup}
                  onAddDef={openAddDef}
                  onEditDef={openEditDef}
                  onDeleteDef={handleDeleteDef}
                  onToggleDef={handleToggleDef}
                />
              ))
            )}

            {/* Ungrouped definitions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ungrouped Definitions</span>
                  <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                    {ungrouped.length}
                  </span>
                </div>
                <button
                  onClick={() => openAddDef(null)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add File
                </button>
              </div>
              <div className="px-4 py-3 space-y-2">
                {ungrouped.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-600 italic py-2 text-center">
                    No ungrouped definitions. All files are assigned to a group.
                  </p>
                ) : (
                  ungrouped.map((d) => (
                    <DefRow
                      key={d.id}
                      def={d}
                      onEdit={(def) => openEditDef(def, null)}
                      onDelete={handleDeleteDef}
                      onToggle={handleToggleDef}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Group create/edit modal */}
      {groupModal.open && (
        <GroupFormModal
          modal={groupModal}
          form={groupForm}
          setForm={setGroupForm}
          saving={groupSaving}
          formError={groupFormError}
          onClose={closeGroupModal}
          onSave={handleSaveGroup}
        />
      )}

      {/* Definition create/edit modal */}
      {defModal.open && (
        <FileDefinitionModal
          definition={defModal.editing}
          defaultGroupId={defModal.groupId}
          onClose={closeDefModal}
          onSave={handleSaveDef}
        />
      )}
    </>
  );
}
