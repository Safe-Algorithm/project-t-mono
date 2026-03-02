import React, { useEffect, useState, useCallback } from 'react';
import { imageCollectionService, ProviderImage } from '../services/imageCollectionService';

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ImageCollectionPage() {
  const [images, setImages] = useState<ProviderImage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProviderImage | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await imageCollectionService.getAll(0, 200);
      setImages(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load images');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (img: ProviderImage) => {
    if (!confirm(`Delete "${img.original_filename || 'this image'}" from your collection? This cannot be undone.`)) return;
    setDeleting(img.id);
    try {
      await imageCollectionService.delete(img.id);
      setImages((prev) => prev.filter((i) => i.id !== img.id));
      setTotal((t) => t - 1);
      if (preview?.id === img.id) setPreview(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete image');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Image Collection</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Every image you upload to a trip is saved here so you can reuse it without re-uploading.
            {total > 0 && <span className="ml-2 font-medium text-slate-700 dark:text-slate-300">{total} image{total !== 1 ? 's' : ''}</span>}
          </p>
        </div>
        <button
          onClick={load}
          className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && images.length === 0 && (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <svg className="w-14 h-14 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-base font-medium">No images yet</p>
          <p className="text-sm mt-1">Upload images to a trip and they'll appear here automatically.</p>
        </div>
      )}

      {/* Grid */}
      {!loading && images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden aspect-square border border-slate-200 dark:border-slate-700 hover:border-sky-400 transition-colors"
            >
              {/* Thumbnail */}
              <img
                src={img.url}
                alt={img.original_filename || 'Image'}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setPreview(img)}
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none" />

              {/* Delete button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(img); }}
                disabled={deleting === img.id}
                className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 z-10"
                title="Delete from collection"
              >
                {deleting === img.id ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>

              {/* Size badge */}
              {img.size_bytes && (
                <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-md leading-none opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatBytes(img.size_bytes)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox preview */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={preview.url} alt={preview.original_filename || ''} className="w-full max-h-[60vh] object-contain bg-slate-100 dark:bg-slate-800" />
            <div className="px-5 py-4 space-y-2">
              <p className="font-medium text-slate-900 dark:text-white truncate">{preview.original_filename || 'Untitled'}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                {preview.width && preview.height && <span>{preview.width} × {preview.height} px</span>}
                {preview.size_bytes && <span>{formatBytes(preview.size_bytes)}</span>}
                <span>Added {formatDate(preview.created_at)}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  className="flex-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-sm font-medium py-2 px-4 rounded-xl"
                  onClick={() => handleDelete(preview)}
                  disabled={deleting === preview.id}
                >
                  Delete from collection
                </button>
                <button
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium py-2 px-4 rounded-xl"
                  onClick={() => setPreview(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
