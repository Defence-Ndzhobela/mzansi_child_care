import { useState } from 'react';
import { adminApi } from '../../services/adminApi';
import { useAdminDetail } from '../../hooks/useAdminDetail';
import { useAdminList } from '../../hooks/useAdminList';
import { formatSADate, formatZAR } from '../../utils/format';
import { ArrangementTable } from '../../components/admin/ArrangementTable';
import { ListFrame, TABLE_HEAD, TD, TH } from '../../components/admin/ListFrame';
import { Pagination } from '../../components/admin/Pagination';
import { StatusPill } from '../../components/admin/StatusPill';
import { Modal } from '../../components/Modal';

const PAGE_SIZE = 10;

export function AdminChildSupporters() {
  const list = useAdminList(adminApi.listChildSupporters, {}, PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const detail = useAdminDetail(openId, adminApi.getChildSupporter);
  const data = list.data;

  return (
    <>
      <ListFrame
        title="Child Supporters"
        description="Parents who pay maintenance, or are linked to a child as the paying parent."
        searchValue={list.searchInput}
        onSearch={list.setSearchInput}
        searchPlaceholder="Search name or email"
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        isEmpty={list.items.length === 0}
        emptyTitle="No child supporters found"
        emptyDescription={list.searchInput ? 'No child supporter matches this search.' : 'Child supporters appear once a parent pays in an arrangement.'}
        footer={data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={list.setPage} />}
      >
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className={TABLE_HEAD}>
            <tr>
              <th className={TH}>Name</th>
              <th className={TH}>Email</th>
              <th className={TH}>Phone</th>
              <th className={`${TH} text-right`}>Children</th>
              <th className={`${TH} text-right`}>Arrangements</th>
              <th className={`${TH} text-right`}>Expected per month</th>
              <th className={TH}>Status</th>
              <th className={`${TH} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {list.items.map((supporter) => (
              <tr key={supporter.id} className="hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#0F2942]">{supporter.fullName}</td>
                <td className={TD}>{supporter.email}</td>
                <td className={`${TD} whitespace-nowrap`}>{supporter.phone || '—'}</td>
                <td className={`${TD} text-right tabular-nums`}>{supporter.children}</td>
                <td className={`${TD} text-right tabular-nums`}>{supporter.arrangements}</td>
                <td className={`${TD} text-right font-mono tabular-nums whitespace-nowrap`}>{formatZAR(supporter.monthlyExpectedAmount)}</td>
                <td className="px-4 py-3"><StatusPill status={supporter.accountStatus} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button type="button" onClick={() => setOpenId(supporter.id)} className="text-xs font-medium text-[#006847] hover:underline">
                    View profile
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>

      <Modal isOpen={Boolean(openId)} onClose={() => setOpenId(null)} title={detail.data?.fullName ?? 'Child supporter'} subtitle={detail.data?.email} maxWidth="2xl">
        {detail.loading && <p role="status" className="py-6 text-center text-sm text-slate-600">Loading…</p>}
        {detail.error && <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{detail.error}</p>}
        {detail.data && (
          <div className="space-y-6">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-slate-500">Phone</dt><dd className="text-slate-800">{detail.data.phone || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Status</dt><dd><StatusPill status={detail.data.accountStatus} /></dd></div>
              <div><dt className="text-xs text-slate-500">Registered</dt><dd className="text-slate-800">{formatSADate(detail.data.createdAt)}</dd></div>
            </dl>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-[#0F2942]">Children ({detail.data.children.length})</h3>
              {detail.data.children.length === 0 ? (
                <p className="text-sm text-slate-600">No children.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-sm border border-slate-200">
                  {detail.data.children.map((child) => (
                    <li key={child.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <span className="font-medium text-[#0F2942]">{child.fullName}</span>
                      <span className="text-xs text-slate-600">
                        {child.relationship} · Social worker: {child.socialWorker ?? 'not assigned'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-[#0F2942]">Maintenance arrangements as paying parent ({detail.data.arrangements.length})</h3>
              <ArrangementTable arrangements={detail.data.arrangements} />
            </section>
          </div>
        )}
      </Modal>
    </>
  );
}
