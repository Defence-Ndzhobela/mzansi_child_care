import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { AdminReport } from '../../types/admin';
import { exportToCSV, formatSADateShort, formatZAR } from '../../utils/format';
import { StatusPill } from '../../components/admin/StatusPill';
import { TABLE_HEAD, TD, TH } from '../../components/admin/ListFrame';

export function AdminReports() {
  const [report, setReport] = useState<AdminReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setError(null);
    adminApi
      .report()
      .then((result) => {
        if (active) setReport(result);
      })
      .catch((failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : 'Unable to load the report.');
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const exportCaseload = () => {
    if (!report) return;
    exportToCSV(
      'mzansi_childcare_social_worker_caseload.csv',
      ['Social worker', 'Account status', 'Active cases', 'Total cases (all time)'],
      report.caseload.map((row) => [row.fullName, row.accountStatus, row.activeCases, row.totalCases])
    );
  };

  const card = 'rounded-sm border border-slate-200 bg-white p-5';

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Reports</h1>
          <p className="mt-1 text-sm text-slate-600">Caseloads, arrangements and payments across the whole system.</p>
        </div>
        <div className="flex gap-2.5">
          <button type="button" onClick={exportCaseload} disabled={!report} className="inline-flex items-center gap-1.5 rounded-sm border border-[#0F2942] bg-white px-3.5 py-2 text-sm font-medium text-[#0F2942] hover:bg-slate-50 disabled:opacity-50">
            <Download className="h-4 w-4" />
            <span>Export caseload CSV</span>
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-sm bg-[#0F2942] px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800">
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-sm border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="font-semibold underline">Retry</button>
        </div>
      )}
      {!report && !error && <p role="status" className="py-10 text-center text-sm text-slate-600">Loading…</p>}

      {report && (
        <div className="print-container space-y-6">
          <section className={card}>
            <h2 className="font-display text-base font-semibold text-[#0F2942]">Social worker caseload</h2>
            {report.caseload.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No social workers registered yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className={TABLE_HEAD}>
                    <tr>
                      <th className={TH}>Social worker</th>
                      <th className={TH}>Status</th>
                      <th className={`${TH} text-right`}>Active cases</th>
                      <th className={`${TH} text-right`}>Cases all time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {report.caseload.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-medium text-[#0F2942]">{row.fullName}</td>
                        <td className="px-4 py-3"><StatusPill status={row.accountStatus} /></td>
                        <td className={`${TD} text-right tabular-nums`}>{row.activeCases}</td>
                        <td className={`${TD} text-right tabular-nums`}>{row.totalCases}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className={card}>
              <h2 className="font-display text-base font-semibold text-[#0F2942]">Maintenance arrangements by status</h2>
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {report.arrangementsByStatus.length === 0 && <li className="py-2 text-slate-600">No arrangements yet.</li>}
                {report.arrangementsByStatus.map((row) => (
                  <li key={row.status} className="flex items-center justify-between py-2">
                    <span className="text-slate-700">{row.status}</span>
                    <span className="tabular-nums text-slate-900">{row.arrangements}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className={card}>
              <h2 className="font-display text-base font-semibold text-[#0F2942]">Payments by status</h2>
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {report.paymentsByStatus.length === 0 && <li className="py-2 text-slate-600">No payments yet.</li>}
                {report.paymentsByStatus.map((row) => (
                  <li key={row.status} className="flex items-center justify-between py-2">
                    <span className="text-slate-700">{row.status}</span>
                    <span className="font-mono text-xs text-slate-700">{row.payments} · {formatZAR(row.totalAmount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className={card}>
            <h2 className="font-display text-base font-semibold text-[#0F2942]">Children without a social worker ({report.unassignedChildren.length})</h2>
            {report.unassignedChildren.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Every child has an active social worker.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {report.unassignedChildren.map((row) => (
                  <li key={row.id} className="flex items-center justify-between py-2">
                    <span className="font-medium text-[#0F2942]">{row.fullName}</span>
                    <span className="text-xs text-slate-500">Registered {formatSADateShort(row.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">Shows up to 50 children, newest first.</p>
          </section>
        </div>
      )}
    </div>
  );
}
