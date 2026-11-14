import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface ToastBannerProps {
  type: 'success' | 'error';
  message: string;
  onDismiss: () => void;
}

export function ToastBanner({ type, message, onDismiss }: ToastBannerProps) {
  if (!message) return null;

  const isSuccess = type === 'success';
  return (
    <div
      role="status"
      className={`mb-5 flex items-start justify-between gap-3 rounded-sm border px-4 py-3 text-sm ${
        isSuccess
          ? 'border-emerald-700/30 bg-emerald-50 text-emerald-900'
          : 'border-red-700/30 bg-red-50 text-red-900'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {isSuccess ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
        )}
        <span>{message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-slate-500 hover:text-slate-800"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
