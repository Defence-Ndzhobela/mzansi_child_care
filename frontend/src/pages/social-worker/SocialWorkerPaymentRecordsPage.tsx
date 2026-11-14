import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useSocialWorkerScope } from '../../hooks/useFamilyScope';
import { Payment, PaymentStatus, ReviewStatus } from '../../types';
import { formatSADateShort, formatZAR } from '../../utils/format';
import { EmptyState } from '../../components/EmptyState';
import { PaymentDetailModal } from '../../components/PaymentDetailModal';
import { PaymentStatusBadge, ReviewStatusBadge } from '../../components/StatusBadge';
import { ToastBanner } from '../../components/ToastBanner';

export function SocialWorkerPaymentRecordsPage() {
  const { db } = useData();
  const { payments, reviews } = useSocialWorkerScope();

  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'All' | PaymentStatus>('All');
  const [reviewFilter, setReviewFilter] = useState<'All' | ReviewStatus>('All');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [toast, setToast] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (paymentStatus !== 'All' && p.status !== paymentStatus) return false;
      const rev = reviews.find((r) => r.paymentId === p.id);
      const effectiveReview: ReviewStatus = rev?.reviewStatus ?? 'Pending Review';
      if (reviewFilter !== 'All' && effectiveReview !== reviewFilter) return false;
      if (!q) return true;

      const child = db.children.find((c) => c.id === p.childId);
      const payer = db.users.find((u) => u.id === p.payingUserId);
      const receiver = db.users.find((u) => u.id === p.receivingUserId);
      return [
        child ? `${child.firstName} ${child.lastName}` : '',
        payer?.fullName ?? '',
        receiver?.fullName ?? '',
        p.paymentReference,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [payments, reviews, search, paymentStatus, reviewFilter, db.children, db.users]);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-display text-2xl font-bold text-[#0F2942]">Payment Records</h1>
      </div>

      {toast && <ToastBanner type="success" message={toast} onDismiss={() => setToast('')} />}

      <div className="border border-slate-200 bg-white p-4 rounded-sm grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="sw-pay-search" className="block text-xs font-medium text-slate-700">
            Search Child, Parent, or Reference
          </label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="sw-pay-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="block w-full rounded-sm border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="sw-pay-status" className="block text-xs font-medium text-slate-700">
            Payment Status
          </label>
          <select
            id="sw-pay-status"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value as 'All' | PaymentStatus)}
            className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
          >
            <option value="All">All Payment Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Awaiting confirmation">Awaiting confirmation</option>
            <option value="Confirmed by recipient">Confirmed by recipient</option>
            <option value="Partially confirmed">Partially confirmed</option>
            <option value="Disputed">Disputed</option>
          </select>
        </div>

        <div>
          <label htmlFor="sw-rev-filter" className="block text-xs font-medium text-slate-700">
            Review Status
          </label>
          <select
            id="sw-rev-filter"
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value as 'All' | ReviewStatus)}
            className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
          >
            <option value="All">All Review Statuses</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Additional Info Requested">Additional Info Requested</option>
            <option value="Concern Noted">Concern Noted</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching assigned payment records"
          description="Try clearing your search or status filters."
          actionLabel="Reset Filters"
          onAction={() => {
            setSearch('');
            setPaymentStatus('All');
            setReviewFilter('All');
          }}
        />
      ) : (
        <div className="overflow-x-auto border border-slate-200 bg-white rounded-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Child</th>
                <th className="px-4 py-3">Parties</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Payment Status</th>
                <th className="px-4 py-3">Review Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((p) => {
                const child = db.children.find((c) => c.id === p.childId);
                const payer = db.users.find((u) => u.id === p.payingUserId);
                const receiver = db.users.find((u) => u.id === p.receivingUserId);
                const rev = reviews.find((r) => r.paymentId === p.id);

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
                    <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatZAR(p.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ReviewStatusBadge status={rev?.reviewStatus ?? 'Pending Review'} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedPayment(p)}
                        className="text-xs font-semibold text-[#006847] hover:underline"
                      >
                        Review Record
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
