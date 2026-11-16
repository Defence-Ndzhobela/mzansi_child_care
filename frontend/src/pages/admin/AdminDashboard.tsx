import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/adminApi';
import { AdminStats } from '../../types/admin';
import { SummaryCard } from '../../components/SummaryCard';

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setError(null);
    adminApi
      .stats()
      .then((result) => {
        if (active) setStats(result);
      })
      .catch((failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : 'Unable to load the statistics.');
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const value = (number: number | undefined) => (stats ? number ?? 0 : '…');

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-display text-2xl font-bold text-[#0F2942]">Administrator Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Live figures from the Mzansi ChildCare database.</p>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-sm border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total registered users" value={value(stats?.totalUsers)} helper="Parents, caregivers and social workers" />
        <SummaryCard
          label="Social workers"
          value={value(stats?.socialWorkers)}
          helper={stats ? `${stats.activeSocialWorkers} active` : undefined}
        />
        <SummaryCard label="Child supporters" value={value(stats?.childSupporters)} helper="Paying parents" />
        <SummaryCard label="Registered children" value={value(stats?.children)} />
        <SummaryCard label="Active social worker assignments" value={value(stats?.activeAssignments)} tone="green" />
        <SummaryCard label="Active maintenance arrangements" value={value(stats?.activeArrangements)} tone="green" />
        <SummaryCard label="Pending payments" value={value(stats?.pendingPayments)} helper="Submitted or awaiting confirmation" tone="amber" />
        <SummaryCard
          label="Completed payments"
          value={value(stats?.completedPayments)}
          helper="Confirmed or partially confirmed by the recipient"
          tone="green"
        />
      </div>

      {stats && stats.childrenWithoutWorker > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span>
            <span className="font-semibold">{stats.childrenWithoutWorker}</span>{' '}
            {stats.childrenWithoutWorker === 1 ? 'child has' : 'children have'} no social worker assigned.
          </span>
          <Link
            to="/admin/assignments"
            className="rounded-sm bg-[#0F2942] px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
          >
            Assign a social worker
          </Link>
        </div>
      )}

      {stats && stats.disputedPayments > 0 && (
        <p className="text-sm text-slate-600">
          {stats.disputedPayments} disputed {stats.disputedPayments === 1 ? 'payment is' : 'payments are'} not counted above.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ['/admin/social-workers', 'Manage social workers', 'Add, edit and deactivate accounts'],
          ['/admin/assignments', 'Social worker assignments', 'Assign, reassign and end cases'],
          ['/admin/reports', 'Reports', 'Caseloads, arrangements and payments'],
        ].map(([to, title, text]) => (
          <Link key={to} to={to} className="rounded-sm border border-slate-200 bg-white p-4 hover:bg-slate-50">
            <p className="text-sm font-semibold text-[#0F2942]">{title}</p>
            <p className="mt-1 text-xs text-slate-600">{text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
