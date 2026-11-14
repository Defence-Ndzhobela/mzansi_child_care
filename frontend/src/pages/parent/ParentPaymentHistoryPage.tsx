import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useParentScope } from '../../hooks/useFamilyScope';
import { Payment, PaymentStatus } from '../../types';
import { exportToCSV, formatSADateShort, formatZAR } from '../../utils/format';
import { ConfirmDisputeModal } from '../../components/ConfirmDisputeModal';
import { EmptyState } from '../../components/EmptyState';
import { PaymentDetailModal } from '../../components/PaymentDetailModal';
import { PaymentStatusBadge } from '../../components/StatusBadge';
import { ToastBanner } from '../../components/ToastBanner';

const STATUS_FILTERS: ('All' | PaymentStatus)[] = [
  'All',
  'Submitted',
  'Awaiting confirmation',
  'Confirmed by recipient',
  'Partially confirmed',
  'Disputed',
];

export function ParentPaymentHistoryPage() {
  const { currentUser } = useAuth();
  const { db } = useData();
  const { payments } = useParentScope();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | PaymentStatus>('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Payment | null>(null);
  const [toast, setToast] = useState('');

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (fromDate && p.paymentDate < fromDate) return false;
      if (toDate && p.paymentDate > toDate) return false;
      if (!q) return true;

      const child = db.children.find((c) => c.id === p.childId);
      const payer = db.users.find((u) => u.id === p.payingUserId);
      const receiver = db.users.find((u) => u.id === p.receivingUserId);

      const haystack = [
        child ? `${child.firstName} ${child.lastName}` : '',
        payer?.fullName ?? '',
        receiver?.fullName ?? '',
        p.paymentReference,
        p.paymentMethod,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [payments, search, statusFilter, fromDate, toDate, db.children, db.users]);

  if (!currentUser) return null;

  const handleExportCSV = () => {
    const headers = [
      'Payment Date',
      'Child',
      'Paying Parent',
      'Receiving Parent',
      'Amount (ZAR)',
      'Confirmed Amount (ZAR)',
      'Payment Method',
      'Reference',
      'Status',
    ];
    const rows = filteredPayments.map((p) => {
      const child = db.children.find((c) => c.id === p.childId);
      const payer = db.users.find((u) => u.id === p.payingUserId);
      const receiver = db.users.find((u) => u.id === p.receivingUserId);
      return [
        p.paymentDate,
        child ? `${child.firstName} ${child.lastName}` : '',
        payer?.fullName ?? '',
        receiver?.fullName ?? '',
        p.amount.toFixed(2),
        p.confirmedAmount !== undefined ? p.confirmedAmount.toFixed(2) : '',
        p.paymentMethod,
        p.paymentReference,
        p.status,
      ];
    });
    exportToCSV('mzansi_childcare_payment_history.csv', headers, rows);
    setToast('Exported filtered payment history to CSV.');
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Payment History</h1>
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={filteredPayments.length === 0}
          className="inline-flex items-center gap-1.5 rounded-sm border border-[#0F2942] bg-white px-4 py-2 text-sm font-medium text-[#0F2942] hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {toast && <ToastBanner type="success" message={toast} onDismiss={() => setToast('')} />}

      <div className="border border-slate-200 bg-white p-4 rounded-sm space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label htmlFor="hist-search" className="block text-xs font-medium text-slate-700">
              Search Child, Parent, or Reference
            </label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="hist-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. Thabo Mokoena, EFT-NOV..."
                className="block w-full rounded-sm border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="hist-from" className="block text-xs font-medium text-slate-700">
              From Date
            </label>
            <input
              id="hist-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="hist-to" className="block text-xs font-medium text-slate-700">
              To Date
            </label>
            <input
              id="hist-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-[#0F2942] text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {(search || statusFilter !== 'All' || fromDate || toDate) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-medium text-[#006847] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filteredPayments.length === 0 ? (
        <EmptyState
          title="No matching payment records"
          description="Try adjusting your search term, date range, or status filter."
          actionLabel="Clear Filters"
          onAction={resetFilters}
        />
      ) : (
        <div className="overflow-x-auto border border-slate-200 bg-white rounded-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Payment Date</th>
                <th className="px-4 py-3">Child</th>
                <th className="px-4 py-3">Paying Parent</th>
                <th className="px-4 py-3">Receiving Parent</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPayments.map((p) => {
                const child = db.children.find((c) => c.id === p.childId);
                const payer = db.users.find((u) => u.id === p.payingUserId);
                const receiver = db.users.find((u) => u.id === p.receivingUserId);
                const canConfirm =
                  p.receivingUserId === currentUser.id &&
                  (p.status === 'Awaiting confirmation' || p.status === 'Submitted');

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                      {formatSADateShort(p.paymentDate)}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#0F2942] whitespace-nowrap">
                      {child ? `${child.firstName} ${child.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {payer?.fullName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {receiver?.fullName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      <div>{formatZAR(p.amount)}</div>
                      {p.status === 'Partially confirmed' && p.confirmedAmount !== undefined && (
                        <div className="text-[11px] text-amber-800">
                          Confirmed: {formatZAR(p.confirmedAmount)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                      {p.paymentMethod}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
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
