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
import { isAwaitingMyConfirmation, roleInArrangement, useParentScope } from '../../hooks/useFamilyScope';
import { MaintenanceArrangement, MaintenanceRole, Payment, RoleSummary } from '../../types';
import {
  calculateAge,
  currentMonthKey,
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
import { WelcomeBanner } from '../../components/WelcomeBanner';
import { IMAGES } from '../../config/images';

const MONTHLY_FACTOR = { Monthly: 1, Fortnightly: 2, Weekly: 4 } as const;

function lastMonths(count: number): string[] {
  const [year, month] = currentMonthKey().split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month - 1 - (count - 1 - index), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

// Mirrors the backend rule: only active arrangements that overlap the month are expected.
function expectedForMonth(arrangement: MaintenanceArrangement, month: string): number {
  if (arrangement.status !== 'Active') return 0;
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;
  if (arrangement.startDate > monthEnd || (arrangement.endDate && arrangement.endDate < monthStart)) return 0;
  return arrangement.expectedAmount * MONTHLY_FACTOR[arrangement.frequency];
}

function confirmedAmountOf(payment: Payment): number {
  if (payment.status === 'Confirmed by recipient') return payment.confirmedAmount ?? payment.amount;
  if (payment.status === 'Partially confirmed') return payment.confirmedAmount ?? 0;
  return 0;
}

export function ParentDashboard() {
  const { currentUser } = useAuth();
  const { db, dashboardSummary, maintenanceLoading, maintenanceError } = useData();
  const { children, arrangements, payments, awaitingMyConfirmation, isPayer, isReceiver } =
    useParentScope();

  const [selectedView, setSelectedView] = useState<MaintenanceRole | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Payment | null>(null);
  const [toast, setToast] = useState('');

  // One dashboard adapts to the responsibility the user has in each arrangement. Someone who
  // both pays and receives gets a switch, so the two kinds of money are never added together.
  const view: MaintenanceRole | null =
    selectedView === 'PAYING' && isPayer
      ? 'PAYING'
      : selectedView === 'RECEIVING' && isReceiver
        ? 'RECEIVING'
        : isReceiver && awaitingMyConfirmation.length > 0
          ? 'RECEIVING'
          : isPayer
            ? 'PAYING'
            : isReceiver
              ? 'RECEIVING'
              : null;

  const myId = currentUser?.id ?? '';
  const viewArrangements = useMemo(
    () => arrangements.filter((a) => roleInArrangement(a, myId) === view),
    [arrangements, myId, view]
  );
  const viewPayments = useMemo(
    () =>
      payments.filter((p) => (view === 'PAYING' ? p.payingUserId === myId : p.receivingUserId === myId)),
    [payments, myId, view]
  );
  const summary: RoleSummary | null =
    (view === 'PAYING' ? dashboardSummary?.paying : dashboardSummary?.receiving) ?? null;

  const monthlyChartData = useMemo(() => {
    return lastMonths(3).map((m) => {
      const inMonth = viewPayments.filter((p) => p.paymentDate.startsWith(m));
      return {
        month: formatMonthYear(m).split(' ')[0],
        Expected: viewArrangements.reduce((sum, a) => sum + expectedForMonth(a, m), 0),
        Confirmed: inMonth.reduce((sum, p) => sum + confirmedAmountOf(p), 0),
      };
    });
  }, [viewPayments, viewArrangements]);

  if (!currentUser) return null;

  const month = dashboardSummary?.month ?? currentMonthKey();
  const recentPayments = viewPayments.slice(0, 5);
  const activeArrangements = viewArrangements.filter((a) => a.status === 'Active');
  const payerArrangements = arrangements.filter((a) => a.payingUserId === currentUser.id);
  const canRecord = payerArrangements.some((a) => a.status === 'Active');
  const counterpartyHeading = view === 'PAYING' ? 'Paid to' : 'Received from';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            {formatMonthYear(month)}
            {view === 'PAYING' && ' · Your contributions as paying parent'}
            {view === 'RECEIVING' && ' · Contributions you receive as caregiver'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {view === 'PAYING' && (
            <button
              type="button"
              onClick={() => setRecordOpen(true)}
              disabled={!canRecord}
              className="inline-flex items-center gap-1.5 rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] disabled:opacity-50 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Record Payment</span>
            </button>
          )}
          {view === 'RECEIVING' && (
            <Link
              to="/parent/payments"
              className="inline-flex items-center gap-1.5 rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] whitespace-nowrap"
            >
              <span>Review payments</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <Link
            to="/parent/history"
            className="inline-flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-[#0F2942] hover:bg-slate-50 whitespace-nowrap"
          >
            <span>Payment history</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <WelcomeBanner
        title={view === 'PAYING' ? 'Supporting your child' : 'Caring for your child'}
        image={view === 'PAYING' ? IMAGES.familySupport : IMAGES.parentAndChild}
        imagePosition="center 30%"
      >
        {view === 'PAYING'
          ? 'Keep clear, confirmed records of the maintenance you contribute.'
          : 'Keep track of the maintenance contributions made for your child.'}
      </WelcomeBanner>

      {toast && <ToastBanner type="success" message={toast} onDismiss={() => setToast('')} />}
      {maintenanceError && (
        <ToastBanner type="error" message={maintenanceError} onDismiss={() => undefined} />
      )}

      {isPayer && isReceiver && (
        <div
          role="tablist"
          aria-label="Choose which responsibility to view"
          className="inline-flex rounded-sm border border-slate-300 bg-white p-0.5 text-sm"
        >
          {(
            [
              ['PAYING', 'As paying parent'],
              ['RECEIVING', 'As receiving caregiver'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setSelectedView(key)}
              className={`rounded-sm px-3.5 py-1.5 font-medium whitespace-nowrap ${
                view === key ? 'bg-[#0F2942] text-white' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {view === 'RECEIVING' && awaitingMyConfirmation.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-sky-700/30 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <div>
            <span className="font-semibold">Action required:</span> You have{' '}
            <span className="font-mono font-semibold">{awaitingMyConfirmation.length}</span> recorded{' '}
            {awaitingMyConfirmation.length === 1 ? 'payment' : 'payments'} awaiting your confirmation.
          </div>
          <Link
            to="/parent/payments"
            className="rounded-sm bg-[#0F2942] px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
          >
            Confirm or dispute
          </Link>
        </div>
      )}

      {view === 'PAYING' && summary && summary.disputed.count > 0 && (
        <div className="rounded-sm border border-red-700/30 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span className="font-semibold">Payment disputed:</span>{' '}
          {summary.disputed.count} {summary.disputed.count === 1 ? 'payment' : 'payments'} (
          {formatZAR(summary.disputed.amount)}) disputed by the receiving parent. Open the payment
          history to see the reason.
        </div>
      )}

      {view === 'PAYING' && summary && summary.awaitingConfirmation.count > 0 && (
        <div className="rounded-sm border border-sky-700/30 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          {summary.awaitingConfirmation.count}{' '}
          {summary.awaitingConfirmation.count === 1 ? 'payment is' : 'payments are'} waiting for the
          receiving parent to confirm ({formatZAR(summary.awaitingConfirmation.amount)}). Confirmed
          amounts are what count towards your contribution.
        </div>
      )}

      {view === null && (
        <EmptyState
          title={maintenanceLoading ? 'Loading your arrangements…' : 'No maintenance arrangements yet'}
          description={
            maintenanceLoading
              ? 'Fetching your arrangements and payments.'
              : 'Whether you pay or receive depends on the maintenance arrangements you share with an approved family member of a child. Create one to get started.'
          }
        />
      )}

      {view === 'PAYING' && summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Expected maintenance (you pay)"
            value={formatZAR(summary.expectedAmount)}
            helper={`${activeArrangements.length} active arrangement${activeArrangements.length === 1 ? '' : 's'}`}
          />
          <SummaryCard
            label="Amount paid"
            value={formatZAR(summary.paidAmount)}
            helper="Recorded by you this month"
          />
          <SummaryCard
            label="Confirmed by recipient"
            value={formatZAR(summary.confirmedAmount)}
            helper={
              summary.awaitingConfirmation.count > 0
                ? `${formatZAR(summary.awaitingConfirmation.amount)} still awaiting confirmation`
                : 'Accepted as received'
            }
            tone="green"
          />
          <SummaryCard
            label="Outstanding contribution"
            value={formatZAR(summary.outstandingAmount)}
            helper="Expected minus confirmed payments"
            tone={summary.outstandingAmount > 0 ? 'amber' : 'green'}
          />
        </div>
      )}

      {view === 'RECEIVING' && summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Expected maintenance (you receive)"
            value={formatZAR(summary.expectedAmount)}
            helper={`${activeArrangements.length} active arrangement${activeArrangements.length === 1 ? '' : 's'}`}
          />
          <SummaryCard
            label="Amount received"
            value={formatZAR(summary.confirmedAmount)}
            helper="Payments you have confirmed"
            tone="green"
          />
          <SummaryCard
            label="Outstanding to receive"
            value={formatZAR(summary.outstandingAmount)}
            helper="Expected minus amounts you confirmed"
            tone={summary.outstandingAmount > 0 ? 'amber' : 'green'}
          />
          <SummaryCard
            label="Awaiting your confirmation"
            value={String(awaitingMyConfirmation.length)}
            helper={`${formatZAR(summary.awaitingConfirmation.amount)} recorded by the paying parent`}
            tone={awaitingMyConfirmation.length > 0 ? 'amber' : 'default'}
          />
        </div>
      )}

      {view !== null && (
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
                description={
                  view === 'PAYING'
                    ? 'Record a maintenance payment to begin tracking your contribution history.'
                    : 'Payments recorded by the paying parent will appear here for you to confirm.'
                }
                actionLabel={view === 'PAYING' && canRecord ? 'Record Payment' : undefined}
                onAction={view === 'PAYING' && canRecord ? () => setRecordOpen(true) : undefined}
              />
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Child</th>
                    <th className="py-2 pr-3">{counterpartyHeading}</th>
                    <th className="py-2 pr-3 text-right">Amount</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPayments.map((p) => {
                    const child = db.children.find((c) => c.id === p.childId);
                    const counterparty = db.users.find(
                      (u) => u.id === (view === 'PAYING' ? p.receivingUserId : p.payingUserId)
                    );
                    const canConfirm = isAwaitingMyConfirmation(p, currentUser.id);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-3 text-xs text-slate-700 whitespace-nowrap">
                          {formatSADateShort(p.paymentDate)}
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-[#0F2942] whitespace-nowrap">
                          {child ? `${child.firstName} ${child.lastName}` : '—'}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-slate-700 whitespace-nowrap">
                          {counterparty?.fullName ?? '—'}
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
            <p className="text-xs text-slate-500">
              Last three months ·{' '}
              {view === 'PAYING' ? 'arrangements where you pay' : 'arrangements where you receive'}
            </p>
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
      )}

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

          {viewArrangements.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No maintenance arrangements found. Create one to start tracking expected monthly
              payments.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {viewArrangements.map((arr) => {
                const child = db.children.find((c) => c.id === arr.childId);
                const iPay = arr.payingUserId === currentUser.id;
                const other = db.users.find((u) => u.id === (iPay ? arr.receivingUserId : arr.payingUserId));
                return (
                  <div key={arr.id} className="py-3 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#0F2942]">
                        {child ? `${child.firstName} ${child.lastName}` : 'Child'}
                      </p>
                      <p className="text-xs text-slate-600">
                        {iPay ? 'You pay' : 'You receive from'} {other?.fullName ?? 'a family member'} ·{' '}
                        {arr.frequency}
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
                      <p className="text-xs text-slate-600">
                        Social worker:{' '}
                        <span className="font-medium text-slate-800">
                          {child.socialWorker?.fullName ?? 'Not assigned yet'}
                        </span>
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
        arrangements={payerArrangements}
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
