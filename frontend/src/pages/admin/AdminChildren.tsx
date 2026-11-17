import { useState } from 'react';
import { adminApi } from '../../services/adminApi';
import { useAdminDetail } from '../../hooks/useAdminDetail';
import { useAdminList } from '../../hooks/useAdminList';
import { calculateAge, formatSADate, formatSADateShort } from '../../utils/format';
import { ArrangementTable } from '../../components/admin/ArrangementTable';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { FamilyManager } from '../../components/admin/FamilyManager';
import { AdminChildDetail } from '../../types/admin';
import { ListFrame, TABLE_HEAD, TD, TH } from '../../components/admin/ListFrame';
import { Pagination } from '../../components/admin/Pagination';
import { StatusPill } from '../../components/admin/StatusPill';
import { Modal } from '../../components/Modal';

const PAGE_SIZE = 10;

export function AdminChildren() {
  const list = useAdminList(adminApi.listChildren, {}, PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const detail = useAdminDetail(openId, adminApi.getChild);
  const [updated, setUpdated] = useState<AdminChildDetail | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const child = updated && updated.id === openId ? updated : detail.data;
  const data = list.data;

  const closeDetail = () => {
    setOpenId(null);
    setUpdated(null);
  };

  const handleChanged = (next: AdminChildDetail) => {
    setUpdated(next);
    list.reload();
  };

  const archiveFamily = async () => {
    if (!openId) return;
    setArchiveBusy(true);
    setArchiveError(null);
    try {
      await adminApi.archiveFamily(openId);
      setArchiving(false);
      closeDetail();
      list.reload();
    } catch (failure) {
      setArchiveError(failure instanceof Error ? failure.message : 'The family could not be archived.');
    } finally {
      setArchiveBusy(false);
    }
  };

  return (
    <>
      <ListFrame
        title="Children"
        description="Registered children, their families and assigned social workers."
        searchValue={list.searchInput}
        onSearch={list.setSearchInput}
        searchPlaceholder="Search child, parent name or parent email"
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        isEmpty={list.items.length === 0}
        emptyTitle="No children found"
        emptyDescription={list.searchInput ? 'No child matches this search.' : 'Children appear once parents register them.'}
        footer={data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={list.setPage} />}
      >
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className={TABLE_HEAD}>
            <tr>
              <th className={TH}>Child</th>
              <th className={TH}>Date of birth</th>
              <th className={`${TH} text-right`}>Linked parents</th>
              <th className={`${TH} text-right`}>Arrangements</th>
              <th className={TH}>Social worker</th>
              <th className={TH}>Registered</th>
              <th className={`${TH} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {list.items.map((child) => (
              <tr key={child.id} className="hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#0F2942]">{child.fullName}</td>
                <td className={`${TD} whitespace-nowrap`}>{formatSADateShort(child.dateOfBirth)} ({calculateAge(child.dateOfBirth)} yrs)</td>
                <td className={`${TD} text-right tabular-nums`}>{child.parents}</td>
                <td className={`${TD} text-right tabular-nums`}>{child.arrangements}</td>
                <td className={`${TD} whitespace-nowrap`}>
                  {child.socialWorker ? child.socialWorker.fullName : <span className="text-xs font-medium text-amber-800">Not assigned</span>}
                </td>
                <td className={`${TD} whitespace-nowrap`}>{formatSADateShort(child.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button type="button" onClick={() => setOpenId(child.id)} className="text-xs font-medium text-[#006847] hover:underline">
                    View details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>

      <Modal isOpen={Boolean(openId)} onClose={closeDetail} title={child?.fullName ?? 'Child'} subtitle={child ? `Born ${formatSADate(child.dateOfBirth)}` : undefined} maxWidth="2xl">
        {detail.loading && <p role="status" className="py-6 text-center text-sm text-slate-600">Loadingâ€¦</p>}
        {detail.error && <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{detail.error}</p>}
        {child && (
          <div className="space-y-6">
            <FamilyManager child={child} onChanged={handleChanged} onArchive={() => { setArchiveError(null); setArchiving(true); }} />

            <section>
              <h3 className="mb-2 text-sm font-semibold text-[#0F2942]">Social worker</h3>
              <p className="text-sm text-slate-700">
                {child.currentAssignment
                  ? <>Currently <strong>{child.currentAssignment.socialWorker.fullName}</strong>, assigned {formatSADate(child.currentAssignment.assignedAt)} by {child.currentAssignment.assignedBy.fullName}.</>
                  : 'No social worker is currently assigned.'}
              </p>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-[#0F2942]">Maintenance arrangements</h3>
              <ArrangementTable arrangements={child.arrangements} />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-[#0F2942]">Assignment history ({child.assignmentHistory.length})</h3>
              {child.assignmentHistory.length === 0 ? (
                <p className="text-sm text-slate-600">No assignments yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-sm border border-slate-200">
                  {child.assignmentHistory.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-[#0F2942]">{item.socialWorker.fullName}</span>
                        <StatusPill status={item.status} />
                      </span>
                      <span className="text-xs text-slate-600">
                        {formatSADateShort(item.assignedAt)}{item.endedAt ? ` â€“ ${formatSADateShort(item.endedAt)}` : ' â€“ now'} Â· by {item.assignedBy.fullName}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={archiving}
        title="Archive family"
        tone="danger"
        confirmLabel="Archive family"
        busy={archiveBusy}
        error={archiveError ?? undefined}
        message={child && (
          <>Archive <strong>{child.fullName}</strong>'s family? All parent and caregiver links will be removed, the social worker
          assignment will be closed and active arrangements cancelled. Parent accounts, payment history, evidence, confirmations and
          professional records are kept.</>
        )}
        onConfirm={() => void archiveFamily()}
        onCancel={() => setArchiving(false)}
      />
    </>
  );
}
