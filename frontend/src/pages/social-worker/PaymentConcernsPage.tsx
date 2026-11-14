import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useSocialWorkerScope } from '../../hooks/useFamilyScope';
import { Payment, PaymentConcern } from '../../types';
import { formatSADate, formatZAR } from '../../utils/format';
import { EmptyState } from '../../components/EmptyState';
import { PaymentDetailModal } from '../../components/PaymentDetailModal';
import { ConcernStatusBadge, PaymentStatusBadge } from '../../components/StatusBadge';
import { ToastBanner } from '../../components/ToastBanner';

const CONCERN_STATUSES: PaymentConcern['status'][] = [
  'Open',
  'Under Review',
  'Info Requested',
  'Resolved',
];

export function PaymentConcernsPage() {
  const { db, updateConcernStatus } = useData();
  const { concerns, payments } = useSocialWorkerScope();

  const [statusFilter, setStatusFilter] = useState<'All' | PaymentConcern['status']>('All');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [toast, setToast] = useState('');

  const filteredConcerns = concerns.filter(
    (c) => statusFilter === 'All' || c.status === statusFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Payment Concerns</h1>
          <p className="mt-1 text-sm text-slate-600">Review and update reported payment concerns.</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(['All', ...CONCERN_STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-[#0F2942] text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {toast && <ToastBanner type="success" message={toast} onDismiss={() => setToast('')} />}

      {filteredConcerns.length === 0 ? (
        <EmptyState
          title="No payment concerns in this view"
          description="No concerns match this filter."
          actionLabel={statusFilter !== 'All' ? 'Show All Concerns' : undefined}
          onAction={statusFilter !== 'All' ? () => setStatusFilter('All') : undefined}
        />
      ) : (
        <div className="space-y-4">
          {filteredConcerns.map((concern) => {
            const child = db.children.find((c) => c.id === concern.childId);
            const reporter = db.users.find((u) => u.id === concern.reportedBy);
            const linkedPayment = payments.find((p) => p.id === concern.paymentId);

            return (
              <div
                key={concern.id}
                className="border border-slate-200 bg-white p-5 rounded-sm space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-base font-semibold text-[#0F2942]">
                        {child ? `${child.firstName} ${child.lastName}` : 'Child'}
                      </h2>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-medium text-slate-700">{concern.category}</span>
                      <ConcernStatusBadge status={concern.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Reported by {reporter?.fullName ?? 'Caregiver'} on{' '}
                      {formatSADate(concern.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label htmlFor={`conc-${concern.id}`} className="sr-only">
                      Concern Status
                    </label>
                    <select
                      id={`conc-${concern.id}`}
                      value={concern.status}
                      onChange={(e) => {
                        updateConcernStatus(
                          concern.id,
                          e.target.value as PaymentConcern['status']
                        );
                        setToast(`Concern status updated to "${e.target.value}".`);
                      }}
                      className="rounded-sm border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-[#006847] focus:outline-none"
                    >
                      {CONCERN_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-sm text-slate-800">{concern.description}</p>

                {linkedPayment && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
                    <div className="flex flex-wrap items-center gap-3 text-slate-600">
                      <span className="font-mono">{linkedPayment.paymentReference}</span>
                      <span>Submitted: {formatZAR(linkedPayment.amount)}</span>
                      <PaymentStatusBadge status={linkedPayment.status} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPayment(linkedPayment)}
                      className="font-semibold text-[#006847] hover:underline"
                    >
                      Review Linked Payment &amp; Evidence
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PaymentDetailModal
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
        onSuccess={(msg) => setToast(msg)}
      />
    </div>
  );
}
