import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { AdminAssignment, AdminSocialWorker, AdminChildSupporter } from '../../types/admin';
import { useAdminDetail } from '../../hooks/useAdminDetail';
import { useAdminList } from '../../hooks/useAdminList';
import { formatSADate, formatSADateShort, formatZAR } from '../../utils/format';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { FILTER_SELECT, ListFrame, TABLE_HEAD, TD, TH } from '../../components/admin/ListFrame';
import { Pagination } from '../../components/admin/Pagination';
import { StatusPill } from '../../components/admin/StatusPill';
import { Modal } from '../../components/Modal';
import { ToastBanner } from '../../components/ToastBanner';

const PAGE_SIZE = 10;
const selectClass =
  'mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none disabled:bg-slate-50 disabled:text-slate-500';
const ROLE_LABEL: Record<string, string> = { ADMIN: 'Administrator', PARENT_CAREGIVER: 'Parent' };

export function AdminAssignments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  const [workerFilter, setWorkerFilter] = useState('');
  const [workers, setWorkers] = useState<AdminSocialWorker[]>([]);
  const [workersError, setWorkersError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const filters: Record<string, string> = {};
  if (view === 'ACTIVE') filters.status = 'ACTIVE';
  if (workerFilter) filters.socialWorkerId = workerFilter;
  const list = useAdminList(adminApi.listAssignments, filters, PAGE_SIZE);

  // Wizard state: worker -> child supporter -> child -> arrangement -> confirm.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [workerId, setWorkerId] = useState('');
  const [supporterSearch, setSupporterSearch] = useState('');
  const [supporters, setSupporters] = useState<AdminChildSupporter[]>([]);
  const [supporterId, setSupporterId] = useState('');
  const [childId, setChildId] = useState('');
  const [arrangementId, setArrangementId] = useState('');
  const [wizardError, setWizardError] = useState('');
  const [saving, setSaving] = useState(false);
  const [prefill, setPrefill] = useState<{ childId: string; arrangementId: string } | null>(null);

  const [reassigning, setReassigning] = useState<AdminAssignment | null>(null);
  const [newWorkerId, setNewWorkerId] = useState('');
  const [confirmReassign, setConfirmReassign] = useState(false);
  const [ending, setEnding] = useState<AdminAssignment | null>(null);
  const [actionError, setActionError] = useState('');

  const supporter = useAdminDetail(wizardOpen ? supporterId || null : null, adminApi.getChildSupporter);
  const child = useAdminDetail(wizardOpen ? childId || null : null, adminApi.getChild);

  // Active social workers for every dropdown on this page. The server re-checks the choice anyway.
  useEffect(() => {
    let active = true;
    adminApi
      .listSocialWorkers({ pageSize: 100 })
      .then((result) => {
        if (active) setWorkers(result.items);
      })
      .catch((failure: unknown) => {
        if (active) setWorkersError(failure instanceof Error ? failure.message : 'Unable to load social workers.');
      });
    return () => {
      active = false;
    };
  }, []);
  const activeWorkers = workers.filter((worker) => worker.accountStatus === 'ACTIVE');

  // Supporters for step 2, filtered by what the administrator types.
  useEffect(() => {
    if (!wizardOpen) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      adminApi
        .listChildSupporters({ pageSize: 100, search: supporterSearch.trim() })
        .then((result) => {
          if (active) setSupporters(result.items);
        })
        .catch((failure: unknown) => {
          if (active) setWizardError(failure instanceof Error ? failure.message : 'Unable to load child supporters.');
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [wizardOpen, supporterSearch]);

  const openWizard = (preset?: { childId: string; arrangementId: string }) => {
    setWizardOpen(true);
    setWorkerId('');
    setSupporterSearch('');
    setSupporterId('');
    setChildId(preset?.childId ?? '');
    setArrangementId(preset?.arrangementId ?? '');
    setPrefill(preset ?? null);
    setWizardError('');
  };

  // Arriving from another admin page with ?childId=&arrangementId= opens the wizard pre-filled.
  useEffect(() => {
    const presetChild = searchParams.get('childId');
    const presetArrangement = searchParams.get('arrangementId');
    if (presetChild && presetArrangement) {
      openWizard({ childId: presetChild, arrangementId: presetArrangement });
      setSearchParams({}, { replace: true });
    }
    // runs once for the incoming link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When pre-filled, work out the paying parent so the supporter step shows the right person.
  useEffect(() => {
    if (!prefill || !child.data || child.data.id !== prefill.childId) return;
    const payer = child.data.arrangements.find((item) => item.id === prefill.arrangementId)?.payingParent;
    if (payer) setSupporterId(payer.id);
    setPrefill(null);
  }, [prefill, child.data]);

  const chooseSupporter = (id: string) => {
    setSupporterId(id);
    setChildId('');
    setArrangementId('');
  };
  const chooseChild = (id: string) => {
    setChildId(id);
    setArrangementId('');
  };

  const eligibleArrangements = (child.data?.arrangements ?? []).filter((item) => item.status !== 'Cancelled');
  const chosenArrangement = eligibleArrangements.find((item) => item.id === arrangementId);
  const chosenWorker = workers.find((item) => item.id === workerId);
  const currentWorker = child.data?.currentAssignment?.socialWorker;

  const submitAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workerId || !childId || !arrangementId) {
      setWizardError('Choose a social worker, a child supporter, a child and an arrangement.');
      return;
    }
    setSaving(true);
    setWizardError('');
    try {
      await adminApi.createAssignment({ socialWorkerId: workerId, childId, arrangementId });
      setToast({
        type: 'success',
        message: `${chosenWorker?.fullName ?? 'The social worker'} is now assigned to ${child.data?.fullName ?? 'the child'}.`,
      });
      setWizardOpen(false);
      list.reload();
    } catch (failure) {
      setWizardError(failure instanceof Error ? failure.message : 'The assignment could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const doReassign = async () => {
    if (!reassigning || !newWorkerId) return;
    setSaving(true);
    setActionError('');
    try {
      await adminApi.reassignAssignment(reassigning.id, newWorkerId);
      setToast({ type: 'success', message: `${reassigning.child.fullName} was reassigned. The previous assignment is kept in the history.` });
      setConfirmReassign(false);
      setReassigning(null);
      list.reload();
    } catch (failure) {
      setConfirmReassign(false);
      setActionError(failure instanceof Error ? failure.message : 'The assignment could not be changed.');
    } finally {
      setSaving(false);
    }
  };

  const doEnd = async () => {
    if (!ending) return;
    setSaving(true);
    setActionError('');
    try {
      await adminApi.endAssignment(ending.id);
      setToast({ type: 'success', message: `The assignment for ${ending.child.fullName} was ended.` });
      setEnding(null);
      list.reload();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'The assignment could not be ended.');
    } finally {
      setSaving(false);
    }
  };

  const data = list.data;

  return (
    <>
      {toast && (
        <div className="fixed right-4 top-4 z-[60] w-96 max-w-[90vw]">
          <ToastBanner type={toast.type} message={toast.message} onDismiss={() => setToast(null)} />
        </div>
      )}

      <ListFrame
        title="Social Worker Assignments"
        description="Assign a social worker to a child through one of the child's maintenance arrangements. Earlier assignments stay in the history."
        actions={
          <button type="button" onClick={() => openWizard()} className="inline-flex items-center gap-1.5 rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] whitespace-nowrap">
            <Plus className="h-4 w-4" />
            <span>Assign social worker</span>
          </button>
        }
        searchValue={list.searchInput}
        onSearch={list.setSearchInput}
        searchPlaceholder="Search child or social worker"
        filters={
          <>
            <div role="tablist" aria-label="Assignment view" className="inline-flex rounded-sm border border-slate-300 bg-white p-0.5 text-sm">
              {([['ACTIVE', 'Active'], ['ALL', 'History (all)']] as const).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)} className={`rounded-sm px-3 py-1.5 font-medium whitespace-nowrap ${view === key ? 'bg-[#0F2942] text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
                  {label}
                </button>
              ))}
            </div>
            <select aria-label="Filter by social worker" value={workerFilter} onChange={(event) => setWorkerFilter(event.target.value)} className={FILTER_SELECT}>
              <option value="">All social workers</option>
              {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.fullName}</option>)}
            </select>
          </>
        }
        loading={list.loading}
        error={list.error ?? (workersError || null)}
        onRetry={list.reload}
        isEmpty={list.items.length === 0}
        emptyTitle={view === 'ACTIVE' ? 'No active assignments' : 'No assignments found'}
        emptyDescription="Use “Assign social worker” to connect a social worker to a child and arrangement."
        footer={data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={list.setPage} />}
      >
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className={TABLE_HEAD}>
            <tr>
              <th className={TH}>Child</th>
              <th className={TH}>Social worker</th>
              <th className={TH}>Arrangement</th>
              <th className={TH}>Status</th>
              <th className={TH}>Assigned</th>
              <th className={TH}>Ended</th>
              <th className={`${TH} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {list.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#0F2942]">{item.child.fullName}</td>
                <td className={`${TD} whitespace-nowrap`}>{item.socialWorker.fullName}</td>
                <td className={`${TD} text-xs`}>
                  {item.arrangement ? (
                    <>
                      {item.arrangement.payingParent} → {item.arrangement.receivingParent}
                      <br />
                      <span className="font-mono">{formatZAR(item.arrangement.expectedAmount)}</span> · {item.arrangement.frequency}
                    </>
                  ) : '— (whole child)'}
                </td>
                <td className="px-4 py-3"><StatusPill status={item.status} /></td>
                <td className={`${TD} text-xs whitespace-nowrap`}>
                  {formatSADateShort(item.assignedAt)}
                  <br />by {item.assignedBy.fullName} ({ROLE_LABEL[item.assignedBy.role] ?? item.assignedBy.role})
                </td>
                <td className={`${TD} text-xs whitespace-nowrap`}>
                  {item.endedAt ? <>{formatSADateShort(item.endedAt)}{item.endedBy && <><br />by {item.endedBy}</>}</> : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {item.status === 'ACTIVE' && (
                    <div className="inline-flex items-center gap-3">
                      <button type="button" onClick={() => { setReassigning(item); setNewWorkerId(''); setActionError(''); }} className="text-xs font-medium text-[#006847] hover:underline">Reassign</button>
                      <button type="button" onClick={() => { setEnding(item); setActionError(''); }} className="text-xs font-medium text-red-700 hover:underline">End</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>

      <Modal isOpen={wizardOpen} onClose={() => (saving ? undefined : setWizardOpen(false))} title="Assign a social worker" subtitle="Choose each step in order; the next list fills in from your choice." maxWidth="xl">
        <form onSubmit={submitAssignment} className="space-y-4">
          {wizardError && <div role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{wizardError}</div>}

          <div>
            <label htmlFor="wz-worker" className="block text-sm font-medium text-slate-800">1. Social worker</label>
            <select id="wz-worker" required value={workerId} onChange={(event) => setWorkerId(event.target.value)} className={selectClass}>
              <option value="">Select an available social worker</option>
              {activeWorkers.map((worker) => <option key={worker.id} value={worker.id}>{worker.fullName} ({worker.assignedChildren} active)</option>)}
            </select>
            {activeWorkers.length === 0 && !workersError && <p className="mt-1 text-xs text-red-700">No active social workers. Register one first.</p>}
          </div>

          <div>
            <label htmlFor="wz-supporter-search" className="block text-sm font-medium text-slate-800">2. Child supporter (paying parent)</label>
            <input id="wz-supporter-search" type="search" value={supporterSearch} onChange={(event) => setSupporterSearch(event.target.value)} placeholder="Type to search by name or email" className={selectClass} />
            <select id="wz-supporter" aria-label="Child supporter" required value={supporterId} onChange={(event) => chooseSupporter(event.target.value)} className={selectClass}>
              <option value="">Select a child supporter</option>
              {supporterId && !supporters.some((item) => item.id === supporterId) && supporter.data && (
                <option value={supporter.data.id}>{supporter.data.fullName}</option>
              )}
              {supporters.map((item) => <option key={item.id} value={item.id}>{item.fullName} — {item.email}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="wz-child" className="block text-sm font-medium text-slate-800">3. Child</label>
            <select id="wz-child" required disabled={!supporterId || supporter.loading} value={childId} onChange={(event) => chooseChild(event.target.value)} className={selectClass}>
              <option value="">{supporter.loading ? 'Loading children…' : supporterId ? 'Select a child' : 'Choose a supporter first'}</option>
              {(supporter.data?.children ?? []).map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
            </select>
            {supporter.error && <p role="alert" className="mt-1 text-xs text-red-700">{supporter.error}</p>}
          </div>

          <fieldset disabled={!childId || child.loading}>
            <legend className="block text-sm font-medium text-slate-800">4. Maintenance arrangement</legend>
            {!childId ? (
              <p className="mt-1 text-xs text-slate-500">Choose a child to see their arrangements.</p>
            ) : child.loading ? (
              <p role="status" className="mt-1 text-xs text-slate-500">Loading arrangements…</p>
            ) : child.error ? (
              <p role="alert" className="mt-1 text-xs text-red-700">{child.error}</p>
            ) : eligibleArrangements.length === 0 ? (
              <p className="mt-1 text-xs text-red-700">This child has no maintenance arrangement that can be assigned.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {eligibleArrangements.map((item) => (
                  <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-sm border p-3 text-sm ${arrangementId === item.id ? 'border-[#006847] bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="arrangement" required checked={arrangementId === item.id} onChange={() => setArrangementId(item.id)} className="mt-1 accent-[#006847]" />
                    <span className="flex-1">
                      <span className="block font-medium text-[#0F2942]">{item.payingParent.fullName} → {item.receivingParent.fullName}</span>
                      <span className="block text-xs text-slate-600">
                        <span className="font-mono">{formatZAR(item.expectedAmount)}</span> · {item.frequency} · {formatSADateShort(item.startDate)} – {item.endDate ? formatSADateShort(item.endDate) : 'open'} · <StatusPill status={item.status} />
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          {chosenArrangement && chosenWorker && (
            <div className="rounded-sm border border-sky-700/30 bg-sky-50 px-3 py-2.5 text-sm text-sky-950">
              <strong>{chosenWorker.fullName}</strong> will be assigned to <strong>{child.data?.fullName}</strong> through the arrangement above.
              {currentWorker && currentWorker.id !== chosenWorker.id && <> This replaces <strong>{currentWorker.fullName}</strong>, whose assignment is kept in the history.</>}
              {' '}No amounts or payments are changed.
              {child.data?.currentAssignment && child.data.currentAssignment.socialWorker.id === chosenWorker.id && child.data.currentAssignment.arrangement?.id === arrangementId && (
                <span className="mt-1 block font-semibold text-red-800">This worker is already assigned to this arrangement.</span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => setWizardOpen(false)} disabled={saving} className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving || !arrangementId || !workerId} className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] disabled:opacity-50">
              {saving ? 'Saving…' : 'Confirm assignment'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(reassigning) && !confirmReassign} onClose={() => setReassigning(null)} title="Reassign to another social worker" subtitle={reassigning ? `${reassigning.child.fullName} — currently ${reassigning.socialWorker.fullName}` : undefined} maxWidth="md">
        <div className="space-y-4">
          {actionError && <div role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{actionError}</div>}
          <div>
            <label htmlFor="re-worker" className="block text-sm font-medium text-slate-800">New social worker</label>
            <select id="re-worker" value={newWorkerId} onChange={(event) => setNewWorkerId(event.target.value)} className={selectClass}>
              <option value="">Select an available social worker</option>
              {activeWorkers.filter((worker) => worker.id !== reassigning?.socialWorker.id).map((worker) => (
                <option key={worker.id} value={worker.id}>{worker.fullName} ({worker.assignedChildren} active)</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => setReassigning(null)} className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="button" disabled={!newWorkerId} onClick={() => setConfirmReassign(true)} className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] disabled:opacity-50">Continue</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmReassign}
        title="Confirm reassignment"
        message={<p>Move <strong>{reassigning?.child.fullName}</strong> from <strong>{reassigning?.socialWorker.fullName}</strong> to <strong>{workers.find((worker) => worker.id === newWorkerId)?.fullName}</strong>? The current assignment is ended and kept in the history.</p>}
        confirmLabel="Reassign"
        busy={saving}
        onConfirm={() => void doReassign()}
        onCancel={() => setConfirmReassign(false)}
      />

      <ConfirmDialog
        isOpen={Boolean(ending)}
        title="End this assignment?"
        message={<p><strong>{ending?.socialWorker.fullName}</strong> will no longer see <strong>{ending?.child.fullName}</strong>. The child will have no social worker until another is assigned. The assignment stays in the history{ending ? ` (assigned ${formatSADate(ending.assignedAt)})` : ''}.</p>}
        confirmLabel="End assignment"
        tone="danger"
        busy={saving}
        error={actionError}
        onConfirm={() => void doEnd()}
        onCancel={() => setEnding(null)}
      />
    </>
  );
}
