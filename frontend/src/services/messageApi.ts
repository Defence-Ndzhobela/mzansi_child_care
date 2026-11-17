import {
  ChatMessage,
  ConversationFilters,
  ConversationSummary,
  MessageContact,
  UnreadSummary,
} from '../types/messages';
import { apiFetch } from './apiClient';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(`/messages${path}`, {
    ...init,
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : 'The request could not be completed.';
    throw new Error(message);
  }
  return body as T;
}

// Every call goes through the session cookie to /api/messages. The server decides who may see or send
// what; the conversation, parent and worker IDs sent here are only ever looked up, never trusted.
export const messageApi = {
  unread: () => request<UnreadSummary>('/unread-count'),

  contacts: () => request<{ contacts: MessageContact[] }>('/contacts').then((r) => r.contacts),

  conversations: (filters: ConversationFilters = {}) => {
    const query = new URLSearchParams();
    if (filters.search) query.set('search', filters.search);
    if (filters.childId) query.set('childId', filters.childId);
    if (filters.unreadOnly) query.set('unread', 'true');
    const text = query.toString();
    return request<{ conversations: ConversationSummary[] }>(`/conversations${text ? `?${text}` : ''}`)
      .then((r) => r.conversations);
  },

  conversation: (conversationId: string) =>
    request<{ conversation: ConversationSummary }>(`/conversations/${conversationId}`).then((r) => r.conversation),

  startConversation: (input: { childId: string; parentUserId?: string; arrangementId?: string }) =>
    request<{ conversation: ConversationSummary }>('/conversations', { method: 'POST', body: JSON.stringify(input) })
      .then((r) => r.conversation),

  messages: (conversationId: string, before?: string) =>
    request<{ messages: ChatMessage[]; hasMore: boolean }>(
      `/conversations/${conversationId}/messages${before ? `?before=${before}` : ''}`,
    ),

  send: (conversationId: string, message: string) =>
    request<{ message: ChatMessage }>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }).then((r) => r.message),

  markConversationRead: (conversationId: string) =>
    request<{ updated: number }>(`/conversations/${conversationId}/read`, { method: 'PATCH' }),
};
