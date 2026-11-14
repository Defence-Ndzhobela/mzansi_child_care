import React, { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useSocialWorkerScope } from '../../hooks/useFamilyScope';
import { Child } from '../../types';
import { calculateAge, formatSADate } from '../../utils/format';
import { Modal } from '../../components/Modal';
import { ToastBanner } from '../../components/ToastBanner';

export function SocialWorkerChildrenPage() {
  const { currentUser } = useAuth();
  const { db, addProfessionalNote } = useData();
  const { children, arrangements, notes } = useSocialWorkerScope();

  const [noteChild, setNoteChild] = useState<Child | null>(null);
  const [noteText, setNoteText] = useState('');
  const [toast, setToast] = useState('');

  if (!currentUser) return null;

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteChild || !noteText.trim()) return;
    addProfessionalNote({
      socialWorkerId: currentUser.id,
      childId: noteChild.id,
      note: noteText.trim(),
    });
    setToast(`Professional note recorded for ${noteChild.firstName} ${noteChild.lastName}.`);
    setNoteText('');
    setNoteChild(null);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-display text-2xl font-bold text-[#0F2942]">Assigned children</h1>
      </div>

      {toast && <ToastBanner type="success" message={toast} onDismiss={() => setToast('')} />}

      <div className="overflow-x-auto border border-slate-200 bg-white rounded-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold text-slate-600">
              <th className="px-4 py-3">Child Name</th>
              <th className="px-4 py-3">Date of Birth</th>
              <th className="px-4 py-3">Age</th>
              <th className="px-4 py-3">Linked Parents / Caregivers</th>
              <th className="px-4 py-3">Active Arrangement</th>
              <th className="px-4 py-3 text-right">Notes</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {children.map((child) => {
              const rels = db.familyRelationships.filter((r) => r.childId === child.id);
              const caregivers = rels
                .map((r) => {
                  const u = db.users.find((usr) => usr.id === r.userId);
                  return u ? `${u.fullName} (${r.relationshipType})` : null;
                })
                .filter(Boolean)
                .join(' · ');
              const arr = arrangements.find((a) => a.childId === child.id && a.status === 'Active');
              const childNotesCount = notes.filter((n) => n.childId === child.id).length;

              return (
                <tr key={child.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-[#0F2942] whitespace-nowrap">
                    {child.firstName} {child.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {formatSADate(child.dateOfBirth)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 whitespace-nowrap">
                    {calculateAge(child.dateOfBirth)} yrs
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{caregivers || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                    {arr ? `R ${arr.expectedAmount.toFixed(2)} / ${arr.frequency}` : 'None active'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {childNotesCount}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => {
                        setNoteChild(child);
                        setNoteText('');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#006847] hover:underline"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                      <span>Notes</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={Boolean(noteChild)}
        onClose={() => setNoteChild(null)}
        title={
          noteChild
            ? `Professional Notes — ${noteChild.firstName} ${noteChild.lastName}`
            : 'Professional Notes'
        }
        subtitle="Notes are visible in social worker case documentation."
      >
        {noteChild && (
          <div className="space-y-4">
            <div className="max-h-60 overflow-y-auto space-y-2">
              {notes.filter((n) => n.childId === noteChild.id).length === 0 ? (
                <p className="text-sm text-slate-500">No professional notes yet for this child.</p>
              ) : (
                notes
                  .filter((n) => n.childId === noteChild.id)
                  .map((n) => (
                    <div key={n.id} className="border border-slate-200 bg-slate-50 p-3 rounded-sm">
                      <p className="text-xs text-slate-500">{formatSADate(n.createdAt)}</p>
                      <p className="mt-1 text-sm text-slate-800">{n.note}</p>
                    </div>
                  ))
              )}
            </div>

            <form onSubmit={handleSaveNote} className="space-y-3 border-t border-slate-200 pt-4">
              <label htmlFor="sw-child-note" className="block text-sm font-medium text-slate-800">
                Add New Professional Note
              </label>
              <textarea
                id="sw-child-note"
                rows={3}
                required
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Enter objective case observation or follow-up action..."
                className="block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNoteChild(null)}
                  className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238]"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
