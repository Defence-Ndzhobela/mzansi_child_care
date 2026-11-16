import React, { useState } from 'react';
import { ClipboardList, Edit3, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useParentScope } from '../../hooks/useFamilyScope';
import {
  ArrangementFrequency,
  ArrangementStatus,
  MaintenanceArrangement,
  MaintenanceRole,
} from '../../types';
import { currentMonthKey, formatSADate, formatZAR } from '../../utils/format';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { ToastBanner } from '../../components/ToastBanner';

export function ArrangementsPage() {
  const { currentUser } = useAuth();
  const { db, addArrangement, updateArrangement } = useData();
  const { children, arrangements } = useParentScope();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceArrangement | null>(null);

  const [childId, setChildId] = useState('');
  const [roleInArrangement, setRoleInArrangement] = useState<MaintenanceRole>('RECEIVING');
  const [otherPartyId, setOtherPartyId] = useState('');
  const [expectedAmount, setExpectedAmount] = useState('1500');
  const [frequency, setFrequency] = useState<ArrangementFrequency>('Monthly');
  const [startDate, setStartDate] = useState(`${currentMonthKey()}-01`);
  const [status, setStatus] = useState<ArrangementStatus>('Active');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  if (!currentUser) return null;

  // The other party must already be an approved family member of the chosen child.
  const familyMembersOf = (selectedChildId: string) => {
    const members = new Map<string, string>();
    db.familyRelationships
      .filter((r) => r.childId === selectedChildId && r.userId !== currentUser.id)
      .forEach((r) => {
        members.set(r.userId, r.fullName ?? db.users.find((u) => u.id === r.userId)?.fullName ?? 'Family member');
      });
    return [...members.entries()].map(([id, fullName]) => ({ id, fullName }));
  };
  const otherParentUsers = familyMembersOf(childId);

  const selectChild = (id: string) => {
    setChildId(id);
    setOtherPartyId(familyMembersOf(id)[0]?.id ?? '');
  };

  const openCreate = () => {
    const first = children[0]?.id ?? '';
    setEditing(null);
    setChildId(first);
    setRoleInArrangement('RECEIVING');
    setOtherPartyId(familyMembersOf(first)[0]?.id ?? '');
    setExpectedAmount('1500');
    setFrequency('Monthly');
    setStartDate(`${currentMonthKey()}-01`);
    setStatus('Active');
    setNotes('');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (arr: MaintenanceArrangement) => {
    setEditing(arr);
    setChildId(arr.childId);
    setExpectedAmount(String(arr.expectedAmount));
    setFrequency(arr.frequency);
    setStartDate(arr.startDate);
    setStatus(arr.status);
    setNotes(arr.notes ?? '');
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedAmount = Number(expectedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Expected amount must be greater than R 0.00.');
      return;
    }

    if (!editing) {
      if (!childId) {
        setError('Please select a child profile first.');
        return;
      }
      if (!otherPartyId) {
        setError('This child has no other approved family member yet. Link them to the child first.');
        return;
      }
    }

    setSaving(true);
    try {
      if (editing) {
        await updateArrangement(editing.id, {
          expectedAmount: parsedAmount,
          frequency,
          startDate,
          endDate: editing.endDate,
          status,
          notes,
        });
        setToast('Maintenance arrangement updated.');
      } else {
        await addArrangement({
          childId,
          myRole: roleInArrangement,
          otherUserId: otherPartyId,
          expectedAmount: parsedAmount,
          frequency,
          startDate,
          notes,
        });
        setToast('New maintenance arrangement created.');
      }
      setModalOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The arrangement could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">
            Maintenance Arrangements
          </h1>
          <p className="mt-1 text-sm text-slate-600">Set expected contributions and schedules.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={children.length === 0}
          className="inline-flex items-center gap-1.5 rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] disabled:opacity-50 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>New Arrangement</span>
        </button>
      </div>

      {toast && <ToastBanner type="success" message={toast} onDismiss={() => setToast('')} />}

      {arrangements.length === 0 ? (
        <EmptyState
          title="No maintenance arrangements recorded"
          description={
            children.length === 0
              ? 'Add a child profile first before creating a maintenance arrangement.'
              : 'Create an arrangement specifying the expected monthly contribution and parties.'
          }
          actionLabel={children.length > 0 ? 'Create Arrangement' : undefined}
          onAction={children.length > 0 ? openCreate : undefined}
          icon={<ClipboardList className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-4">
          {arrangements.map((arr) => {
            const child = db.children.find((c) => c.id === arr.childId);
            const payer = db.users.find((u) => u.id === arr.payingUserId);
            const receiver = db.users.find((u) => u.id === arr.receivingUserId);
            const iPay = arr.payingUserId === currentUser.id;
            return (
              <div
                key={arr.id}
                className="border border-slate-200 bg-white p-5 rounded-sm flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-semibold text-[#0F2942]">
                      {child ? `${child.firstName} ${child.lastName}` : 'Child'}
                    </h2>
                    <span
                      className={`rounded border px-2 py-0.5 text-xs font-medium ${
                        iPay
                          ? 'border-sky-700/25 bg-sky-50 text-sky-900'
                          : 'border-emerald-700/25 bg-emerald-50 text-emerald-800'
                      }`}
                    >
                      {iPay ? 'You pay' : 'You receive'}
                    </span>
                    <span className="text-xs text-slate-500">·</span>
                    <span className="text-xs font-medium text-slate-700">{arr.status}</span>
                    <span className="text-xs text-slate-500">·</span>
                    <span className="text-xs text-slate-600">{arr.frequency}</span>
                  </div>
                  <p className="text-sm text-slate-700">
                    Paying Parent: <span className="font-medium">{payer?.fullName}</span> ·
                    Receiving Caregiver: <span className="font-medium">{receiver?.fullName}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Effective from {formatSADate(arr.startDate)}
                  </p>
                  {arr.notes && <p className="text-xs text-slate-600 pt-1">{arr.notes}</p>}
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                  <div className="sm:text-right">
                    <p className="text-xs text-slate-500">Expected Amount</p>
                    <p className="text-lg font-mono font-bold tabular-nums text-[#0F2942]">
                      {formatZAR(arr.expectedAmount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(arr)}
                    className="inline-flex items-center gap-1 rounded-sm border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Maintenance Arrangement' : 'Create Maintenance Arrangement'}
        subtitle="Specify the expected contribution amount and schedule."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          {!editing && (
            <>
              <div>
                <label htmlFor="arr-child" className="block text-sm font-medium text-slate-800">
                  Child
                </label>
                <select
                  id="arr-child"
                  value={childId}
                  onChange={(e) => selectChild(e.target.value)}
                  className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
                >
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="arr-role" className="block text-sm font-medium text-slate-800">
                    Your Role in Arrangement
                  </label>
                  <select
                    id="arr-role"
                    value={roleInArrangement}
                    onChange={(e) => setRoleInArrangement(e.target.value as MaintenanceRole)}
                    className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
                  >
                    <option value="RECEIVING">Receiving Parent / Caregiver</option>
                    <option value="PAYING">Paying Parent</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="arr-other" className="block text-sm font-medium text-slate-800">
                    {roleInArrangement === 'RECEIVING' ? 'Paying Parent' : 'Receiving Caregiver'}
                  </label>
                  <select
                    id="arr-other"
                    value={otherPartyId}
                    onChange={(e) => setOtherPartyId(e.target.value)}
                    className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
                  >
                    {otherParentUsers.length === 0 && <option value="">No approved family members</option>}
                    {otherParentUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="arr-amt" className="block text-sm font-medium text-slate-800">
                Expected Contribution (ZAR)
              </label>
              <input
                id="arr-amt"
                type="number"
                step="0.01"
                min="1"
                required
                value={expectedAmount}
                onChange={(e) => setExpectedAmount(e.target.value)}
                className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-[#006847] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="arr-freq" className="block text-sm font-medium text-slate-800">
                Frequency
              </label>
              <select
                id="arr-freq"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ArrangementFrequency)}
                className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              >
                <option value="Monthly">Monthly</option>
                <option value="Fortnightly">Fortnightly</option>
                <option value="Weekly">Weekly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="arr-start" className="block text-sm font-medium text-slate-800">
                Start Date
              </label>
              <input
                id="arr-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              />
            </div>

            {editing && (
              <div>
                <label htmlFor="arr-status" className="block text-sm font-medium text-slate-800">
                  Status
                </label>
                <select
                  id="arr-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ArrangementStatus)}
                  className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="arr-notes" className="block text-sm font-medium text-slate-800">
              Arrangement Notes (Optional)
            </label>
            <textarea
              id="arr-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Monthly contribution due by the 5th of each month."
              className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] disabled:opacity-60"
            >
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Arrangement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
