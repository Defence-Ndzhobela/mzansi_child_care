import { Loader2, Search } from 'lucide-react';
import { ConversationSummary } from '../../types/messages';
import { formatConversationTime } from '../../utils/format';
import { Avatar } from './Avatar';

export interface ChildOption {
  id: string;
  name: string;
}

interface ConversationListProps {
  conversations: ConversationSummary[];
  currentUserId: string;
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (conversation: ConversationSummary) => void;
  search: string;
  onSearchChange: (value: string) => void;
  childOptions: ChildOption[];
  childId: string;
  onChildChange: (value: string) => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (value: boolean) => void;
  filtering: boolean;
}

export function ConversationList({
  conversations,
  currentUserId,
  selectedId,
  loading,
  error,
  onRetry,
  onSelect,
  search,
  onSearchChange,
  childOptions,
  childId,
  onChildChange,
  unreadOnly,
  onUnreadOnlyChange,
  filtering,
}: ConversationListProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-slate-200 p-3">
        <div className="relative">
          <label htmlFor="conversation-search" className="sr-only">Search conversations</label>
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            id="conversation-search"
            type="search"
            value={search}
            maxLength={100}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search name, child or message"
            className="block w-full rounded-sm border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          {childOptions.length > 1 && (
            <>
              <label htmlFor="conversation-child" className="sr-only">Filter by child</label>
              <select
                id="conversation-child"
                value={childId}
                onChange={(event) => onChildChange(event.target.value)}
                className="min-w-0 flex-1 rounded-sm border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-[#006847] focus:outline-none"
              >
                <option value="">All children</option>
                {childOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </>
          )}
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => onUnreadOnlyChange(event.target.checked)}
              className="h-3.5 w-3.5 accent-[#006847]"
            />
            Unread only
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Loading conversations…</span>
          </div>
        ) : error ? (
          <p role="alert" className="m-3 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}{' '}
            <button type="button" onClick={onRetry} className="font-semibold underline">Retry</button>
          </p>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-[#0F2942]">
              {filtering ? 'No matching conversations' : 'No conversations yet'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {filtering
                ? 'Try a different search or clear the filters.'
                : 'Use New conversation to send the first message.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {conversations.map((conversation) => {
              const isParentView = currentUserId === conversation.parent.id;
              const other = isParentView ? conversation.socialWorker : conversation.parent;
              const selected = conversation.id === selectedId;
              const last = conversation.lastMessage;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation)}
                    aria-current={selected ? 'true' : undefined}
                    className={`flex w-full items-start gap-3 px-3 py-3 text-left transition-colors ${
                      selected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <Avatar name={other.fullName} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm ${conversation.unreadCount ? 'font-bold' : 'font-semibold'} text-[#0F2942]`}>
                          {other.fullName}
                        </span>
                        {last && (
                          <span className="shrink-0 text-[11px] text-slate-500">{formatConversationTime(last.createdAt)}</span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {conversation.childName}{!conversation.canSend ? ' · read-only' : ''}
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${conversation.unreadCount ? 'font-medium text-slate-900' : 'text-slate-600'}`}>
                          {last ? `${last.senderId === currentUserId ? 'You: ' : ''}${last.preview}` : 'No messages yet'}
                        </span>
                        {conversation.unreadCount > 0 && (
                          <span
                            className="shrink-0 rounded-full bg-[#006847] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white tabular-nums"
                            aria-label={`${conversation.unreadCount} unread`}
                          >
                            {conversation.unreadCount}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
