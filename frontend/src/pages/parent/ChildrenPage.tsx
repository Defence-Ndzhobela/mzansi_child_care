import React, { useEffect, useState } from 'react';
import { Edit3, Link2, Plus, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
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

type ModalMode = 'create' | 'edit' | 'link';

export function ChildrenPage() {
  const { currentUser } = useAuth();
  const {
    db,
    childrenLoading,
    childrenError,
    pendingChildLinkRequests,
    refreshFamilyData,
    refreshChildLinkRequests,
    addChild,
    updateChild,
    requestChildLink,
    respondToChildLinkRequest,
  } = useData();
  const children = db.children;

  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [southAfricanId, setSouthAfricanId] = useState('');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('Mother');
  const [isPrimaryCaregiver, setIsPrimaryCaregiver] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'PARENT_CAREGIVER') return;
    const timer = window.setInterval(() => {
      void refreshChildLinkRequests().catch(() => {});
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [currentUser?.id, currentUser?.role, refreshChildLinkRequests]);

  if (!currentUser) return null;

  const openCreate = () => {
    setModalMode('create');
    setEditingChild(null);
    setFirstName('');
    setLastName('');
    setDateOfBirth('');
    setSouthAfricanId('');
    setRelationshipType('Mother');
    setIsPrimaryCaregiver(true);
    setError('');
    setModalOpen(true);
  };

  const openLink = () => {
    setModalMode('link');
    setEditingChild(null);
    setSouthAfricanId('');
    setRelationshipType('Father');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (child: Child) => {
    setModalMode('edit');
    setEditingChild(child);
    setFirstName(child.firstName);
    setLastName(child.lastName);
    setDateOfBirth(child.dateOfBirth);
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (modalMode === 'link') {
        await requestChildLink(southAfricanId, relationshipType);
        setToast('Request submitted. If a matching profile is found, its creator will be asked to approve the link.');
      } else if (modalMode === 'edit' && editingChild) {
        await updateChild(editingChild.id, { firstName, lastName, dateOfBirth });
        setToast(`Updated child profile for ${firstName.trim()} ${lastName.trim()}.`);
      } else {
        await addChild({
          firstName,
          lastName,
          dateOfBirth,
          southAfricanId,
          relationshipType,
          isPrimaryCaregiver,
        });
        setToast('Profile submitted. If an existing child profile matches, its creator must approve access.');
      }
      setSouthAfricanId('');
      setModalOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save the request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResponse = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    setRespondingTo(requestId);
    setError('');
    try {
      await respondToChildLinkRequest(requestId, decision);
      setToast(decision === 'APPROVED' ? 'Linking request approved.' : 'Linking request rejected.');
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : 'Unable to respond to request.');
    } finally {
      setRespondingTo(null);
    }
  };

  const title = modalMode === 'link'
    ? 'Link Existing Child'
    : modalMode === 'edit' ? 'Edit Child Profile' : 'Create Child Profile';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">My Children</h1>
          <p className="mt-1 text-sm text-slate-600">Child profiles and approved family links are saved securely in the database.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openLink} className="inline-flex items-center gap-1.5 rounded-sm border border-[#006847] px-4 py-2 text-sm font-medium text-[#006847] hover:bg-emerald-50">
            <Link2 className="h-4 w-4" />
            <span>Link Existing Child</span>
          </button>
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238]">
            <Plus className="h-4 w-4" />
            <span>Add child</span>
          </button>
        </div>
      </div>

      {toast && <ToastBanner type="success" message={toast} onDismiss={() => setToast('')} />}
      {error && !modalOpen && <ToastBanner type="error" message={error} onDismiss={() => setError('')} />}
      {childrenError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-sm border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <span>{childrenError}</span>
          <button type="button" onClick={() => void refreshFamilyData().catch(() => {})} className="font-semibold underline">Retry</button>
        </div>
      )}

      {pendingChildLinkRequests.length > 0 && (
        <section className="space-y-3 rounded-sm border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-display text-base font-semibold text-[#0F2942]">Child linking requests</h2>
          {pendingChildLinkRequests.map((request) => (
            <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 border border-amber-200 bg-white p-3">
              <p className="text-sm text-slate-800">
                <strong>{request.requesterName}</strong> ({request.requesterEmail}) requests access to <strong>{request.childName}</strong> as {request.relationshipType}.
              </p>
              <div className="flex gap-2">
                <button type="button" disabled={respondingTo === request.id} onClick={() => void handleResponse(request.id, 'REJECTED')} className="rounded-sm border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50">Reject</button>
                <button type="button" disabled={respondingTo === request.id} onClick={() => void handleResponse(request.id, 'APPROVED')} className="rounded-sm bg-[#006847] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Approve</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {childrenLoading ? (
        <p role="status" className="py-8 text-center text-sm text-slate-600">Loading child profiles…</p>
      ) : children.length === 0 ? (
        <EmptyState
          title="No child profiles yet"
          description="Create a profile or request access to a child profile created by another caregiver."
          actionLabel="Create Child Profile"
          onAction={openCreate}
          icon={<Users className="h-6 w-6" />}
        />
      ) : (
        <div className="overflow-x-auto rounded-sm border border-slate-200 bg-white">
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
                const relationships = db.familyRelationships.filter((item) => item.childId === child.id);
                const myRelationship = relationships.find((item) => item.userId === currentUser.id);
                const linkedNames = relationships.map((item) => {
                  const name = item.fullName ?? db.users.find((user) => user.id === item.userId)?.fullName;
                  return name ? `${name} (${item.relationshipType})` : null;
                }).filter(Boolean).join(' · ');
                return (
                  <tr key={child.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#0F2942]">{child.firstName} {child.lastName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatSADate(child.dateOfBirth)}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">{calculateAge(child.dateOfBirth)} yrs</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{myRelationship?.relationshipType ?? 'Caregiver'}{myRelationship?.isPrimaryCaregiver ? ' · Primary' : ''}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{linkedNames || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {child.createdBy === currentUser.id && (
                        <button type="button" onClick={() => openEdit(child)} className="inline-flex items-center gap-1 text-xs font-medium text-[#0F2942] hover:underline">
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={title}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
          {modalMode === 'link' ? (
            <>
              <div className="rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                The child’s profile creator must approve your request. Entering an ID does not grant access. The ID is used only for a protected lookup and is not stored as plain text.
              </div>
              <div>
                <label htmlFor="child-link-id" className="block text-sm font-medium text-slate-800">Child’s South African ID number</label>
                <input id="child-link-id" type="password" inputMode="numeric" autoComplete="off" required maxLength={15} value={southAfricanId} onChange={(event) => setSouthAfricanId(event.target.value)} className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none" />
              </div>
              <div>
                <label htmlFor="link-relationship" className="block text-sm font-medium text-slate-800">Your relationship to the child</label>
                <select id="link-relationship" value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as RelationshipType)} className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none">
                  {RELATIONSHIP_OPTIONS.map((relationship) => <option key={relationship}>{relationship}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="child-first" className="block text-sm font-medium text-slate-800">First name</label>
                  <input id="child-first" type="text" required maxLength={100} value={firstName} onChange={(event) => setFirstName(event.target.value)} className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none" />
                </div>
                <div>
                  <label htmlFor="child-last" className="block text-sm font-medium text-slate-800">Last name</label>
                  <input id="child-last" type="text" required maxLength={100} value={lastName} onChange={(event) => setLastName(event.target.value)} className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none" />
                </div>
              </div>
              <div>
                <label htmlFor="child-dob" className="block text-sm font-medium text-slate-800">Date of birth</label>
                <input id="child-dob" type="date" required max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none" />
              </div>
              {modalMode === 'create' && (
                <>
                  <div>
                    <label htmlFor="child-id" className="block text-sm font-medium text-slate-800">South African ID number</label>
                    <input id="child-id" type="password" inputMode="numeric" autoComplete="off" required maxLength={15} value={southAfricanId} onChange={(event) => setSouthAfricanId(event.target.value)} className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none" />
                    <p className="mt-1 text-xs text-slate-600">Used for duplicate prevention and approved linking requests. The ID itself is never stored in the database.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="child-rel" className="block text-sm font-medium text-slate-800">Your relationship</label>
                      <select id="child-rel" value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as RelationshipType)} className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none">
                        {RELATIONSHIP_OPTIONS.map((relationship) => <option key={relationship}>{relationship}</option>)}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
                      <input type="checkbox" checked={isPrimaryCaregiver} onChange={(event) => setIsPrimaryCaregiver(event.target.checked)} className="accent-[#006847]" />
                      <span>I am a primary caregiver</span>
                    </label>
                  </div>
                </>
              )}
            </>
          )}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] disabled:opacity-60">
              {submitting ? 'Saving…' : modalMode === 'link' ? 'Request Link' : modalMode === 'edit' ? 'Save Changes' : 'Create Child Profile'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
