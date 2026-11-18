import { apiFetch } from './apiClient';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

// The browser only ever talks to our own backend. The OpenAI key lives on the server and is never sent here.
export async function askAssistant(messages: AssistantMessage[]): Promise<string> {
  const response = await apiFetch('/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
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
      : 'The assistant could not answer right now. Please try again.';
    throw new Error(message);
  }
  if (!body || typeof body !== 'object' || !('reply' in body) || typeof body.reply !== 'string') {
    throw new Error('The assistant sent an unexpected answer. Please try again.');
  }
  return body.reply;
}
