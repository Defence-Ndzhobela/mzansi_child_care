import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useSocialWorkerScope } from '../../hooks/useFamilyScope';
import { formatSADate, formatSADateShort, formatZAR } from '../../utils/format';
import { Modal } from '../../components/Modal';
import { PaymentStatusBadge } from '../../components/StatusBadge';
import { ToastBanner } from '../../components/ToastBanner';

export function AssignedFamiliesPage() {
  const { currentUser } = useAuth();
  const { db, addProfessionalNote } = useData();
  const { children, arrangements, payments, notes } = useSocialWorkerScope();

  const [search, setSearch] = useState('');
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [toast, setToast] = useState('');

  const filteredChildren = useMemo(() => {
    const q = search.trim().toLowerCase();
    return children.filter((c) => {
      if (!q) return true;
      const rels = db.familyRelationships.filter((r) => r.childId === c.id);
      const userNames = rels
        .map((r) => db.users.find((u) => u.id === r.userId)?.fullName ?? '')
        .join(' ');
      return `${c.firstName} ${c.lastName} ${userNames}`.toLowerCase().includes(q);
    });
  }, [children, search, db.familyRelationships, db.users]);

  if (!currentUser) return null;

  const selectedChild = selectedChildId
    ? children.find((c) => c.id === selectedChildId) ?? null
    : null;
  const selectedArr = selectedChild
    ? arrangements.find((a) => a.childId === selectedChild.id)
    : undefined;
  const selectedPayments = selectedChild
    ? payments.filter((p) => p.childId === selectedChild.id)
    : [];
  const selectedNotes = selectedChild
    ? notes.filter((n) => n.childId === selectedChild.id)
    : [];

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild || !newNote.trim()) return;
    addProfessionalNote({
      socialWorkerId: currentUser.id,
      childId: selectedChild.id,
      note: newNote.trim(),
    });
    setNewNote('');
    setToast(`Professional note added for ${selectedChild.firstName} ${selectedChild.lastName}.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Assigned Families</h1>
          <p className="mt-1 text-sm text-slate-600">Review family arrangements and case history.</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search family or child..."
            className="block w-full rounded-sm border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
          />
        </div>
      </div>

      {toast && <ToastBanner type="success" message={toast} onDismiss={() => setToast('')} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredChildren.map((child) => {
          const arr = arrangements.find((a) => a.childId === child.id && a.status === 'Active');
          const payer = arr ? db.users.find((u) => u.id === arr.payingUserId) : undefined;
          const receiver = arr ? db.users.find((u) => u.id === arr.receivingUserId) : undefined;
          const childPayments = payments.filter((p) => p.childId === child.id);
          const childNotes = notes.filter((n) => n.childId === child.id);

          return (
            <div
              key={child.id}
              className="border border-slate-200 bg-white p-5 rounded-sm flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-[#0F2942]">
                      {child.firstName} {child.lastName}
                    </h2>
                    <p className="text-xs text-slate-500">
                      DOB: {formatSADate(child.dateOfBirth)}
                    </p>
                  </div>
                  {arr && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Expected ({arr.frequency})</p>
                      <p className="font-mono text-base font-bold tabular-nums text-[#0F2942]">
                        {formatZAR(arr.expectedAmount)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-1 text-sm text-slate-700 border-t border-slate-100 pt-3">
                  <p>
                    Primary Caregiver:{' '}
                    <span className="font-medium">{receiver?.fullName ?? '—'}</span>
                  </p>
                  <p>
                    Paying Parent: <span className="font-medium">{payer?.fullName ?? '—'}</span>
                  </p>
                  <p className="text-xs text-slate-500 pt-1">
                    {childPayments.length} payment record(s) · {childNotes.length} professional
                    note(s)
                  </p>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedChildId(child.id)}
                  className="rounded-sm bg-[#0F2942] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Open case
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={Boolean(selectedChild)}
        onClose={() => setSelectedChildId(null)}
        title={
          selectedChild
            ? `Case File: ${selectedChild.firstName} ${selectedChild.lastName}`
            : 'Case File'
        }
        subtitle="Case details and notes"
        maxWidth="2xl"
      >
        {selectedChild && (
          <div className="space-y-6">
            {selectedArr && (
              <div className="border border-slate-200 bg-slate-50 p-4 rounded-sm text-sm">
                <p className="font-semibold text-[#0F2942]">Active Maintenance Arrangement</p>
                <p className="mt-1 text-slate-700">
                  Expected: <span className="font-mono font-semibold">{formatZAR(selectedArr.expectedAmount)}</span>{' '}
                  ({selectedArr.frequency}) · Started {formatSADate(selectedArr.startDate)}
                </p>
                {selectedArr.notes && (
                  <p className="mt-1 text-xs text-slate-600">{selectedArr.notes}</p>
                )}
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-[#0F2942]">
                Payment History ({selectedPayments.length})
              </h3>
              <div className="mt-2 overflow-x-auto border border-slate-200 rounded-sm">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50">
                    <tr className="text-left font-semibold text-slate-600">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2 text-right">Submitted</th>
                      <th className="px-3 py-2 text-right">Confirmed</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedPayments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatSADateShort(p.paymentDate)}
                        </td>
                        <td className="px-3 py-2 font-mono">{p.paymentReference}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatZAR(p.amount)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-[#006847]">
                          {p.confirmedAmount !== undefined ? formatZAR(p.confirmedAmount) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <PaymentStatusBadge status={p.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#0F2942]">
                Professional Notes ({selectedNotes.length})
              </h3>
              <div className="mt-2 space-y-2">
                {selectedNotes.map((n) => (
                  <div key={n.id} className="border border-slate-200 bg-white p-3 rounded-sm text-sm">
                    <p className="text-xs text-slate-500">{formatSADate(n.createdAt)}</p>
                    <p className="mt-1 text-slate-800">{n.note}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddNote} className="mt-3 space-y-2">
                <label htmlFor="case-note-input" className="block text-xs font-medium text-slate-700">
                  Add Professional Note
                </label>
                <textarea
                  id="case-note-input"
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Record case observation or follow-up plan..."
                  className="block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="rounded-sm bg-[#006847] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#005238]"
                  >
                    Save Professional Note
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
