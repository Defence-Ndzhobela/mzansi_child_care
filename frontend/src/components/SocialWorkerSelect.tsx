import { SocialWorkerSummary } from '../types';

interface SocialWorkerSelectProps {
  id: string;
  value: string;
  onChange: (socialWorkerId: string) => void;
  workers: SocialWorkerSummary[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  label?: string;
}

// Required dropdown of the active social workers returned by the backend (never a hardcoded list).
export function SocialWorkerSelect({
  id,
  value,
  onChange,
  workers,
  loading,
  error,
  onRetry,
  label = 'Social worker',
}: SocialWorkerSelectProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">{label}</label>
      <select
        id={id}
        required
        value={value}
        disabled={loading || workers.length === 0}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
      >
        <option value="">{loading ? 'Loading social workers…' : 'Select a social worker'}</option>
        {workers.map((worker) => (
          <option key={worker.id} value={worker.id}>{worker.fullName}</option>
        ))}
      </select>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}{' '}
          <button type="button" onClick={onRetry} className="font-semibold underline">Retry</button>
        </p>
      ) : !loading && workers.length === 0 ? (
        <p role="alert" className="mt-1 text-xs text-red-700">
          No social workers are available right now, so this cannot be saved yet.
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-600">
          The social worker you choose can see this child's case, arrangements and payments.
        </p>
      )}
    </div>
  );
}
