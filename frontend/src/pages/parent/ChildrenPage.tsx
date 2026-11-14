import React, { useState } from 'react';
import { Edit3, Plus, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useParentScope } from '../../hooks/useFamilyScope';
import { Child, RelationshipType } from '../../types';
import { calculateAge, formatSADate } from '../../utils/format';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { ToastBanner } from '../../components/ToastBanner';

const RELATIONSHIP_OPTIONS: RelationshipType[] = [
  'Mother',
  'Father',
  'Primary Caregiver',
  'Paying Parent',
  'Legal Guardian',
  'Extended Family Caregiver',
];

export function ChildrenPage() {
  const { currentUser } = useAuth();
  const { db, addChild, updateChild } = useData();
  const { children } = useParentScope();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('Mother');
  const [isPrimaryCaregiver, setIsPrimaryCaregiver] = useState(true);
  const [coParentUserId, setCoParentUserId] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  if (!currentUser) return null;

  const otherParents = db.users.filter(
    (u) => u.role === 'PARENT_CAREGIVER' && u.id !== currentUser.id
  );

  const openAdd = () => {
    setEditingChild(null);
    setFirstName('');
    setLastName('');
    setDateOfBirth('2020-05-15');
    setRelationshipType('Mother');
    setIsPrimaryCaregiver(true);
    setCoParentUserId(otherParents[0]?.id ?? '');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (child: Child) => {
    setEditingChild(child);
    setFirstName(child.firstName);
    setLastName(child.lastName);
    setDateOfBirth(child.dateOfBirth);
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim() || !dateOfBirth) {
      setError('Please enter first name, last name, and date of birth.');
      return;
    }

    if (editingChild) {
      updateChild(editingChild.id, { firstName, lastName, dateOfBirth });
      setToast(`Updated child profile for ${firstName.trim()} ${lastName.trim()}.`);
    } else {
      addChild({
        firstName,
        lastName,
        dateOfBirth,
        createdBy: currentUser.id,
        relationshipType,
        isPrimaryCaregiver,
        coParentUserId: coParentUserId || undefined,
        coParentRelationship: relationshipType === 'Mother' ? 'Father' : 'Paying Parent',
      });
      setToast(`Added child profile for ${firstName.trim()} ${lastName.trim()}.`);
    }

    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">My Children</h1>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>Add child</span>
        </button>
      </div>

      {toast && <ToastBanner type="success" message={toast} onDismiss={() => setToast('')} />}

      {children.length === 0 ? (
        <EmptyState
          title="No child profiles yet"
          description="Add a child profile first so you can record a maintenance arrangement."
          actionLabel="Add child"
          onAction={openAdd}
          icon={<Users className="h-6 w-6" />}
        />
      ) : (
        <div className="overflow-x-auto border border-slate-200 bg-white rounded-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Child Name</th>
                <th className="px-4 py-3">Date of Birth</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Your Relationship</th>
                <th className="px-4 py-3">Linked Parents / Caregivers</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {children.map((child) => {
                const rels = db.familyRelationships.filter((r) => r.childId === child.id);
                const myRel = rels.find((r) => r.userId === currentUser.id);
                const linkedNames = rels
                  .map((r) => {
                    const u = db.users.find((user) => user.id === r.userId);
                    return u ? `${u.fullName} (${r.relationshipType})` : null;
                  })
                  .filter(Boolean)
                  .join(' · ');

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
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {myRel ? myRel.relationshipType : 'Caregiver'}
                      {myRel?.isPrimaryCaregiver ? ' · Primary' : ''}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{linkedNames || '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(child)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0F2942] hover:underline"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingChild ? 'Edit Child Profile' : 'Add Child Profile'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="child-first" className="block text-sm font-medium text-slate-800">
                First Name
              </label>
              <input
                id="child-first"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Lethabo"
                className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="child-last" className="block text-sm font-medium text-slate-800">
                Last Name
              </label>
              <input
                id="child-last"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Mokoena"
                className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="child-dob" className="block text-sm font-medium text-slate-800">
              Date of Birth
            </label>
            <input
              id="child-dob"
              type="date"
              required
              max="2026-11-12"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
            />
          </div>

          {!editingChild && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="child-rel" className="block text-sm font-medium text-slate-800">
                    Your Relationship
                  </label>
                  <select
                    id="child-rel"
                    value={relationshipType}
                    onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
                    className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
                  >
                    {RELATIONSHIP_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="child-coparent" className="block text-sm font-medium text-slate-800">
                    Link Co-Parent (Optional)
                  </label>
                  <select
                    id="child-coparent"
                    value={coParentUserId}
                    onChange={(e) => setCoParentUserId(e.target.value)}
                    className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
                  >
                    <option value="">None linked yet</option>
                    {otherParents.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isPrimaryCaregiver}
                  onChange={(e) => setIsPrimaryCaregiver(e.target.checked)}
                  className="accent-[#006847]"
                />
                <span>I am a primary caregiver for this child</span>
              </label>
            </>
          )}

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
              className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238]"
            >
              {editingChild ? 'Save Changes' : 'Create Child Profile'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
