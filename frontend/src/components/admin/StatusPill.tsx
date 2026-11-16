const TONES: Record<string, string> = {
  ACTIVE: 'border-emerald-700/25 bg-emerald-50 text-emerald-800',
  Active: 'border-emerald-700/25 bg-emerald-50 text-emerald-800',
  INACTIVE: 'border-slate-300 bg-slate-50 text-slate-700',
  SUSPENDED: 'border-red-700/30 bg-red-50 text-red-800',
  Paused: 'border-amber-700/30 bg-amber-50 text-amber-900',
  Completed: 'border-sky-700/25 bg-sky-50 text-sky-900',
  Cancelled: 'border-slate-300 bg-slate-50 text-slate-700',
  CLOSED: 'border-slate-300 bg-slate-50 text-slate-700',
  TRANSFERRED: 'border-amber-700/30 bg-amber-50 text-amber-900',
};

const LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  CLOSED: 'Ended',
  TRANSFERRED: 'Transferred',
};

export function StatusPill({ status }: { status: string }) {
  const tone = TONES[status] ?? 'border-slate-300 bg-slate-50 text-slate-700';
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tone}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
