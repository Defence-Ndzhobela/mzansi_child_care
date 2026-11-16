import React, { useState } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { AdminSocialWorker, SocialWorkerInput } from '../../types/admin';
import { useAdminList } from '../../hooks/useAdminList';
import { formatSADateShort } from '../../utils/format';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { FILTER_SELECT, ListFrame, TABLE_HEAD, TD, TH } from '../../components/admin/ListFrame';
import { Pagination } from '../../components/admin/Pagination';
import { StatusPill } from '../../components/admin/StatusPill';
import { Modal } from '../../components/Modal';
import { ToastBanner } from '../../components/ToastBanner';

const PAGE_SIZE = 10;
const EMPTY_FORM: SocialWorkerInput = {
  fullName: '',
  email: '',
  phone: '',
  registrationNumber: '',
  accountStatus: 'ACTIVE',
  password: '',
};
const inputClass =
  'mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none';

export function AdminSocialWorkers() {
  const [statusFilter, setStatusFilter] = useState('');
  const list = useAdminList(adminApi.listSocialWorkers, statusFilter ? { status: statusFilter } : {}, PAGE_SIZE);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSocialWorker | null>(null);
  const [form, setForm] = useState<SocialWorkerInput>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deleting, setDeleting] = useState<AdminSocialWorker | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const setField = <K extends keyof SocialWorkerInput>(key: K, value: SocialWorkerInput[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (worker: AdminSocialWorker) => {
    setEditing(worker);
    setForm({
      fullName: worker.fullName,
      email: worker.email,
      phone: worker.phone,
      registrationNumber: worker.registrationNumber ?? '',
      accountStatus: worker.accountStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    });
    setFormError('');
    setFormOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        const { password: _unused, ...fields } = form;
        await adminApi.updateSocialWorker(editing.id, fields as SocialWorkerInput);
        setToast({ type: 'success', message: `${form.fullName.trim()} was updated.` });
      } else {
        await adminApi.createSocialWorker(form);
        setToast({ type: 'success', message: `${form.fullName.trim()} was registered as a social worker.` });
      }
      setConfirmDeactivate(false);
      setFormOpen(false);
      list.reload();
    } catch (failure) {
      setConfirmDeactivate(false);
      setFormError(failure instanceof Error ? failure.message : 'The social worker could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Switching an active account off needs an explicit confirmation.
    if (editing && editing.accountStatus === 'ACTIVE' && form.accountStatus === 'INACTIVE') {
      setConfirmDeactivate(true);
      return;
    }
    void save();
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    setDeleteError('');
    try {
      const { outcome } = await adminApi.deleteSocialWorker(deleting.id);
      setToast({
        type: 'success',
        message: outcome === 'DELETED'
          ? `${deleting.fullName} was removed.`
          : `${deleting.fullName} was deactivated. Their case history and notes are kept.`,
      });
      setDeleting(null);
      list.reload();
    } catch (failure) {
      setDeleteError(failure instanceof Error ? failure.message : 'The social worker could not be removed.');
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
        title="Social Workers"
        description="Register, edit and deactivate social worker accounts."
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Add social worker</span>
          </button>
        }
        searchValue={list.searchInput}
        onSearch={list.setSearchInput}
        searchPlaceholder="Search name, email or registration number"
        filters={
          <select
            aria-label="Filter by account status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={FILTER_SELECT}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        }
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        isEmpty={list.items.length === 0}
        emptyTitle="No social workers found"
        emptyDescription={
          list.searchInput || statusFilter
            ? 'No social worker matches this search or filter.'
            : 'Add the first social worker so parents can choose one.'
        }
        footer={
          data && (
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={list.setPage} />
          )
        }
      >
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className={TABLE_HEAD}>
            <tr>
              <th className={TH}>Name</th>
              <th className={TH}>Email</th>
              <th className={TH}>Phone</th>
              <th className={TH}>Registration no.</th>
              <th className={TH}>Status</th>
              <th className={`${TH} text-right`}>Assigned children</th>
              <th className={TH}>Registered</th>
              <th className={`${TH} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {list.items.map((worker) => (
              <tr key={worker.id} className="hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#0F2942]">{worker.fullName}</td>
                <td className={TD}>{worker.email}</td>
                <td className={`${TD} whitespace-nowrap`}>{worker.phone || '—'}</td>
                <td className={`${TD} whitespace-nowrap`}>{worker.registrationNumber ?? '—'}</td>
                <td className="px-4 py-3"><StatusPill status={worker.accountStatus} /></td>
                <td className={`${TD} text-right tabular-nums`}>{worker.assignedChildren}</td>
                <td className={`${TD} whitespace-nowrap`}>{formatSADateShort(worker.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-3">
                    <button type="button" onClick={() => openEdit(worker)} className="inline-flex items-center gap-1 text-xs font-medium text-[#0F2942] hover:underline">
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError('');
                        setDeleting(worker);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>

      <Modal
        isOpen={formOpen}
        onClose={() => (saving ? undefined : setFormOpen(false))}
        title={editing ? 'Edit Social Worker' : 'Add Social Worker'}
        subtitle={editing ? undefined : 'The worker signs in with this email and password through the normal login page.'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <div role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</div>}
          <div>
            <label htmlFor="sw-name" className="block text-sm font-medium text-slate-800">Full name</label>
            <input id="sw-name" required maxLength={150} value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sw-email" className="block text-sm font-medium text-slate-800">Email address</label>
              <input id="sw-email" type="email" required maxLength={255} value={form.email} onChange={(e) => setField('email', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="sw-phone" className="block text-sm font-medium text-slate-800">Phone number</label>
              <input id="sw-phone" type="tel" required maxLength={30} value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sw-reg" className="block text-sm font-medium text-slate-800">Professional registration number</label>
              <input id="sw-reg" maxLength={50} value={form.registrationNumber} onChange={(e) => setField('registrationNumber', e.target.value)} className={inputClass} placeholder="Optional" />
            </div>
            <div>
              <label htmlFor="sw-status" className="block text-sm font-medium text-slate-800">Account status</label>
              <select id="sw-status" value={form.accountStatus} onChange={(e) => setField('accountStatus', e.target.value as 'ACTIVE' | 'INACTIVE')} className={`${inputClass} bg-white`}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
          {!editing && (
            <div>
              <label htmlFor="sw-password" className="block text-sm font-medium text-slate-800">Temporary password</label>
              <input id="sw-password" type="password" required minLength={10} autoComplete="new-password" value={form.password ?? ''} onChange={(e) => setField('password', e.target.value)} className={inputClass} />
              <p className="mt-1 text-xs text-slate-600">At least 10 characters with uppercase, lowercase and a number. Share it with the worker securely; it is stored only as a hash.</p>
            </div>
          )}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] disabled:opacity-60">
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Register social worker'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDeactivate}
        title="Deactivate this account?"
        message={
          <p>
            <strong>{editing?.fullName}</strong> will no longer be able to sign in or be chosen for new cases. Their
            history is kept. A worker who still has active cases cannot be deactivated.
          </p>
        }
        confirmLabel="Deactivate account"
        tone="danger"
        busy={saving}
        onConfirm={() => void save()}
        onCancel={() => setConfirmDeactivate(false)}
      />

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title="Remove this social worker?"
        message={
          <>
            <p>
              <strong>{deleting?.fullName}</strong> will be removed. If they have any case history, notes or reviews the
              account is deactivated instead, so those records are never lost.
            </p>
            <p className="mt-2">A worker with active cases cannot be removed until those cases are reassigned or ended.</p>
          </>
        }
        confirmLabel="Remove"
        tone="danger"
        busy={saving}
        error={deleteError}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
