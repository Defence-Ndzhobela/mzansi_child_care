import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="border border-slate-200 bg-slate-50/60 p-8 text-center rounded-sm">
      {icon && <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-slate-500">{icon}</div>}
      <h3 className="text-base font-semibold text-[#0F2942]">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center justify-center rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] transition-colors whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
