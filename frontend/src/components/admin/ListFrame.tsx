import React from 'react';
import { Search } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface ListFrameProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  searchValue: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  filters?: React.ReactNode;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function ListFrame({
  title,
  description,
  actions,
  searchValue,
  onSearch,
  searchPlaceholder,
  filters,
  loading,
  error,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyDescription,
  footer,
  children,
}: ListFrameProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
        </div>
        {actions}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="block w-full rounded-sm border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
          />
        </div>
        {filters}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-sm border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800"
        >
          <span>{error}</span>
          <button type="button" onClick={onRetry} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {loading && isEmpty ? (
        <p role="status" className="py-10 text-center text-sm text-slate-600">
          Loading…
        </p>
      ) : isEmpty && !error ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className={`rounded-sm border border-slate-200 bg-white ${loading ? 'opacity-60' : ''}`}>
          <div className="overflow-x-auto">{children}</div>
          {footer}
        </div>
      )}
    </div>
  );
}

export const TABLE_HEAD = 'bg-slate-50 text-left text-xs font-semibold text-slate-600';
export const TH = 'px-4 py-3';
export const TD = 'px-4 py-3 text-slate-700';
export const FILTER_SELECT =
  'rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none';
