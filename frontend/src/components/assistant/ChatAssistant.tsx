import React, { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, MessageCircle, Minus, RotateCcw, Send, Trash2, X } from 'lucide-react';
import {
  ASSISTANT_NAME,
  ASSISTANT_WELCOME,
  MAX_HISTORY,
  MAX_QUESTION_LENGTH,
  SUGGESTED_QUESTIONS,
} from '../../config/assistant';
import { AssistantMessage, askAssistant } from '../../services/assistantApi';
import { MessageText } from './MessageText';

type View = 'closed' | 'open' | 'minimised';

// Floating assistant shown on the public pages. The conversation lives in memory while the visitor
// browses the public pages; it is never saved, and closing the page ends it.
export function ChatAssistant() {
  const [view, setView] = useState<View>('closed');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const request = useRef(0);

  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, loading, error, view]);

  useEffect(() => {
    if (view === 'open') input.current?.focus();
  }, [view]);

  useEffect(() => {
    if (view !== 'open') return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setView('minimised');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [view]);

  const ask = async (history: AssistantMessage[]) => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const reply = await askAssistant(history.slice(-MAX_HISTORY));
      if (id !== request.current) return;
      setMessages([...history, { role: 'assistant', content: reply }]);
    } catch (failure) {
      if (id !== request.current) return;
      setError(failure instanceof Error ? failure.message : 'The assistant could not answer right now.');
    } finally {
      if (id === request.current) setLoading(false);
    }
  };

  const send = (text: string) => {
    const question = text.trim();
    if (!question || loading) return;
    const history: AssistantMessage[] = [...messages, { role: 'user', content: question }];
    setMessages(history);
    setDraft('');
    void ask(history);
  };

  const retry = () => {
    if (!loading && messages.length && messages[messages.length - 1].role === 'user') void ask(messages);
  };

  const clear = () => {
    request.current += 1;
    setMessages([]);
    setError(null);
    setLoading(false);
    setDraft('');
    input.current?.focus();
  };

  const closeWindow = () => {
    setView('closed');
    window.setTimeout(() => launcher.current?.focus(), 0);
  };

  // On phones the chat covers the page, so following a link tucks it away to show the page.
  const handleNavigate = () => {
    if (window.matchMedia('(max-width: 639px)').matches) setView('minimised');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(draft);
    }
  };

  if (view === 'closed') {
    return (
      <button
        ref={launcher}
        type="button"
        onClick={() => setView('open')}
        aria-label={`Open ${ASSISTANT_NAME}`}
        className="no-print fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[#006847] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#005238] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2942] focus-visible:ring-offset-2 sm:bottom-6 sm:right-6"
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
        <span className="hidden sm:inline">Ask our assistant</span>
      </button>
    );
  }

  const minimised = view === 'minimised';
  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === 'user';

  return (
    <section
      role="dialog"
      aria-label={ASSISTANT_NAME}
      className={`no-print fixed bottom-0 right-0 z-40 flex w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl sm:bottom-6 sm:right-6 sm:w-[24rem] sm:rounded-lg ${
        minimised ? '' : 'h-[min(36rem,calc(100dvh-4rem))] rounded-t-lg sm:h-[min(36rem,calc(100dvh-3rem))]'
      }`}
    >
      <header className="flex items-center gap-3 bg-[#0F2942] px-4 py-3 text-white">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15" aria-hidden="true">
          <Bot className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-sm font-semibold">{ASSISTANT_NAME}</h2>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            Here to help
          </p>
        </div>
        {!minimised && messages.length > 0 && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear conversation"
            title="Clear conversation"
            className="rounded-sm p-1.5 text-slate-200 hover:bg-white/10 hover:text-white"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setView(minimised ? 'open' : 'minimised')}
          aria-label={minimised ? 'Expand chat' : 'Minimise chat'}
          title={minimised ? 'Expand' : 'Minimise'}
          className="rounded-sm p-1.5 text-slate-200 hover:bg-white/10 hover:text-white"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={closeWindow}
          aria-label="Close chat"
          title="Close"
          className="rounded-sm p-1.5 text-slate-200 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {!minimised && (
        <>
          <div
            ref={scroller}
            role="log"
            aria-live="polite"
            aria-label="Conversation"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4"
          >
            <Bubble role="assistant">
              <MessageText text={ASSISTANT_WELCOME} onNavigate={handleNavigate} />
            </Bubble>

            {messages.length === 0 && (
              <div className="pt-1">
                <p className="mb-2 text-xs font-medium text-slate-600">Suggested questions</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => send(question)}
                      disabled={loading}
                      className="rounded-full border border-[#006847]/30 bg-white px-3 py-1.5 text-left text-xs font-medium text-[#0F2942] transition-colors hover:border-[#006847] hover:bg-emerald-50 disabled:opacity-60"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <Bubble key={index} role={message.role}>
                <MessageText text={message.content} onNavigate={handleNavigate} />
              </Bubble>
            ))}

            {loading && (
              <Bubble role="assistant">
                <span className="inline-flex items-center gap-2 text-slate-600" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Thinking…
                </span>
              </Bubble>
            )}

            {error && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                <p>{error}</p>
                {lastIsUser && (
                  <button
                    type="button"
                    onClick={retry}
                    className="mt-1.5 inline-flex items-center gap-1 font-semibold underline"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    Try again
                  </button>
                )}
              </div>
            )}
          </div>

          <footer className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2">
              <label htmlFor="assistant-input" className="sr-only">Type your question</label>
              <textarea
                id="assistant-input"
                ref={input}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={MAX_QUESTION_LENGTH}
                rows={1}
                placeholder="Type your question…"
                className="block max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => send(draft)}
                disabled={loading || !draft.trim()}
                aria-label="Send message"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#006847] text-white transition-colors hover:bg-[#005238] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
              Please don't type ID numbers, passwords or bank details. I can't see your account, and I'm not legal advice.
            </p>
          </footer>
        </>
      )}
    </section>
  );
}

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  const mine = role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] space-y-1 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
          mine
            ? 'rounded-br-sm bg-[#0F2942] text-white'
            : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
