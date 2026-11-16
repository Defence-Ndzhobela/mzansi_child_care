import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/adminApi';
import { useAdminDetail } from '../../hooks/useAdminDetail';
import { useAdminList } from '../../hooks/useAdminList';
import { formatSADate, formatSADateShort, formatZAR } from '../../utils/format';
import { FILTER_SELECT, ListFrame, TABLE_HEAD, TD, TH } from '../../components/admin/ListFrame';
import { Pagination } from '../../components/admin/Pagination';
import { StatusPill } from '../../components/admin/StatusPill';
import { Modal } from '../../components/Modal';

const PAGE_SIZE = 10;

export function AdminArrangements() {
  const [statusFilter, setStatusFilter] = useState('');
  const list = useAdminList(adminApi.listArrangements, statusFilter ? { status: statusFilter } : {}, PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const detail = useAdminDetail(openId, adminApi.getArrangement);
  const data = list.data;
  const arrangement = detail.data;

  return (
    <>
      <ListFrame
        title="Maintenance Arrangements"
        description="Read-only view of every arrangement. Assigning a social worker never changes amounts or payments."
        searchValue={list.searchInput}
        onSearch={list.setSearchInput}
        searchPlaceholder="Search child, paying or receiving parent"
        filters={
          <select aria-label="Filter by arrangement status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={FILTER_SELECT}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        }
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        isEmpty={list.items.length === 0}
        emptyTitle="No maintenance arrangements found"
        emptyDescription={list.searchInput || statusFilter ? 'No arrangement matches this search or filter.' : 'Arrangements appear once parents create them.'}
        footer={data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={list.setPage} />}
      >
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className={TABLE_HEAD}>
            <tr>
              <th className={TH}>Child</th>
              <th className={TH}>Paying parent</th>
              <th className={TH}>Receiving parent</th>
              <th className={`${TH} text-right`}>Expected</th>
              <th className={TH}>Frequency</th>
              <th className={TH}>Start</th>
              <th className={TH}>End</th>
              <th className={TH}>Status</th>
              <th className={TH}>Social worker</th>
              <th className={`${TH} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {list.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#0F2942]">{item.childName}</td>
                <td className={`${TD} whitespace-nowrap`}>{item.payingParent.fullName}</td>
                <td className={`${TD} whitespace-nowrap`}>{item.receivingParent.fullName}</td>
                <td className={`${TD} text-right font-mono tabular-nums whitespace-nowrap`}>{item.currency} {formatZAR(item.expectedAmount).replace('R ', '')}</td>
                <td className={TD}>{item.frequency}</td>
                <td className={`${TD} whitespace-nowrap`}>{formatSADateShort(item.startDate)}</td>
                <td className={`${TD} whitespace-nowrap`}>{item.endDate ? formatSADateShort(item.endDate) : '—'}</td>
                <td className="px-4 py-3"><StatusPill status={item.status} /></td>
                <td className={`${TD} whitespace-nowrap`}>{item.socialWorker?.fullName ?? <span className="text-xs font-medium text-amber-800">Not assigned</span>}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-3">
                    <button type="button" onClick={() => setOpenId(item.id)} className="text-xs font-medium text-[#0F2942] hover:underline">Details</button>
                    <Link to={`/admin/assignments?childId=${item.childId}&arrangementId=${item.id}`} className="text-xs font-medium text-[#006847] hover:underline">Assign</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>

      <Modal isOpen={Boolean(openId)} onClose={() => setOpenId(null)} title={arrangement ? `${arrangement.childName} — maintenance arrangement` : 'Maintenance arrangement'} maxWidth="xl">
        {detail.loading && <p role="status" className="py-6 text-center text-sm text-slate-600">Loading…</p>}
        {detail.error && <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{detail.error}</p>}
        {arrangement && (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Paying parent</dt><dd className="text-slate-800">{arrangement.payingParent.fullName}</dd></div>
              <div><dt className="text-xs text-slate-500">Receiving parent</dt><dd className="text-slate-800">{arrangement.receivingParent.fullName}</dd></div>
              <div><dt className="text-xs text-slate-500">Expected amount</dt><dd className="font-mono text-slate-800">{arrangement.currency} {formatZAR(arrangement.expectedAmount).replace('R ', '')} · {arrangement.frequency}</dd></div>
              <div><dt className="text-xs text-slate-500">Status</dt><dd><StatusPill status={arrangement.status} /></dd></div>
              <div><dt className="text-xs text-slate-500">Start date</dt><dd className="text-slate-800">{formatSADate(arrangement.startDate)}</dd></div>
              <div><dt className="text-xs text-slate-500">End date</dt><dd className="text-slate-800">{arrangement.endDate ? formatSADate(arrangement.endDate) : 'Open-ended'}</dd></div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Social worker</dt>
                <dd className="text-slate-800">
                  {arrangement.socialWorker
                    ? <>{arrangement.socialWorker.fullName}{arrangement.assignedThisArrangement ? ' (assigned through this arrangement)' : ' (assigned to the child)'}</>
                    : 'Not assigned'}
                </dd>
              </div>
              {arrangement.notes && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Notes</dt><dd className="text-slate-800">{arrangement.notes}</dd></div>}
            </dl>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-[#0F2942]">Payments (read-only summary)</h3>
              {arrangement.paymentSummary.length === 0 ? (
                <p className="text-sm text-slate-600">No payments recorded.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-sm border border-slate-200">
                  {arrangement.paymentSummary.map((row) => (
                    <li key={row.status} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-slate-700">{row.status}</span>
                      <span className="font-mono text-xs text-slate-600">{row.payments} · {formatZAR(row.totalAmount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="flex justify-end border-t border-slate-200 pt-4">
              <Link to={`/admin/assignments?childId=${arrangement.childId}&arrangementId=${arrangement.id}`} className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238]">
                Go to social worker assignment
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
