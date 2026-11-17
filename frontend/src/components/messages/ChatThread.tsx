import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCheck, Loader2, Lock, Send } from 'lucide-react';
import { usePolling } from '../../hooks/usePolling';
import { messageApi } from '../../services/messageApi';
import { ChatMessage, ConversationSummary } from '../../types/messages';
import { formatMessageDay, formatMessageTime, messageDayKey } from '../../utils/format';
import { Avatar } from './Avatar';

const MAX_LENGTH = 2000;
const THREAD_POLL_MS = 5000;
const NEAR_BOTTOM_PX = 96;

interface ChatThreadProps {
  conversation: ConversationSummary;
  currentUserId: string;
  // Called after anything that changes unread counts or the latest message, so the list and badges refresh.
  onActivity: () => void;
  onBack: () => void;
}

// Keeps older pages the user already loaded when the latest page is refreshed by polling.
function mergeLatest(previous: ChatMessage[], latest: ChatMessage[]): ChatMessage[] {
  if (!latest.length) return previous.length ? previous : latest;
  const ids = new Set(latest.map((message) => message.id));
  const older = previous.filter((message) => message.createdAt < latest[0].createdAt && !ids.has(message.id));
  return [...older, ...latest];
}

export function ChatThread({ conversation, currentUserId, onActivity, onBack }: ChatThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const activeId = useRef(conversation.id);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const olderAnchor = useRef<number | null>(null);

  const isParentView = currentUserId === conversation.parent.id;
  const otherParty = isParentView ? conversation.socialWorker : conversation.parent;
  const otherRole = isParentView ? 'Social worker' : 'Parent / caregiver';
  const hasIncomingUnread = messages.some((message) => message.senderId !== currentUserId && !message.isRead);

  const markRead = useCallback(async () => {
    const id = conversation.id;
    try {
      await messageApi.markConversationRead(id);
      if (activeId.current !== id) return;
      const readAt = new Date().toISOString();
      setMessages((previous) => previous.map((message) =>
        message.senderId !== currentUserId && !message.isRead ? { ...message, isRead: true, readAt } : message));
      onActivity();
    } catch {
      // The next poll tries again.
    }
  }, [conversation.id, currentUserId, onActivity]);

  const loadLatest = useCallback(async (initial: boolean) => {
    const id = conversation.id;
    try {
      const page = await messageApi.messages(id);
      if (activeId.current !== id) return;
      setMessages((previous) => (initial ? page.messages : mergeLatest(previous, page.messages)));
      if (initial) setHasMore(page.hasMore);
      setError(null);
      const unread = page.messages.some((message) => message.senderId !== currentUserId && !message.isRead);
      if (unread && document.visibilityState === 'visible') void markRead();
    } catch (err) {
      if (activeId.current === id && initial) {
        setError(err instanceof Error ? err.message : 'Unable to load this conversation.');
      }
    } finally {
      if (activeId.current === id) setLoading(false);
    }
  }, [conversation.id, currentUserId, markRead]);

  useEffect(() => {
    activeId.current = conversation.id;
    stickToBottom.current = true;
    olderAnchor.current = null;
    setMessages([]);
    setHasMore(false);
    setLoading(true);
    setError(null);
    setDraft('');
    setSendError(null);
    void loadLatest(true);
    // Only a different conversation resets the thread.
  }, [conversation.id]);

  usePolling(() => loadLatest(false), THREAD_POLL_MS);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    if (olderAnchor.current !== null) {
      element.scrollTop = element.scrollHeight - olderAnchor.current;
      olderAnchor.current = null;
    } else if (stickToBottom.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, loading]);

  const handleScroll = () => {
    const element = scroller.current;
    if (!element) return;
    stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
  };

  const loadOlder = async () => {
    const oldest = messages[0];
    const element = scroller.current;
    if (!oldest || !element || loadingOlder) return;
    const id = conversation.id;
    setLoadingOlder(true);
    try {
      const page = await messageApi.messages(id, oldest.id);
      if (activeId.current !== id) return;
      olderAnchor.current = element.scrollHeight - element.scrollTop;
      setMessages((previous) => {
        const known = new Set(previous.map((message) => message.id));
        return [...page.messages.filter((message) => !known.has(message.id)), ...previous];
      });
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load earlier messages.');
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !conversation.canSend) return;
    const id = conversation.id;
    setSending(true);
    setSendError(null);
    try {
      const sent = await messageApi.send(id, text);
      if (activeId.current !== id) return;
      stickToBottom.current = true;
      setMessages((previous) => (previous.some((message) => message.id === sent.id) ? previous : [...previous, sent]));
      setDraft('');
      onActivity();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Your message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="-ml-1 rounded-sm p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar name={otherParty.fullName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#0F2942]">{otherParty.fullName}</p>
          <p className="truncate text-xs text-slate-500">{otherRole} · about {conversation.childName}</p>
        </div>
        {hasIncomingUnread && (
          <button
            type="button"
            onClick={() => void markRead()}
            className="shrink-0 rounded-sm border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Mark as read
          </button>
        )}
      </header>

      <div
        ref={scroller}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label={`Messages with ${otherParty.fullName}`}
        className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-3 py-4 sm:px-5"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Loading messages…</span>
          </div>
        ) : error && messages.length === 0 ? (
          <div role="alert" className="mx-auto max-w-sm rounded-sm border border-red-200 bg-red-50 p-3 text-center text-sm text-red-800">
            {error}{' '}
            <button type="button" onClick={() => { setLoading(true); void loadLatest(true); }} className="font-semibold underline">
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-semibold text-[#0F2942]">No messages yet</p>
            <p className="mt-1 max-w-xs text-sm text-slate-600">
              {conversation.canSend
                ? `Say hello to ${otherParty.fullName} to get the conversation started.`
                : 'This conversation has no messages.'}
            </p>
          </div>
        ) : (
          <ol className="space-y-1.5">
            {hasMore && (
              <li className="pb-2 text-center">
                <button
                  type="button"
                  onClick={() => void loadOlder()}
                  disabled={loadingOlder}
                  className="rounded-sm border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {loadingOlder ? 'Loading…' : 'Load earlier messages'}
                </button>
              </li>
            )}
            {messages.map((message, index) => {
              const mine = message.senderId === currentUserId;
              const newDay = index === 0 || messageDayKey(messages[index - 1].createdAt) !== messageDayKey(message.createdAt);
              return (
                <React.Fragment key={message.id}>
                  {newDay && (
                    <li className="flex justify-center py-2">
                      <span className="rounded-sm bg-slate-200/70 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {formatMessageDay(message.createdAt)}
                      </span>
                    </li>
                  )}
                  <li className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-md px-3 py-2 text-sm shadow-sm sm:max-w-[70%] ${
                        mine ? 'bg-[#0F2942] text-white' : 'border border-slate-200 bg-white text-slate-800'
                      }`}
                    >
                      {/* Rendered as plain text, never as HTML. */}
                      <p className="whitespace-pre-wrap break-words">{message.message}</p>
                      <p className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${mine ? 'text-slate-300' : 'text-slate-500'}`}>
                        <span>{formatMessageTime(message.createdAt)}</span>
                        {mine && (message.isRead ? (
                          <span
                            className="inline-flex items-center gap-0.5 text-emerald-300"
                            title={message.readAt ? `Read ${formatMessageDay(message.readAt)} at ${formatMessageTime(message.readAt)}` : 'Read'}
                          >
                            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Read</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5">
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Sent</span>
                          </span>
                        ))}
                      </p>
                    </div>
                  </li>
                </React.Fragment>
              );
            })}
          </ol>
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white p-3">
        {conversation.canSend ? (
          <>
            {sendError && (
              <p role="alert" className="mb-2 rounded-sm border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800">
                {sendError}
              </p>
            )}
            <div className="flex items-end gap-2">
              <label htmlFor="message-input" className="sr-only">Message</label>
              <textarea
                id="message-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={MAX_LENGTH}
                rows={2}
                placeholder={`Write a message to ${otherParty.fullName}`}
                className="block max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !draft.trim()}
                className="inline-flex h-11 items-center gap-1.5 rounded-sm bg-[#006847] px-4 text-sm font-medium text-white hover:bg-[#005238] disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                <span>Send</span>
              </button>
            </div>
            <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-[11px] text-slate-500">
              <span>Private between you and {otherParty.fullName}. Never share passwords, PINs or ID numbers here.</span>
              {draft.length > MAX_LENGTH - 200 && <span>{draft.length}/{MAX_LENGTH}</span>}
            </p>
          </>
        ) : (
          <p className="flex items-start gap-2 text-sm text-slate-600">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <span>
              This conversation is read-only because {conversation.socialWorker.fullName} is no longer assigned to this child.
              Earlier messages are kept.
            </span>
          </p>
        )}
      </footer>
    </div>
  );
}
