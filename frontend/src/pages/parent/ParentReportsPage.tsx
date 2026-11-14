import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { CURRENT_DEMO_MONTH, useParentScope } from '../../hooks/useFamilyScope';
import {
  exportToCSV,
  formatMonthYear,
  formatSADate,
  formatSADateShort,
  formatZAR,
  getMonthKey,
} from '../../utils/format';
import { PaymentStatusBadge } from '../../components/StatusBadge';
import { SummaryCard } from '../../components/SummaryCard';
import { ToastBanner } from '../../components/ToastBanner';

export function ParentReportsPage() {
  const { currentUser } = useAuth();
  const { db } = useData();
  const { arrangements, payments, expectedMonthly } = useParentScope();

  const availableMonths = useMemo(() => {
    const keys = new Set<string>([CURRENT_DEMO_MONTH]);
    payments.forEach((p) => keys.add(getMonthKey(p.paymentDate)));
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [payments]);

  const [selectedMonth, setSelectedMonth] = useState<string>(CURRENT_DEMO_MONTH);
  const [toast, setToast] = useState('');

  const periodPayments = useMemo(() => {
    if (selectedMonth === 'ALL') return payments;
    return payments.filter((p) => p.paymentDate.startsWith(selectedMonth));
  }, [payments, selectedMonth]);

  const statusBreakdown = useMemo(() => {
    const sumBy = (status: string, useConfirmed = false) =>
      periodPayments
        .filter((p) => p.status === status)
        .reduce((s, p) => s + (useConfirmed ? (p.confirmedAmount ?? 0) : p.amount), 0);

    const confirmedFull = sumBy('Confirmed by recipient', true);
    const partialConfirmed = sumBy('Partially confirmed', true);
    const partialSubmitted = sumBy('Partially confirmed', false);
    const awaiting = sumBy('Awaiting confirmation', false) + sumBy('Submitted', false);
    const disputed = sumBy('Disputed', false);

    return {
      confirmedFull,
      partialConfirmed,
      partialSubmitted,
      awaiting,
      disputed,
      totalConfirmed: confirmedFull + partialConfirmed,
    };
  }, [periodPayments]);

  const perChildRows = useMemo(() => {
    return arrangements
      .filter((a) => a.status === 'Active')
      .map((arr) => {
        const child = db.children.find((c) => c.id === arr.childId);
        const childPayments = periodPayments.filter((p) => p.arrangementId === arr.id);
        const confirmed = childPayments.reduce((sum, p) => {
          if (p.status === 'Confirmed by recipient') return sum + (p.confirmedAmount ?? p.amount);
          if (p.status === 'Partially confirmed') return sum + (p.confirmedAmount ?? 0);
          return sum;
        }, 0);
        const expectedForPeriod =
          selectedMonth === 'ALL'
            ? arr.expectedAmount * Math.max(1, availableMonths.length)
            : arr.expectedAmount;
        const outstanding = Math.max(0, expectedForPeriod - confirmed);
        return {
          arrangementId: arr.id,
          childName: child ? `${child.firstName} ${child.lastName}` : 'Child',
          expected: expectedForPeriod,
          confirmed,
          outstanding,
          count: childPayments.length,
        };
      });
  }, [arrangements, db.children, periodPayments, selectedMonth, availableMonths.length]);

  if (!currentUser) return null;

  const handleExportCSV = () => {
    const headers = [
      'Period',
      'Payment Date',
      'Child',
      'Paying Parent',
      'Receiving Parent',
      'Submitted Amount (ZAR)',
      'Confirmed Amount (ZAR)',
      'Method',
      'Reference',
      'Status',
    ];
    const rows = periodPayments.map((p) => {
      const child = db.children.find((c) => c.id === p.childId);
      const payer = db.users.find((u) => u.id === p.payingUserId);
      const receiver = db.users.find((u) => u.id === p.receivingUserId);
      return [
        selectedMonth === 'ALL' ? 'All Months' : formatMonthYear(selectedMonth),
        p.paymentDate,
        child ? `${child.firstName} ${child.lastName}` : '',
        payer?.fullName ?? '',
        receiver?.fullName ?? '',
        p.amount.toFixed(2),
        p.confirmedAmount !== undefined ? p.confirmedAmount.toFixed(2) : '0.00',
        p.paymentMethod,
        p.paymentReference,
        p.status,
      ];
    });
    exportToCSV(`mzansi_childcare_report_${selectedMonth}.csv`, headers, rows);
    setToast('Monthly payment report exported as CSV.');
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Payment Reports</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Select reporting month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthYear(m)}
              </option>
            ))}
            <option value="ALL">All Recorded Months</option>
          </select>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={periodPayments.length === 0}
            className="inline-flex items-center gap-1.5 rounded-sm border border-[#0F2942] bg-white px-3.5 py-2 text-sm font-medium text-[#0F2942] hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-sm bg-[#0F2942] px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800 whitespace-nowrap"
          >
            <Printer className="h-4 w-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="no-print">
          <ToastBanner type="success" message={toast} onDismiss={() => setToast('')} />
        </div>
      )}

      <div className="print-container space-y-6">
        <div className="border border-slate-200 bg-white p-5 rounded-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0F2942]">
                Mzansi ChildCare — Payment Summary Report
              </h2>
              <p className="text-xs text-slate-600">
                Account Holder: {currentUser.fullName} · Period:{' '}
                {selectedMonth === 'ALL' ? 'All Recorded Months' : formatMonthYear(selectedMonth)}
              </p>
            </div>
            <p className="text-xs text-slate-500">Generated {formatSADate('2026-11-12')}</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Confirmed by Recipient"
              value={formatZAR(statusBreakdown.confirmedFull)}
              tone="green"
            />
            <SummaryCard
              label="Partially Confirmed (Received)"
              value={formatZAR(statusBreakdown.partialConfirmed)}
              helper={`Submitted: ${formatZAR(statusBreakdown.partialSubmitted)}`}
              tone="amber"
            />
            <SummaryCard
              label="Submitted / Awaiting Confirmation"
              value={formatZAR(statusBreakdown.awaiting)}
            />
            <SummaryCard
              label="Disputed Amount"
              value={formatZAR(statusBreakdown.disputed)}
              helper={
                selectedMonth !== 'ALL'
                  ? `Monthly Expected: ${formatZAR(expectedMonthly)}`
                  : undefined
              }
            />
          </div>
        </div>

        <div className="border border-slate-200 bg-white p-5 rounded-sm">
          <h3 className="font-display text-base font-semibold text-[#0F2942]">
            Per-Child Balance Summary
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold text-slate-600">
                  <th className="px-4 py-2.5">Child</th>
                  <th className="px-4 py-2.5 text-right">Expected Contribution</th>
                  <th className="px-4 py-2.5 text-right">Confirmed Received</th>
                  <th className="px-4 py-2.5 text-right">Outstanding Balance</th>
                  <th className="px-4 py-2.5 text-right">Recorded Entries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {perChildRows.map((row) => (
                  <tr key={row.arrangementId}>
                    <td className="px-4 py-3 font-medium text-[#0F2942]">{row.childName}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {formatZAR(row.expected)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[#006847]">
                      {formatZAR(row.confirmed)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#9A6300]">
                      {formatZAR(row.outstanding)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-slate-200 bg-white p-5 rounded-sm">
          <h3 className="font-display text-base font-semibold text-[#0F2942]">
            Itemised Payment Records ({periodPayments.length})
          </h3>
          {periodPayments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              No payments were recorded during this reporting period.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold text-slate-600">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Child</th>
                    <th className="px-4 py-2.5">Reference</th>
                    <th className="px-4 py-2.5 text-right">Submitted</th>
                    <th className="px-4 py-2.5 text-right">Confirmed</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {periodPayments.map((p) => {
                    const child = db.children.find((c) => c.id === p.childId);
                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-2.5 text-xs text-slate-700 whitespace-nowrap">
                          {formatSADateShort(p.paymentDate)}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-[#0F2942]">
                          {child ? `${child.firstName} ${child.lastName}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                          {p.paymentReference}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {formatZAR(p.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#006847]">
                          {p.confirmedAmount !== undefined ? formatZAR(p.confirmedAmount) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <PaymentStatusBadge status={p.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500">
            Based on user-submitted and recipient-confirmed records.
          </p>
        </div>
      </div>
    </div>
  );
}
