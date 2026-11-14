import React, { useEffect, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MaintenanceArrangement, PaymentMethod } from '../types';
import { formatZAR } from '../utils/format';
import { Modal } from './Modal';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  arrangements: MaintenanceArrangement[];
  defaultArrangementId?: string;
  onSuccess: (message: string) => void;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'EFT Bank Transfer',
  'eWallet / Instant Money',
  'Cash with Receipt',
  'Retail Money Transfer',
  'Other',
];

export function RecordPaymentModal({
  isOpen,
  onClose,
  arrangements,
  defaultArrangementId,
  onSuccess,
}: RecordPaymentModalProps) {
  const { currentUser } = useAuth();
  const { db, recordPayment } = useData();

  const activeArrangements = arrangements.filter((a) => a.status === 'Active');

  const [arrangementId, setArrangementId] = useState(
    defaultArrangementId || activeArrangements[0]?.id || ''
  );
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('2026-11-12');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFT Bank Transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<{
    fileName: string;
    fileType: string;
    fileSizeLabel: string;
    fileUrl: string;
    description: string;
  } | null>(null);
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const first = defaultArrangementId || activeArrangements[0]?.id || '';
    setArrangementId(first);
    const arr = activeArrangements.find((a) => a.id === first);
    setAmount(arr ? String(arr.expectedAmount) : '');
    setPaymentDate('2026-11-12');
    setPaymentMethod('EFT Bank Transfer');
    setPaymentReference('');
    setEvidenceFile(null);
    setEvidenceDescription('');
    setError('');
  }, [isOpen, defaultArrangementId]);

  const handleArrangementChange = (id: string) => {
    setArrangementId(id);
    const arr = activeArrangements.find((a) => a.id === id);
    if (arr && !amount) {
      setAmount(String(arr.expectedAmount));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeKB = Math.max(1, Math.round(file.size / 1024));
    const sizeLabel = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setEvidenceFile({
          fileName: file.name,
          fileType: file.type,
          fileSizeLabel: sizeLabel,
          fileUrl: typeof reader.result === 'string' ? reader.result : `simulated://local/${file.name}`,
          description: evidenceDescription || 'Uploaded proof of payment image (demo local file).',
        });
      };
      reader.readAsDataURL(file);
    } else {
      setEvidenceFile({
        fileName: file.name,
        fileType: file.type || 'application/pdf',
        fileSizeLabel: sizeLabel,
        fileUrl: `simulated://local/${file.name}`,
        description: evidenceDescription || 'Uploaded proof of payment document metadata (demo local file).',
      });
    }
  };

  const handleAttachSampleEvidence = () => {
    setEvidenceFile({
      fileName: `demo_payment_slip_${paymentDate}.pdf`,
      fileType: 'application/pdf',
      fileSizeLabel: '128 KB',
      fileUrl: `simulated://evidence/demo_payment_slip_${paymentDate}.pdf`,
      description: evidenceDescription || 'Sample payment receipt.',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentUser) return;
    if (!arrangementId) {
      setError('Please select an active maintenance arrangement.');
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid payment amount greater than R 0.00.');
      return;
    }

    if (!paymentDate) {
      setError('Please select the payment date.');
      return;
    }

    recordPayment({
      arrangementId,
      amount: parsedAmount,
      paymentDate,
      paymentMethod,
      paymentReference: paymentReference.trim(),
      recordedByUserId: currentUser.id,
      evidenceFile: evidenceFile
        ? {
            ...evidenceFile,
            description: evidenceDescription.trim() || evidenceFile.description,
          }
        : undefined,
    });

    onSuccess(
      `Payment of ${formatZAR(parsedAmount)} recorded and sent to the receiving parent for confirmation.`
    );
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Maintenance Payment"
      subtitle="Record the payment and attach evidence for confirmation."
      maxWidth="lg"
    >
      {activeArrangements.length === 0 ? (
        <div className="py-4 text-sm text-slate-700">
          <p>
            No active maintenance arrangements are linked to your account yet. Please create a child
            profile and maintenance arrangement first.
          </p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="pay-arrangement" className="block text-sm font-medium text-slate-800">
              Maintenance Arrangement
            </label>
            <select
              id="pay-arrangement"
              value={arrangementId}
              onChange={(e) => handleArrangementChange(e.target.value)}
              className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
            >
              {activeArrangements.map((arr) => {
                const child = db.children.find((c) => c.id === arr.childId);
                const payer = db.users.find((u) => u.id === arr.payingUserId);
                const receiver = db.users.find((u) => u.id === arr.receivingUserId);
                return (
                  <option key={arr.id} value={arr.id}>
                    {child ? `${child.firstName} ${child.lastName}` : 'Child'} —{' '}
                    {formatZAR(arr.expectedAmount)}/{arr.frequency.toLowerCase()} ({payer?.fullName} →{' '}
                    {receiver?.fullName})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pay-amount" className="block text-sm font-medium text-slate-800">
                Amount Paid (ZAR)
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-mono text-slate-500">
                  R
                </span>
                <input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="block w-full rounded-sm border border-slate-300 py-2 pl-8 pr-3 text-sm font-mono tabular-nums text-slate-900 focus:border-[#006847] focus:outline-none"
                  placeholder="1500.00"
                />
              </div>
            </div>

            <div>
              <label htmlFor="pay-date" className="block text-sm font-medium text-slate-800">
                Payment Date
              </label>
              <input
                id="pay-date"
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pay-method" className="block text-sm font-medium text-slate-800">
                Payment Method
              </label>
              <select
                id="pay-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pay-ref" className="block text-sm font-medium text-slate-800">
                Payment Reference (Optional)
              </label>
              <input
                id="pay-ref"
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. EFT-NOV-THABO-02"
                className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#006847] focus:outline-none"
              />
            </div>
          </div>

          <div className="border border-slate-200 bg-slate-50 p-4 rounded-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-[#0F2942]">
                Payment evidence
              </span>
              <button
                type="button"
                onClick={handleAttachSampleEvidence}
                className="text-xs font-medium text-[#006847] hover:underline"
              >
                Add sample receipt
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Uploads are for record-keeping and are not bank-verified.
            </p>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <Upload className="h-4 w-4 text-slate-500" />
                <span>Choose receipt file</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
              {evidenceFile && (
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <FileText className="h-4 w-4 text-[#006847] shrink-0" />
                  <span className="font-medium truncate max-w-[200px]">{evidenceFile.fileName}</span>
                  <span className="text-slate-500">({evidenceFile.fileSizeLabel})</span>
                </div>
              )}
            </div>

            <div className="mt-3">
              <label htmlFor="ev-desc" className="block text-xs font-medium text-slate-700">
                Evidence Note (Optional)
              </label>
              <input
                id="ev-desc"
                type="text"
                value={evidenceDescription}
                onChange={(e) => setEvidenceDescription(e.target.value)}
                placeholder="e.g. Banking app proof of payment screenshot"
                className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              />
            </div>
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
              className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238]"
            >
              Submit Payment Record
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
