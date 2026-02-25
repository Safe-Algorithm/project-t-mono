import React from 'react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ page, pageSize, total, onPageChange }) => {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 4) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 3) pages.push('…');
    pages.push(totalPages);
  }

  const btnBase = 'inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium transition-colors';
  const active = 'bg-sky-500 text-white shadow-sm';
  const inactive = 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800';
  const disabled = 'opacity-40 cursor-not-allowed';

  return (
    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`${btnBase} ${page === 1 ? disabled : inactive}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="w-9 text-center text-slate-400 text-sm">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`${btnBase} ${p === page ? active : inactive}`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={`${btnBase} ${page === totalPages ? disabled : inactive}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Pagination;
