import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Payment } from '../types';
import { formatSADate, formatZAR } from '../utils/format';
import { Modal } from './Modal';

interface ConfirmDisputeModalProps {
  payment: Payment | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ConfirmDisputeModal({ payment, onClose, onSuccess }: ConfirmDisputeModalProps) {
  const { currentUser } = useAuth();
  const { db, confirmOrDisputePayment } = useData();

  const [decision, setDecision] = useState<'CONFIRM_FULL' | 'CONFIRM_PARTIAL' | 'DISPUTE'>(
    'CONFIRM_FULL'
  );
  const [partialAmount, setPartialAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!payment) return;
    setDecision('CONFIRM_FULL');
    setPartialAmount(String(Math.max(0, Math.round(payment.amount * 0.5))));
    setNote('');
    setError('');
    setSubmitting(false);
  }, [payment]);

  if (!payment) return null;

  const child = db.children.find((c) => c.id === payment.childId);
  const payer = db.users.find((u) => u.id === payment.payingUserId);

  const submit = async (
    request: Parameters<typeof confirmOrDisputePayment>[0],
    successMessage: string
  ) => {
    setSubmitting(true);
    try {
      await confirmOrDisputePayment(request);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The decision could not be saved.');
      setSubmitting(false);
      return;
    }
    onSuccess(successMessage);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!currentUser) return;
    if (currentUser.id !== payment.receivingUserId) {
      setError('Only the receiving parent can confirm or dispute this payment.');
      return;
    }

    if (decision === 'CONFIRM_PARTIAL') {
      const val = Number(partialAmount);
      if (!Number.isFinite(val) || val <= 0 || val >= payment.amount) {
        setError(
          `Please enter a partial confirmed amount greater than R 0.00 and less than ${formatZAR(payment.amount)}.`
        );
        return;
      }
      void submit(
        { paymentId: payment.id, action: 'CONFIRM_PARTIAL', confirmedAmount: val, note },
        `Payment partially confirmed at ${formatZAR(val)}. Outstanding balances have been updated.`
      );
      return;
    }

    if (decision === 'DISPUTE') {
      if (!note.trim()) {
        setError('Please provide a clear reason for disputing this payment.');
        return;
      }
      void submit(
        { paymentId: payment.id, action: 'DISPUTE', note },
        'Payment marked as Disputed. The paying parent and any assigned social worker can see it.'
      );
      return;
    }

    void submit(
      { paymentId: payment.id, action: 'CONFIRM_FULL', note },
      `Full payment of ${formatZAR(payment.amount)} confirmed as received.`
    );
  };

  return (
    <Modal
      isOpen={Boolean(payment)}
      onClose={onClose}
      title="Confirm or Dispute Payment"
      subtitle="Verify whether the recorded contribution was received in full, partially, or not received."
      maxWidth="lg"
    >
      <div className="mb-4 border border-slate-200 bg-slate-50 p-4 rounded-sm text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-500">Child</p>
            <p className="font-medium text-[#0F2942]">
              {child ? `${child.firstName} ${child.lastName}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Recorded Amount</p>
            <p className="font-mono font-semibold tabular-nums text-[#0F2942]">
              {formatZAR(payment.amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Submitted By</p>
            <p className="text-slate-800">{payer?.fullName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Payment Date &amp; Method</p>
            <p className="text-slate-800">
              {formatSADate(payment.paymentDate)} · {payment.paymentMethod}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <fieldset className="space-y-2.5">
          <legend className="text-sm font-medium text-slate-800">Recipient Decision</legend>

          <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-slate-200 p-3 hover:bg-slate-50">
            <input
              type="radio"
              name="decision"
              checked={decision === 'CONFIRM_FULL'}
              onChange={() => setDecision('CONFIRM_FULL')}
              className="mt-1 accent-[#006847]"
            />
            <div>
              <p className="text-sm font-medium text-[#0F2942]">
                Confirm Full Amount ({formatZAR(payment.amount)})
              </p>
              <p className="text-xs text-slate-600">
                Mark this payment as Confirmed by recipient in full.
              </p>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-slate-200 p-3 hover:bg-slate-50">
            <input
              type="radio"
              name="decision"
              checked={decision === 'CONFIRM_PARTIAL'}
              onChange={() => setDecision('CONFIRM_PARTIAL')}
              className="mt-1 accent-[#006847]"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-[#0F2942]">Confirm Partial Amount</p>
              <p className="text-xs text-slate-600">
                Record the actual amount received if it was less than {formatZAR(payment.amount)}.
              </p>
              {decision === 'CONFIRM_PARTIAL' && (
                <div className="mt-2 max-w-xs">
                  <label htmlFor="partial-amt" className="block text-xs font-medium text-slate-700">
                    Actual Amount Received (ZAR)
                  </label>
                  <input
                    id="partial-amt"
                    type="number"
                    step="0.01"
                    min="1"
                    max={payment.amount - 0.01}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-1.5 text-sm font-mono tabular-nums text-slate-900 focus:border-[#006847] focus:outline-none"
                  />
                </div>
              )}
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-slate-200 p-3 hover:bg-slate-50">
            <input
              type="radio"
              name="decision"
              checked={decision === 'DISPUTE'}
              onChange={() => setDecision('DISPUTE')}
              className="mt-1 accent-red-700"
            />
            <div>
              <p className="text-sm font-medium text-red-900">Dispute Payment</p>
              <p className="text-xs text-slate-600">
                Mark as Disputed if funds were not received or details are incorrect. A reason is
                required, and the decision is final once saved.
              </p>
            </div>
          </label>
        </fieldset>

        <div>
          <label htmlFor="confirm-note" className="block text-sm font-medium text-slate-800">
            {decision === 'DISPUTE' ? 'Dispute Reason (Required)' : 'Confirmation Note (Optional)'}
          </label>
          <textarea
            id="confirm-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              decision === 'DISPUTE'
                ? 'Explain why this payment is disputed (e.g. reference not reflected or wrong amount)...'
                : 'Add any helpful clarification for your records...'
            }
            className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
              decision === 'DISPUTE'
                ? 'bg-red-700 hover:bg-red-800'
                : 'bg-[#006847] hover:bg-[#005238]'
            }`}
          >
            {submitting ? 'Saving…' : decision === 'DISPUTE' ? 'Submit Dispute' : 'Save Confirmation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
