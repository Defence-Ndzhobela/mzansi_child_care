import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { CURRENT_DEMO_MONTH, useParentScope } from '../../hooks/useFamilyScope';
import { Payment } from '../../types';
import {
  calculateAge,
  formatMonthYear,
  formatSADate,
  formatSADateShort,
  formatZAR,
} from '../../utils/format';
import { ConfirmDisputeModal } from '../../components/ConfirmDisputeModal';
import { EmptyState } from '../../components/EmptyState';
import { PaymentDetailModal } from '../../components/PaymentDetailModal';
import { RecordPaymentModal } from '../../components/RecordPaymentModal';
import { PaymentStatusBadge } from '../../components/StatusBadge';
import { SummaryCard } from '../../components/SummaryCard';
import { ToastBanner } from '../../components/ToastBanner';

export function ParentDashboard() {
  const { currentUser } = useAuth();
  const { db } = useData();
  const {
    children,
    arrangements,
    payments,
    expectedMonthly,
    receivedCurrentMonth,
    outstandingCurrentMonth,
    latestPaymentDate,
    awaitingConfirmationCount,
  } = useParentScope();

  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Payment | null>(null);
  const [toast, setToast] = useState('');

  const monthlyChartData = useMemo(() => {
    const months = ['2026-09', '2026-10', '2026-11'];
    return months.map((m) => {
      const monthPayments = payments.filter((p) => p.paymentDate.startsWith(m));
      const confirmed = monthPayments.reduce((sum, p) => {
        if (p.status === 'Confirmed by recipient') return sum + (p.confirmedAmount ?? p.amount);
        if (p.status === 'Partially confirmed') return sum + (p.confirmedAmount ?? 0);
        return sum;
      }, 0);
      return {
        month: formatMonthYear(m).split(' ')[0],
        Expected: expectedMonthly,
        Confirmed: confirmed,
      };
    });
  }, [payments, expectedMonthly]);

  if (!currentUser) return null;

  const recentPayments = payments.slice(0, 5);
  const activeArrangements = arrangements.filter((a) => a.status === 'Active');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">{formatMonthYear(CURRENT_DEMO_MONTH)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setRecordOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Record Payment</span>
          </button>
          <Link
            to="/parent/history"
            className="inline-flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-[#0F2942] hover:bg-slate-50 whitespace-nowrap"
          >
            <span>Payment history</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {toast && <ToastBanner type="success" message={toast} onDismiss={() => setToast('')} />}

      {awaitingConfirmationCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-sky-700/30 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <div>
            <span className="font-semibold">Action required:</span> You have{' '}
            <span className="font-mono font-semibold">{awaitingConfirmationCount}</span> recorded{' '}
            {awaitingConfirmationCount === 1 ? 'payment' : 'payments'} awaiting your confirmation.
          </div>
          <Link
            to="/parent/payments"
            className="rounded-sm bg-[#0F2942] px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
          >
            Review Payments
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Expected monthly"
          value={formatZAR(expectedMonthly)}
          helper={`${activeArrangements.length} active arrangement${activeArrangements.length === 1 ? '' : 's'}`}
        />
        <SummaryCard
          label="Received (Nov 2026)"
          value={formatZAR(receivedCurrentMonth)}
          helper="Confirmed payments"
          tone="green"
        />
        <SummaryCard
          label="Outstanding (Nov 2026)"
          value={formatZAR(outstandingCurrentMonth)}
          helper="Based on confirmed records"
          tone={outstandingCurrentMonth > 0 ? 'amber' : 'green'}
        />
        <SummaryCard
          label="Latest payment"
          value={latestPaymentDate ? formatSADate(latestPaymentDate) : 'No payments'}
          helper={payments.length > 0 ? `${payments.length} total recorded payments` : 'Record your first entry'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 border border-slate-200 bg-white p-5 rounded-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">
              Recent Payment Activity
            </h2>
            <Link to="/parent/history" className="text-xs font-medium text-[#006847] hover:underline">
              Full history
            </Link>
          </div>

          {recentPayments.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No payments recorded yet"
                description="Record a maintenance payment to begin tracking your contribution history."
                actionLabel="Record Payment"
                onAction={() => setRecordOpen(true)}
              />
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Child</th>
                    <th className="py-2 pr-3 text-right">Amount</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPayments.map((p) => {
                    const child = db.children.find((c) => c.id === p.childId);
                    const canConfirm =
                      p.receivingUserId === currentUser.id &&
                      (p.status === 'Awaiting confirmation' || p.status === 'Submitted');
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-3 text-xs text-slate-700 whitespace-nowrap">
                          {formatSADateShort(p.paymentDate)}
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-[#0F2942] whitespace-nowrap">
                          {child ? `${child.firstName} ${child.lastName}` : '—'}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                          {formatZAR(p.amount)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <PaymentStatusBadge status={p.status} />
                        </td>
                        <td className="py-2.5 text-right whitespace-nowrap space-x-2">
                          {canConfirm && (
                            <button
                              type="button"
                              onClick={() => setConfirmTarget(p)}
                              className="text-xs font-semibold text-[#006847] hover:underline"
                            >
                              Confirm
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedPayment(p)}
                            className="text-xs font-medium text-[#0F2942] hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 border border-slate-200 bg-white p-5 rounded-sm">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">
              Monthly Expected vs Confirmed (ZAR)
            </h2>
            <p className="text-xs text-slate-500">September – November 2026</p>
          </div>
          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  formatter={(value) => formatZAR(Number(value))}
                  contentStyle={{
                    borderRadius: '2px',
                    borderColor: '#CBD5E1',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Expected" fill="#0F2942" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Confirmed" fill="#006847" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border border-slate-200 bg-white p-5 rounded-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">
              Maintenance Arrangements
            </h2>
            <Link
              to="/parent/arrangements"
              className="text-xs font-medium text-[#006847] hover:underline"
            >
              Manage arrangements
            </Link>
          </div>

          {arrangements.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No maintenance arrangements found. Create one to start tracking expected monthly
              payments.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {arrangements.map((arr) => {
                const child = db.children.find((c) => c.id === arr.childId);
                const payer = db.users.find((u) => u.id === arr.payingUserId);
                const receiver = db.users.find((u) => u.id === arr.receivingUserId);
                return (
                  <div key={arr.id} className="py-3 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#0F2942]">
                        {child ? `${child.firstName} ${child.lastName}` : 'Child'}
                      </p>
                      <p className="text-xs text-slate-600">
                        {payer?.fullName} → {receiver?.fullName} · {arr.frequency}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-semibold tabular-nums text-[#0F2942]">
                        {formatZAR(arr.expectedAmount)}
                      </p>
                      <p className="text-xs text-slate-500">{arr.status}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border border-slate-200 bg-white p-5 rounded-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">
              My Children ({children.length})
            </h2>
            <Link
              to="/parent/children"
              className="text-xs font-medium text-[#006847] hover:underline"
            >
              Manage children
            </Link>
          </div>

          {children.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No child profiles are linked to your account yet.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {children.map((child) => {
                const rel = db.familyRelationships.find(
                  (r) => r.childId === child.id && r.userId === currentUser.id
                );
                return (
                  <div key={child.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#0F2942]">
                        {child.firstName} {child.lastName}
                      </p>
                      <p className="text-xs text-slate-600">
                        Born {formatSADate(child.dateOfBirth)} ({calculateAge(child.dateOfBirth)}{' '}
                        years)
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-600">
                      {rel?.relationshipType ?? 'Caregiver'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <RecordPaymentModal
        isOpen={recordOpen}
        onClose={() => setRecordOpen(false)}
        arrangements={arrangements}
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
