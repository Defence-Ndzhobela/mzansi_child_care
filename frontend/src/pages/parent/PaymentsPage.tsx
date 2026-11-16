import { useState } from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useParentScope } from '../../hooks/useFamilyScope';
import { Payment } from '../../types';
import { formatSADateShort, formatZAR } from '../../utils/format';
import { ConfirmDisputeModal } from '../../components/ConfirmDisputeModal';
import { EmptyState } from '../../components/EmptyState';
import { PaymentDetailModal } from '../../components/PaymentDetailModal';
import { RecordPaymentModal } from '../../components/RecordPaymentModal';
import { PaymentStatusBadge } from '../../components/StatusBadge';
import { ToastBanner } from '../../components/ToastBanner';

export function PaymentsPage() {
  const { currentUser } = useAuth();
  const { db } = useData();
  const { payingArrangements, payments, isPayer, isReceiver } = useParentScope();
  const canRecord = payingArrangements.some((a) => a.status === 'Active');

  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Payment | null>(null);
  const [toast, setToast] = useState('');

  if (!currentUser) return null;

  const awaitingMyConfirmation = payments.filter(
    (p) =>
      p.receivingUserId === currentUser.id &&
      (p.status === 'Awaiting confirmation' || p.status === 'Submitted')
  );

  const submittedOrConfirmed = payments.filter(
    (p) =>
      !(
        p.receivingUserId === currentUser.id &&
        (p.status === 'Awaiting confirmation' || p.status === 'Submitted')
      )
  );

  const subtitle =
    isPayer && isReceiver
      ? 'Record payments you make and confirm payments you receive.'
      : isReceiver
        ? 'Confirm, partially confirm or dispute payments recorded for you.'
        : 'Record the payments you make and track their confirmation.';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Payments</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        {canRecord && (
          <button
            type="button"
            onClick={() => setRecordOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Record Payment</span>
          </button>
        )}
      </div>

      {toast && <ToastBanner type="success" message={toast} onDismiss={() => setToast('')} />}

      {awaitingMyConfirmation.length > 0 && (
        <section className="border border-sky-700/30 bg-white rounded-sm">
          <div className="border-b border-sky-200 bg-sky-50 px-5 py-3">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">
              Awaiting Your Confirmation ({awaitingMyConfirmation.length})
            </h2>
            <p className="text-xs text-slate-600">
              Confirm the amount received or dispute this payment.
            </p>
          </div>
          <div className="divide-y divide-slate-200">
            {awaitingMyConfirmation.map((p) => {
              const child = db.children.find((c) => c.id === p.childId);
              const payer = db.users.find((u) => u.id === p.payingUserId);
              const evidenceCount = db.evidence.filter((e) => e.paymentId === p.id).length;

              return (
                <div
                  key={p.id}
                  className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#0F2942]">
                        {child ? `${child.firstName} ${child.lastName}` : 'Child'}
                      </span>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                    <p className="text-sm text-slate-700">
                      Submitted by <span className="font-medium">{payer?.fullName}</span> on{' '}
                      {formatSADateShort(p.paymentDate)} · {p.paymentMethod}
                    </p>
                    <p className="text-xs font-mono text-slate-500">
                      Ref: {p.paymentReference} · {evidenceCount} evidence file(s)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-mono font-bold tabular-nums text-[#0F2942] mr-2">
                      {formatZAR(p.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedPayment(p)}
                      className="rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmTarget(p)}
                      className="rounded-sm bg-[#006847] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#005238]"
                    >
                      Confirm or Dispute
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="border border-slate-200 bg-white rounded-sm">
        <div className="border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-[#0F2942]">
            Recorded Payments ({submittedOrConfirmed.length})
          </h2>
        </div>

        {payments.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No payment records yet"
              description={
                canRecord
                  ? 'Record your first maintenance contribution to start tracking confirmations and balances.'
                  : 'Payments recorded by the paying parent will appear here for you to confirm.'
              }
              actionLabel={canRecord ? 'Record Payment' : undefined}
              onAction={canRecord ? () => setRecordOpen(true) : undefined}
              icon={<CreditCard className="h-6 w-6" />}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Child</th>
                  <th className="px-4 py-3">Paying → Receiving</th>
                  <th className="px-4 py-3 text-right">Submitted</th>
                  <th className="px-4 py-3 text-right">Confirmed</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {submittedOrConfirmed.map((p) => {
                  const child = db.children.find((c) => c.id === p.childId);
                  const payer = db.users.find((u) => u.id === p.payingUserId);
                  const receiver = db.users.find((u) => u.id === p.receivingUserId);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                        {formatSADateShort(p.paymentDate)}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#0F2942] whitespace-nowrap">
                        {child ? `${child.firstName} ${child.lastName}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {payer?.fullName} → {receiver?.fullName}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                        {formatZAR(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[#006847] whitespace-nowrap">
                        {p.confirmedAmount !== undefined ? formatZAR(p.confirmedAmount) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedPayment(p)}
                          className="text-xs font-medium text-[#0F2942] hover:underline"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RecordPaymentModal
        isOpen={recordOpen}
        onClose={() => setRecordOpen(false)}
        arrangements={payingArrangements}
        onSuccess={(msg) => setToast(msg)}
      />

      <PaymentDetailModal
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
        onRequestConfirmDispute={(p) => setConfirmTarget(p)}
      />

      <ConfirmDisputeModal
        payment={confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onSuccess={(msg) => setToast(msg)}
      />
    </div>
  );
}
