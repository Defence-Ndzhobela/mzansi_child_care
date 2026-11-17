import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '../Modal';
import { messageApi } from '../../services/messageApi';
import { ConversationSummary, MessageContact } from '../../types/messages';
import { formatZAR } from '../../utils/format';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isParent: boolean;
  contacts: MessageContact[];
  onStarted: (conversation: ConversationSummary) => void;
}

const contactKey = (contact: MessageContact) => `${contact.childId}:${contact.parent.id}`;

const frequencyLabel = (frequency: string) => frequency.charAt(0) + frequency.slice(1).toLowerCase();

// Lists only people the server says the user may message. The worker is never chosen here for a parent:
// the server uses the child's active assignment.
export function NewConversationModal({ isOpen, onClose, isParent, contacts, onStarted }: NewConversationModalProps) {
  const [selectedKey, setSelectedKey] = useState('');
  const [arrangementId, setArrangementId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedKey(contacts.length === 1 ? contactKey(contacts[0]) : '');
    setArrangementId('');
    setError(null);
  }, [isOpen, contacts]);

  const contact = contacts.find((item) => contactKey(item) === selectedKey);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contact || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const conversation = await messageApi.startConversation({
        childId: contact.childId,
        ...(isParent ? {} : { parentUserId: contact.parent.id }),
        ...(arrangementId ? { arrangementId } : {}),
      });
      onStarted(conversation);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The conversation could not be started.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New conversation"
      subtitle={isParent
        ? 'Message the social worker assigned to your child.'
        : 'Message a parent or caregiver of a child assigned to you.'}
      maxWidth="md"
    >
      {contacts.length === 0 ? (
        <p className="text-sm text-slate-600">
          {isParent
            ? 'None of your children has an active social worker yet, so there is nobody to message.'
            : 'You have no actively assigned children with linked parents yet.'}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="new-conversation-contact" className="block text-sm font-medium text-slate-800">
              {isParent ? 'Child and social worker' : 'Child and parent'}
            </label>
            <select
              id="new-conversation-contact"
              required
              value={selectedKey}
              onChange={(event) => { setSelectedKey(event.target.value); setArrangementId(''); }}
              className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
            >
              <option value="">Select…</option>
              {contacts.map((item) => (
                <option key={contactKey(item)} value={contactKey(item)}>
                  {item.childName} — {isParent ? item.socialWorker.fullName : item.parent.fullName}
                  {item.conversationId ? ' (existing conversation)' : ''}
                </option>
              ))}
            </select>
          </div>

          {contact && contact.arrangements.length > 0 && !contact.conversationId && (
            <div>
              <label htmlFor="new-conversation-arrangement" className="block text-sm font-medium text-slate-800">
                Related maintenance arrangement <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <select
                id="new-conversation-arrangement"
                value={arrangementId}
                onChange={(event) => setArrangementId(event.target.value)}
                className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              >
                <option value="">None</option>
                {contact.arrangements.map((arrangement) => (
                  <option key={arrangement.id} value={arrangement.id}>
                    {formatZAR(arrangement.expectedAmount)} {frequencyLabel(arrangement.frequency)} ({frequencyLabel(arrangement.status)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!contact || submitting}
              className="inline-flex items-center gap-1.5 rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>{contact?.conversationId ? 'Open conversation' : 'Start conversation'}</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
