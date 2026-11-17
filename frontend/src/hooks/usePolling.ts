import { useEffect, useRef } from 'react';

// Calls `callback` every `intervalMs` while the component is mounted, the tab is visible and `enabled`
// is true, and once more when the tab becomes visible again. Leaving the page unmounts the component,
// which stops the timer. Polling is the whole transport today; a WebSocket client could replace it by
// calling the same refresh functions when the server pushes an event.
export function usePolling(callback: () => void | Promise<void>, intervalMs: number, enabled = true): void {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') void latest.current();
    };
    const timer = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs, enabled]);
}
