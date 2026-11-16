import React from 'react';
import { Modal } from '../Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

// Every destructive or state-changing admin action goes through this confirmation first.
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  busy = false,
  error,
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={busy ? () => undefined : onCancel} title={title} maxWidth="md">
      <div className="space-y-4">
        {error && (
          <div role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
        <div className="text-sm text-slate-700">{message}</div>
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
              tone === 'danger' ? 'bg-red-700 hover:bg-red-800' : 'bg-[#006847] hover:bg-[#005238]'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
