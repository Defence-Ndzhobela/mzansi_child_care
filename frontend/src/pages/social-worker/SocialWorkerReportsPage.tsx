import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useSocialWorkerScope } from '../../hooks/useFamilyScope';
import { exportToCSV, formatSADate, formatSADateShort, formatZAR } from '../../utils/format';
import { PaymentStatusBadge } from '../../components/StatusBadge';
import { SummaryCard } from '../../components/SummaryCard';
import { ToastBanner } from '../../components/ToastBanner';

export function SocialWorkerReportsPage() {
  const { currentUser } = useAuth();
  const { db } = useData();
  const { children, arrangements, payments, notes } = useSocialWorkerScope();

  const [selectedChildId, setSelectedChildId] = useState<string>('ALL');
  const [toast, setToast] = useState('');

  const scopedPayments = useMemo(() => {
    if (selectedChildId === 'ALL') return payments;
    return payments.filter((p) => p.childId === selectedChildId);
  }, [payments, selectedChildId]);

  const scopedNotes = useMemo(() => {
    if (selectedChildId === 'ALL') return notes;
    return notes.filter((n) => n.childId === selectedChildId);
  }, [notes, selectedChildId]);

  const summary = useMemo(() => {
    const confirmed = scopedPayments
      .filter((p) => p.status === 'Confirmed by recipient')
      .reduce((s, p) => s + (p.confirmedAmount ?? p.amount), 0);
    const partial = scopedPayments
      .filter((p) => p.status === 'Partially confirmed')
      .reduce((s, p) => s + (p.confirmedAmount ?? 0), 0);
    const awaiting = scopedPayments
      .filter((p) => p.status === 'Awaiting confirmation' || p.status === 'Submitted')
      .reduce((s, p) => s + p.amount, 0);
    const disputed = scopedPayments
      .filter((p) => p.status === 'Disputed')
      .reduce((s, p) => s + p.amount, 0);

    return { confirmed, partial, awaiting, disputed };
  }, [scopedPayments]);

  if (!currentUser) return null;

  const selectedChild =
    selectedChildId === 'ALL' ? null : children.find((c) => c.id === selectedChildId) ?? null;

  const handleExportCSV = () => {
    const headers = [
      'Child',
      'Payment Date',
      'Paying Parent',
      'Receiving Caregiver',
      'Submitted (ZAR)',
      'Confirmed (ZAR)',
      'Status',
      'Reference',
    ];
    const rows = scopedPayments.map((p) => {
      const child = db.children.find((c) => c.id === p.childId);
      const payer = db.users.find((u) => u.id === p.payingUserId);
      const receiver = db.users.find((u) => u.id === p.receivingUserId);
      return [
        child ? `${child.firstName} ${child.lastName}` : '',
        p.paymentDate,
        payer?.fullName ?? '',
        receiver?.fullName ?? '',
        p.amount.toFixed(2),
        p.confirmedAmount !== undefined ? p.confirmedAmount.toFixed(2) : '0.00',
        p.status,
        p.paymentReference,
      ];
    });
    exportToCSV(`mzansi_childcare_sw_summary_${selectedChildId}.csv`, headers, rows);
    setToast('Family payment summary exported to CSV.');
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Payment Reports</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter summary by assigned child"
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
          >
            <option value="ALL">All Assigned Cases ({children.length})</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={scopedPayments.length === 0}
            className="inline-flex items-center gap-1.5 rounded-sm border border-[#0F2942] bg-white px-3.5 py-2 text-sm font-medium text-[#0F2942] hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-sm bg-[#0F2942] px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            <span>Print Summary</span>
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
                Social Worker Case Payment Summary
              </h2>
              <p className="text-xs text-slate-600">
                Social Worker: {currentUser.fullName} · Scope:{' '}
                {selectedChild
                  ? `${selectedChild.firstName} ${selectedChild.lastName}`
                  : 'All Assigned Families'}
              </p>
            </div>
            <p className="text-xs text-slate-500">Date: {formatSADate('2026-11-12')}</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Confirmed by Recipient"
              value={formatZAR(summary.confirmed)}
              tone="green"
            />
            <SummaryCard
              label="Partially Confirmed"
              value={formatZAR(summary.partial)}
              tone="amber"
            />
            <SummaryCard
              label="Submitted / Awaiting"
              value={formatZAR(summary.awaiting)}
            />
            <SummaryCard
              label="Disputed"
              value={formatZAR(summary.disputed)}
            />
          </div>
        </div>

        <div className="border border-slate-200 bg-white p-5 rounded-sm">
          <h3 className="font-display text-base font-semibold text-[#0F2942]">
            Active Arrangements &amp; Payment Records ({scopedPayments.length})
          </h3>
          {selectedChild && (
            <div className="mt-2 text-xs text-slate-600">
              {arrangements
                .filter((a) => a.childId === selectedChild.id)
                .map((a) => (
                  <p key={a.id}>
                    Expected contribution: {formatZAR(a.expectedAmount)} ({a.frequency}) · Status:{' '}
                    {a.status}
                  </p>
                ))}
            </div>
          )}

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
                {scopedPayments.map((p) => {
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
        </div>

        <div className="border border-slate-200 bg-white p-5 rounded-sm">
          <h3 className="font-display text-base font-semibold text-[#0F2942]">
            Recorded Professional Notes ({scopedNotes.length})
          </h3>
          {scopedNotes.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No professional notes in this selection.</p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {scopedNotes.map((n) => {
                const child = db.children.find((c) => c.id === n.childId);
                return (
                  <div key={n.id} className="border border-slate-200 bg-slate-50 p-3 rounded-sm">
                    <p className="text-xs font-semibold text-[#0F2942]">
                      {child ? `${child.firstName} ${child.lastName}` : 'Case'} ·{' '}
                      <span className="font-normal text-slate-500">
                        {formatSADate(n.createdAt)}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-slate-800">{n.note}</p>
                  </div>
                );
              })}
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
