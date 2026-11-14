import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useSocialWorkerScope } from '../../hooks/useFamilyScope';
import { Payment } from '../../types';
import { formatSADateShort, formatZAR } from '../../utils/format';
import { PaymentDetailModal } from '../../components/PaymentDetailModal';
import { PaymentStatusBadge, ReviewStatusBadge } from '../../components/StatusBadge';
import { SummaryCard } from '../../components/SummaryCard';
import { ToastBanner } from '../../components/ToastBanner';

export function SocialWorkerDashboard() {
  const { currentUser } = useAuth();
  const { db } = useData();
  const {
    children,
    arrangements,
    payments,
    concerns,
    reviews,
    notes,
    awaitingReviewCount,
    openConcernsCount,
    recentlyUpdatedCount,
  } = useSocialWorkerScope();

  const [search, setSearch] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [toast, setToast] = useState('');

  const assignedFamilyRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return children
      .map((child) => {
        const arr = arrangements.find((a) => a.childId === child.id && a.status === 'Active');
        const payer = arr ? db.users.find((u) => u.id === arr.payingUserId) : undefined;
        const receiver = arr ? db.users.find((u) => u.id === arr.receivingUserId) : undefined;
        const childConcerns = concerns.filter(
          (c) => c.childId === child.id && c.status !== 'Resolved'
        );
        const childPayments = payments.filter((p) => p.childId === child.id);
        const latest = childPayments[0];
        const latestRev = latest ? reviews.find((r) => r.paymentId === latest.id) : undefined;
        return {
          child,
          arr,
          payer,
          receiver,
          openConcerns: childConcerns.length,
          latestPayment: latest,
          latestReviewStatus: latestRev?.reviewStatus ?? 'Pending Review',
        };
      })
      .filter((row) => {
        if (!q) return true;
        const text = [
          row.child.firstName,
          row.child.lastName,
          row.payer?.fullName ?? '',
          row.receiver?.fullName ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return text.includes(q);
      });
  }, [children, arrangements, db.users, concerns, payments, reviews, search]);

  const paymentsAwaitingReview = useMemo(() => {
    return payments.filter((p) => {
      const rev = reviews.find((r) => r.paymentId === p.id);
      return !rev || rev.reviewStatus === 'Pending Review' || rev.reviewStatus === 'Additional Info Requested';
    });
  }, [payments, reviews]);

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Dashboard</h1>
        </div>

        <Link
          to="/social-worker/concerns"
          className="rounded-sm bg-[#0F2942] px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 whitespace-nowrap"
        >
          Payment concerns ({openConcernsCount})
        </Link>
      </div>

      {toast && <ToastBanner type="success" message={toast} onDismiss={() => setToast('')} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Assigned cases"
          value={children.length}
          helper="Active assignments"
        />
        <SummaryCard
          label="Awaiting review"
          value={awaitingReviewCount}
          helper="Pending or more information requested"
          tone={awaitingReviewCount > 0 ? 'amber' : 'green'}
        />
        <SummaryCard
          label="Open concerns"
          value={openConcernsCount}
          helper="Disputed or short contributions"
          tone={openConcernsCount > 0 ? 'amber' : 'green'}
        />
        <SummaryCard
          label="Recently updated"
          value={recentlyUpdatedCount}
          helper="This month"
        />
      </div>

      <div className="border border-slate-200 bg-white p-5 rounded-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-[#0F2942]">
              Assigned Families &amp; Cases
            </h2>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search child or parent..."
              aria-label="Search assigned families"
              className="block w-full rounded-sm border border-slate-300 py-1.5 pl-9 pr-3 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="px-3 py-2.5">Child</th>
                <th className="px-3 py-2.5">Receiving Caregiver</th>
                <th className="px-3 py-2.5">Paying Parent</th>
                <th className="px-3 py-2.5 text-right">Expected Monthly</th>
                <th className="px-3 py-2.5">Latest Review</th>
                <th className="px-3 py-2.5 text-right">Concerns</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {assignedFamilyRows.map((row) => (
                <tr key={row.child.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2.5 font-semibold text-[#0F2942] whitespace-nowrap">
                    {row.child.firstName} {row.child.lastName}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                    {row.receiver?.fullName ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                    {row.payer?.fullName ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                    {row.arr ? formatZAR(row.arr.expectedAmount) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <ReviewStatusBadge status={row.latestReviewStatus} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {row.openConcerns > 0 ? (
                      <span className="font-semibold text-red-700">{row.openConcerns} open</span>
                    ) : (
                      <span className="text-slate-500">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {row.latestPayment ? (
                      <button
                        type="button"
                        onClick={() => setSelectedPayment(row.latestPayment!)}
                        className="text-xs font-semibold text-[#006847] hover:underline"
                      >
                        Review Record
                      </button>
                    ) : (
                      <Link
                        to="/social-worker/families"
                        className="text-xs font-medium text-[#0F2942] hover:underline"
                      >
                        View Case
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 border border-slate-200 bg-white p-5 rounded-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">
              Payment Records Awaiting Review ({paymentsAwaitingReview.length})
            </h2>
            <Link
              to="/social-worker/payments"
              className="text-xs font-medium text-[#006847] hover:underline"
            >
              All records
            </Link>
          </div>

          {paymentsAwaitingReview.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              All assigned payment records have been reviewed.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {paymentsAwaitingReview.slice(0, 5).map((p) => {
                const child = db.children.find((c) => c.id === p.childId);
                const rev = reviews.find((r) => r.paymentId === p.id);
                return (
                  <div key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#0F2942]">
                          {child ? `${child.firstName} ${child.lastName}` : 'Child'}
                        </span>
                        <PaymentStatusBadge status={p.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {formatSADateShort(p.paymentDate)} · {formatZAR(p.amount)} ·{' '}
                        {rev?.reviewStatus ?? 'Pending Review'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPayment(p)}
                      className="rounded-sm border border-[#0F2942] px-3 py-1.5 text-xs font-medium text-[#0F2942] hover:bg-slate-50"
                    >
                      Review Record
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 border border-slate-200 bg-white p-5 rounded-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">
              Latest Professional Notes
            </h2>
            <Link
              to="/social-worker/children"
              className="text-xs font-medium text-[#006847] hover:underline"
            >
              Add note
            </Link>
          </div>

          {notes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No professional notes recorded yet.</p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {notes.slice(0, 4).map((note) => {
                const child = db.children.find((c) => c.id === note.childId);
                return (
                  <div key={note.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#0F2942]">
                        {child ? `${child.firstName} ${child.lastName}` : 'Case'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {formatSADateShort(note.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">{note.note}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <PaymentDetailModal
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
        onSuccess={(msg) => setToast(msg)}
      />
    </div>
  );
}
