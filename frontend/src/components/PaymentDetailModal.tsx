import React, { useEffect, useState } from 'react';
import { FileText, Paperclip } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Payment, ReviewStatus } from '../types';
import { formatSADate, formatZAR } from '../utils/format';
import { Modal } from './Modal';
import { PaymentStatusBadge, ReviewStatusBadge } from './StatusBadge';

interface PaymentDetailModalProps {
  payment: Payment | null;
  onClose: () => void;
  onRequestConfirmDispute?: (payment: Payment) => void;
  onSuccess?: (message: string) => void;
}

const REVIEW_STATUSES: ReviewStatus[] = [
  'Pending Review',
  'Reviewed',
  'Additional Info Requested',
  'Concern Noted',
];

export function PaymentDetailModal({
  payment,
  onClose,
  onRequestConfirmDispute,
  onSuccess,
}: PaymentDetailModalProps) {
  const { currentUser } = useAuth();
  const { db, addEvidenceToPayment, upsertPaymentReview, addProfessionalNote } = useData();

  const existingReview = payment
    ? db.reviews.find((r) => r.paymentId === payment.id)
    : undefined;

  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(
    existingReview?.reviewStatus ?? 'Pending Review'
  );
  const [reviewNotes, setReviewNotes] = useState(existingReview?.reviewNotes ?? '');
  const [caseNote, setCaseNote] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!payment) return;
    const rev = db.reviews.find((r) => r.paymentId === payment.id);
    setReviewStatus(rev?.reviewStatus ?? 'Pending Review');
    setReviewNotes(rev?.reviewNotes ?? '');
    setCaseNote('');
    setFeedback('');
  }, [payment, db.reviews]);

  if (!payment || !currentUser) return null;

  const child = db.children.find((c) => c.id === payment.childId);
  const arrangement = db.arrangements.find((a) => a.id === payment.arrangementId);
  const payer = db.users.find((u) => u.id === payment.payingUserId);
  const receiver = db.users.find((u) => u.id === payment.receivingUserId);
  const evidenceList = db.evidence.filter((ev) => ev.paymentId === payment.id);

  const isSocialWorker = currentUser.role === 'SOCIAL_WORKER';
  const isRecipient = currentUser.id === payment.receivingUserId;
  const isPayer = currentUser.id === payment.payingUserId;
  const canConfirmOrDispute =
    !isSocialWorker &&
    isRecipient &&
    (payment.status === 'Awaiting confirmation' || payment.status === 'Submitted');
  const canAddEvidence = !isSocialWorker && isPayer;

  // Only metadata is saved for now; the file itself is not uploaded.
  const handleUploadExtraEvidence = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setFeedback('Proof of payment must be an image or a PDF.');
      input.value = '';
      return;
    }
    const sizeKB = Math.max(1, Math.round(file.size / 1024));
    const sizeLabel = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

    try {
      await addEvidenceToPayment({
        paymentId: payment.id,
        fileName: file.name,
        fileType: file.type,
        fileSizeLabel: sizeLabel,
        description: 'Additional payment evidence.',
      });
      setFeedback(`Evidence "${file.name}" attached to this payment record.`);
    } catch (uploadError) {
      setFeedback(uploadError instanceof Error ? uploadError.message : 'The evidence could not be saved.');
    }
    input.value = '';
  };

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewNotes.trim()) {
      setFeedback('Please enter review notes before saving.');
      return;
    }
    upsertPaymentReview({
      paymentId: payment.id,
      reviewedBy: currentUser.id,
      reviewStatus,
      reviewNotes,
    });
    if (caseNote.trim()) {
      addProfessionalNote({
        socialWorkerId: currentUser.id,
        childId: payment.childId,
        note: caseNote.trim(),
      });
      setCaseNote('');
    }
    setFeedback('Social worker review saved.');
    onSuccess?.('Payment review and notes updated.');
  };

  return (
    <Modal
      isOpen={Boolean(payment)}
      onClose={onClose}
      title="Payment Record Details"
      subtitle={`Reference: ${payment.paymentReference}`}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {feedback && (
          <div className="rounded-sm border border-emerald-700/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {feedback}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 border border-slate-200 bg-slate-50/70 p-4 rounded-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Child</p>
            <p className="mt-0.5 text-sm font-semibold text-[#0F2942]">
              {child ? `${child.firstName} ${child.lastName}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Expected Arrangement</p>
            <p className="mt-0.5 text-sm font-mono tabular-nums text-slate-800">
              {arrangement ? `${formatZAR(arrangement.expectedAmount)} / ${arrangement.frequency}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Current Status</p>
            <div className="mt-1">
              <PaymentStatusBadge status={payment.status} />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500">Submitted Amount</p>
            <p className="mt-0.5 text-base font-mono font-semibold tabular-nums text-[#0F2942]">
              {formatZAR(payment.amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Confirmed Amount</p>
            <p className="mt-0.5 text-base font-mono font-semibold tabular-nums text-[#006847]">
              {payment.confirmedAmount !== undefined ? formatZAR(payment.confirmedAmount) : 'Pending'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Payment Date</p>
            <p className="mt-0.5 text-sm text-slate-800">{formatSADate(payment.paymentDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Paying Parent</p>
            <p className="mt-0.5 text-sm text-slate-800">{payer?.fullName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Receiving Parent</p>
            <p className="mt-0.5 text-sm text-slate-800">{receiver?.fullName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Payment Method</p>
            <p className="mt-0.5 text-sm text-slate-800">{payment.paymentMethod}</p>
          </div>
        </div>

        {(payment.recipientNote || payment.disputeReason) && (
          <div
            className={`rounded-sm border p-3.5 text-sm ${
              payment.status === 'Disputed'
                ? 'border-red-300 bg-red-50 text-red-900'
                : 'border-slate-200 bg-white text-slate-800'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {payment.status === 'Disputed' ? 'Dispute Explanation' : 'Recipient Note'}
            </p>
            <p className="mt-1">{payment.disputeReason || payment.recipientNote}</p>
          </div>
        )}

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#0F2942]">
              Payment Evidence ({evidenceList.length})
            </h3>
            {canAddEvidence && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <Paperclip className="h-3.5 w-3.5" />
                <span>Attach additional evidence</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleUploadExtraEvidence}
                  className="sr-only"
                />
              </label>
            )}
          </div>

          {evidenceList.length === 0 ? (
            <p className="mt-2 rounded-sm border border-dashed border-slate-300 p-3 text-xs text-slate-500">
              No payment evidence files have been attached to this payment record.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {evidenceList.map((ev) => {
                const uploader = db.users.find((u) => u.id === ev.uploadedBy);
                return (
                  <div
                    key={ev.id}
                    className="rounded-sm border border-slate-200 bg-white p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <FileText className="mt-0.5 h-4 w-4 text-[#006847] shrink-0" />
                        <div>
                          <p className="font-medium text-slate-900">{ev.fileName}</p>
                          <p className="text-xs text-slate-500">
                            {ev.fileSizeLabel} · Uploaded {formatSADate(ev.uploadedAt)} by{' '}
                            {uploader?.fullName ?? 'User'}
                          </p>
                          {ev.description && <p className="mt-1 text-xs text-slate-700">{ev.description}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!isSocialWorker && existingReview && (
          <div className="border border-slate-200 bg-slate-50 p-4 rounded-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#0F2942]">Social Worker Review</h3>
              <ReviewStatusBadge status={existingReview.reviewStatus} />
            </div>
            <p className="mt-2 text-sm text-slate-700">{existingReview.reviewNotes}</p>
            <p className="mt-1 text-xs text-slate-500">
              Updated {formatSADate(existingReview.reviewedAt)}
            </p>
          </div>
        )}

        {isSocialWorker && (
          <form
            onSubmit={handleSaveReview}
            className="space-y-3 border-t border-slate-200 pt-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#0F2942]">
                Social Worker Review &amp; Case Action
              </h3>
              <ReviewStatusBadge status={reviewStatus} />
            </div>
            <p className="text-xs text-slate-600">
              Review evidence, update the status or request more information.
            </p>

            <div>
              <label htmlFor="sw-rev-status" className="block text-xs font-medium text-slate-700">
                Review Status
              </label>
              <select
                id="sw-rev-status"
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value as ReviewStatus)}
                className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              >
                {REVIEW_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sw-rev-notes" className="block text-xs font-medium text-slate-700">
                Review Notes / Information Request
              </label>
              <textarea
                id="sw-rev-notes"
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Document your review findings or specify what additional proof is needed..."
                className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="sw-case-note" className="block text-xs font-medium text-slate-700">
                Add Professional Note to Child Case File (Optional)
              </label>
              <textarea
                id="sw-case-note"
                rows={2}
                value={caseNote}
                onChange={(e) => setCaseNote(e.target.value)}
                placeholder="Optional note added directly to the child's professional case notes..."
                className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="submit"
                className="rounded-sm bg-[#0F2942] px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Save Review
              </button>
            </div>
          </form>
        )}

        {!isSocialWorker && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
            {canConfirmOrDispute && onRequestConfirmDispute && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestConfirmDispute(payment);
                }}
                className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238]"
              >
                Confirm or Dispute Payment
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
