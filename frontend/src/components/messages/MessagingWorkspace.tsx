import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { MessageSquare, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePolling } from '../../hooks/usePolling';
import { DashboardOutletContext } from '../../hooks/useMessageSummary';
import { messageApi } from '../../services/messageApi';
import { ConversationSummary, MessageContact } from '../../types/messages';
import { ToastBanner } from '../ToastBanner';
import { Avatar } from './Avatar';
import { ChatThread } from './ChatThread';
import { ChildOption, ConversationList } from './ConversationList';
import { NewConversationModal } from './NewConversationModal';

const LIST_POLL_MS = 10000;
const SEARCH_DEBOUNCE_MS = 300;

// The one messaging screen used by both dashboards. Parents and social workers see the same layout;
// only the wording and who they can message differ, and the server decides both.
export function MessagingWorkspace() {
  const { currentUser } = useAuth();
  const { refreshMessageSummary } = useOutletContext<DashboardOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('conversation');
  const isParent = currentUser?.role === 'PARENT_CAREGIVER';

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [fetchedConversation, setFetchedConversation] = useState<ConversationSummary | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [childId, setChildId] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [contacts, setContacts] = useState<MessageContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [startingChildId, setStartingChildId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const listRequest = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadConversations = useCallback(async (initial: boolean) => {
    const request = ++listRequest.current;
    try {
      const result = await messageApi.conversations({ search, childId, unreadOnly });
      if (request !== listRequest.current) return;
      setConversations(result);
      setListError(null);
    } catch (err) {
      if (request === listRequest.current && initial) {
        setListError(err instanceof Error ? err.message : 'Unable to load conversations.');
      }
    } finally {
      if (request === listRequest.current) setListLoading(false);
    }
  }, [search, childId, unreadOnly]);

  useEffect(() => {
    setListLoading(true);
    void loadConversations(true);
  }, [loadConversations]);

  usePolling(() => loadConversations(false), LIST_POLL_MS);

  const loadContacts = useCallback(async () => {
    try {
      setContacts(await messageApi.contacts());
      setContactsError(null);
    } catch (err) {
      setContactsError(err instanceof Error ? err.message : 'Unable to load who you can message.');
    } finally {
      setContactsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const selected = conversations.find((item) => item.id === selectedId)
    ?? (fetchedConversation?.id === selectedId ? fetchedConversation : null);

  // A conversation opened from a link or notification may be outside the current filters.
  useEffect(() => {
    if (!selectedId || selected) return;
    let active = true;
    messageApi.conversation(selectedId)
      .then((conversation) => { if (active) setFetchedConversation(conversation); })
      .catch(() => {
        if (!active) return;
        setSearchParams({}, { replace: true });
        setNotice('That conversation could not be opened.');
      });
    return () => { active = false; };
  }, [selectedId, selected, setSearchParams]);

  const childOptions = useMemo<ChildOption[]>(() => {
    const options = new Map<string, string>();
    contacts.forEach((contact) => options.set(contact.childId, contact.childName));
    conversations.forEach((conversation) => options.set(conversation.childId, conversation.childName));
    return [...options].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, conversations]);

  const select = (conversation: ConversationSummary) => {
    setFetchedConversation(conversation);
    setSearchParams({ conversation: conversation.id }, { replace: true });
  };

  const handleStarted = (conversation: ConversationSummary) => {
    select(conversation);
    void loadConversations(false);
    void loadContacts();
  };

  const handleActivity = useCallback(() => {
    void loadConversations(false);
    refreshMessageSummary();
  }, [loadConversations, refreshMessageSummary]);

  const openContact = async (contact: MessageContact) => {
    setNotice(null);
    if (contact.conversationId) {
      setSearchParams({ conversation: contact.conversationId }, { replace: true });
      return;
    }
    setStartingChildId(contact.childId);
    try {
      handleStarted(await messageApi.startConversation({ childId: contact.childId }));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'The conversation could not be started.');
    } finally {
      setStartingChildId(null);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Messages</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {isParent
              ? "Send private messages to the social worker assigned to your child's case and read their replies."
              : 'Private conversations with the parents and caregivers of the children assigned to you.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setModalOpen(true); void loadContacts(); }}
          className="inline-flex items-center gap-1.5 rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>New conversation</span>
        </button>
      </div>

      {notice && <ToastBanner type="error" message={notice} onDismiss={() => setNotice(null)} />}
      {contactsError && <ToastBanner type="error" message={contactsError} onDismiss={() => setContactsError(null)} />}

      {isParent && !contactsLoading && (
        <section aria-labelledby="assigned-workers" className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <h2 id="assigned-workers" className="text-sm font-semibold text-[#0F2942]">Your assigned social worker</h2>
          {contacts.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">
              None of your children has an active social worker yet. Once one is assigned, you can message them here.
            </p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {contacts.map((contact) => (
                <li key={contact.childId} className="flex items-center gap-3 rounded-sm border border-slate-200 p-3">
                  <Avatar name={contact.socialWorker.fullName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#0F2942]">{contact.socialWorker.fullName}</p>
                    <p className="truncate text-xs text-slate-500">Assigned to {contact.childName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void openContact(contact)}
                    disabled={startingChildId === contact.childId}
                    className="shrink-0 rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-[#0F2942] hover:bg-slate-50 disabled:opacity-60"
                  >
                    {contact.conversationId ? 'Open chat' : 'Message'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="grid h-[70vh] min-h-[28rem] overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm lg:grid-cols-[21rem_minmax(0,1fr)]">
        <aside className={`${selected ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-slate-200 lg:border-r`}>
          <ConversationList
            conversations={conversations}
            currentUserId={currentUser.id}
            selectedId={selectedId}
            loading={listLoading}
            error={listError}
            onRetry={() => { setListLoading(true); void loadConversations(true); }}
            onSelect={select}
            search={searchInput}
            onSearchChange={setSearchInput}
            childOptions={childOptions}
            childId={childId}
            onChildChange={setChildId}
            unreadOnly={unreadOnly}
            onUnreadOnlyChange={setUnreadOnly}
            filtering={Boolean(search || childId || unreadOnly)}
          />
        </aside>

        <section className={`${selected ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-col`}>
          {selected ? (
            <ChatThread
              key={selected.id}
              conversation={selected}
              currentUserId={currentUser.id}
              onActivity={handleActivity}
              onBack={() => setSearchParams({}, { replace: true })}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-slate-50 p-8 text-center">
              <MessageSquare className="h-9 w-9 text-slate-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-[#0F2942]">Select a conversation</p>
              <p className="mt-1 max-w-xs text-sm text-slate-600">
                Choose a conversation on the left, or start a new one.
              </p>
            </div>
          )}
        </section>
      </div>

      <NewConversationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        isParent={Boolean(isParent)}
        contacts={contacts}
        onStarted={handleStarted}
      />
    </div>
  );
}
