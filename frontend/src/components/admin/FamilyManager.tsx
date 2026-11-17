import React, { useState } from 'react';
import { adminApi } from '../../services/adminApi';
import { AdminChildDetail } from '../../types/admin';
import { ConfirmDialog } from './ConfirmDialog';

const RELATIONSHIPS = [
  { value: 'MOTHER', label: 'Mother' },
  { value: 'FATHER', label: 'Father' },
  { value: 'PRIMARY_CAREGIVER', label: 'Primary Caregiver' },
  { value: 'PAYING_PARENT', label: 'Paying Parent' },
  { value: 'LEGAL_GUARDIAN', label: 'Legal Guardian' },
  { value: 'EXTENDED_FAMILY_CAREGIVER', label: 'Extended Family Caregiver' },
];

const INPUT = 'mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none';
const PRIMARY_BUTTON = 'rounded-sm bg-[#006847] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#005238] disabled:opacity-60';
const SECONDARY_BUTTON = 'rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60';

type Member = AdminChildDetail['parents'][number];

interface FamilyManagerProps {
  child: AdminChildDetail;
  onChanged: (child: AdminChildDetail) => void;
  onArchive: () => void;
}

// Edit controls for one family inside the existing child details dialog. Every change is saved through the
// admin API (the server re-checks the ADMIN role and every rule); the dialog then shows what was saved.
export function FamilyManager({ child, onChanged, onArchive }: FamilyManagerProps) {
  const [editingChild, setEditingChild] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberType, setMemberType] = useState('MOTHER');
  const [memberPrimary, setMemberPrimary] = useState(false);

  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [newType, setNewType] = useState('MOTHER');
  const [newPrimary, setNewPrimary] = useState(false);

  const [removing, setRemoving] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<AdminChildDetail>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      onChanged(await action());
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The change could not be saved.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startEditChild = () => {
    setFirstName(child.firstName);
    setLastName(child.lastName);
    setDateOfBirth(child.dateOfBirth);
    setError(null);
    setEditingChild(true);
  };

  const saveChild = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await run(() => adminApi.updateChild(child.id, { firstName, lastName, dateOfBirth }))) setEditingChild(false);
  };

  const startEditMember = (member: Member) => {
    setMemberType(member.relationshipType);
    setMemberPrimary(member.isPrimaryCaregiver);
    setError(null);
    setEditingId(member.relationshipId);
  };

  const saveMember = async (member: Member) => {
    const input = { relationshipType: memberType, isPrimaryCaregiver: memberPrimary };
    if (await run(() => adminApi.updateFamilyMember(child.id, member.relationshipId, input))) setEditingId(null);
  };

  const addMember = async (event: React.FormEvent) => {
    event.preventDefault();
    const saved = await run(() => adminApi.addFamilyMember(child.id, {
      email, relationshipType: newType, isPrimaryCaregiver: newPrimary,
    }));
    if (saved) {
      setAdding(false);
      setEmail('');
      setNewPrimary(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    if (await run(() => adminApi.removeFamilyMember(child.id, removing.relationshipId))) setRemoving(null);
  };

  const relationshipSelect = (id: string, value: string, onChange: (value: string) => void) => (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={INPUT}>
      {RELATIONSHIPS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );

  return (
    <div className="space-y-6">
      {error && !removing && (
        <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#0F2942]">Child details</h3>
          {!editingChild && (
            <button type="button" onClick={startEditChild} className="text-xs font-medium text-[#006847] hover:underline">Edit</button>
          )}
        </div>
        {editingChild ? (
          <form onSubmit={saveChild} className="grid gap-3 rounded-sm border border-slate-200 p-3 sm:grid-cols-3">
            <div>
              <label htmlFor="family-first-name" className="block text-xs font-medium text-slate-700">First name</label>
              <input id="family-first-name" required maxLength={100} value={firstName} onChange={(e) => setFirstName(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="family-last-name" className="block text-xs font-medium text-slate-700">Last name</label>
              <input id="family-last-name" required maxLength={100} value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="family-dob" className="block text-xs font-medium text-slate-700">Date of birth</label>
              <input id="family-dob" type="date" required value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={INPUT} />
            </div>
            <div className="flex gap-2 sm:col-span-3">
              <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>{busy ? 'Saving…' : 'Save changes'}</button>
              <button type="button" disabled={busy} onClick={() => setEditingChild(false)} className={SECONDARY_BUTTON}>Cancel</button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-slate-700">{child.fullName}</p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#0F2942]">Parents and caregivers</h3>
          {!adding && (
            <button type="button" onClick={() => { setError(null); setAdding(true); }} className="text-xs font-medium text-[#006847] hover:underline">
              Add family member
            </button>
          )}
        </div>
        <ul className="divide-y divide-slate-100 rounded-sm border border-slate-200">
          {child.parents.map((member) => (
            <li key={member.relationshipId} className="px-3 py-2.5 text-sm">
              {editingId === member.relationshipId ? (
                <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <div>
                    <label htmlFor={`member-type-${member.relationshipId}`} className="block text-xs font-medium text-slate-700">
                      Relationship of {member.fullName}
                    </label>
                    {relationshipSelect(`member-type-${member.relationshipId}`, memberType, setMemberType)}
                  </div>
                  <label className="flex items-center gap-1.5 pb-2 text-xs font-medium text-slate-700">
                    <input type="checkbox" checked={memberPrimary} onChange={(e) => setMemberPrimary(e.target.checked)} className="h-3.5 w-3.5 accent-[#006847]" />
                    Primary caregiver
                  </label>
                  <div className="flex gap-2 pb-1">
                    <button type="button" disabled={busy} onClick={() => void saveMember(member)} className={PRIMARY_BUTTON}>{busy ? 'Saving…' : 'Save'}</button>
                    <button type="button" disabled={busy} onClick={() => setEditingId(null)} className={SECONDARY_BUTTON}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium text-[#0F2942]">{member.fullName}</span>
                    <span className="ml-2 text-xs text-slate-600">{member.relationship}{member.isPrimaryCaregiver ? ' · Primary' : ''}</span>
                    <span className="block text-xs text-slate-600">{member.email}{member.phone ? ` · ${member.phone}` : ''}</span>
                  </span>
                  <span className="flex gap-3 text-xs font-medium">
                    <button type="button" onClick={() => startEditMember(member)} className="text-[#006847] hover:underline">Edit</button>
                    <button type="button" onClick={() => { setError(null); setRemoving(member); }} className="text-red-700 hover:underline">Remove</button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>

        {adding && (
          <form onSubmit={addMember} className="mt-3 grid gap-3 rounded-sm border border-slate-200 p-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="family-new-email" className="block text-xs font-medium text-slate-700">Parent account email</label>
              <input id="family-new-email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
              <p className="mt-1 text-xs text-slate-600">The person must already have an active parent account.</p>
            </div>
            <div>
              <label htmlFor="family-new-type" className="block text-xs font-medium text-slate-700">Relationship</label>
              {relationshipSelect('family-new-type', newType, setNewType)}
            </div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 sm:self-end sm:pb-2">
              <input type="checkbox" checked={newPrimary} onChange={(e) => setNewPrimary(e.target.checked)} className="h-3.5 w-3.5 accent-[#006847]" />
              Primary caregiver
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>{busy ? 'Adding…' : 'Add to family'}</button>
              <button type="button" disabled={busy} onClick={() => setAdding(false)} className={SECONDARY_BUTTON}>Cancel</button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-sm border border-red-200 bg-red-50/40 p-3">
        <h3 className="text-sm font-semibold text-red-800">Archive this family</h3>
        <p className="mt-1 text-xs text-slate-700">
          Removes every parent and caregiver link and closes the social worker assignment. Parent accounts, payments,
          evidence, confirmations and professional records are kept.
        </p>
        <button type="button" onClick={onArchive} className="mt-2 rounded-sm bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800">
          Archive family
        </button>
      </section>

      <ConfirmDialog
        isOpen={Boolean(removing)}
        title="Remove family member"
        tone="danger"
        confirmLabel="Remove"
        busy={busy}
        error={removing ? error ?? undefined : undefined}
        message={removing && (
          <>Remove <strong>{removing.fullName}</strong> ({removing.relationship}) from {child.fullName}'s family? Their account and
          any payment records are kept; they will no longer see this child.</>
        )}
        onConfirm={() => void confirmRemove()}
        onCancel={() => { setRemoving(null); setError(null); }}
      />
    </div>
  );
}
