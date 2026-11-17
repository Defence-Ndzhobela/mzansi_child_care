import { useCallback, useEffect, useState } from 'react';
import { messageApi } from '../services/messageApi';
import { UnreadSummary } from '../types/messages';
import { usePolling } from './usePolling';

const EMPTY_SUMMARY: UnreadSummary = { unreadCount: 0, conversations: [] };
const SUMMARY_POLL_MS = 15000;

// What dashboard pages receive from the layout through the router's outlet context.
export interface DashboardOutletContext {
  refreshMessageSummary: () => void;
}

// Unread message counts for the sidebar badge and the notification bell. Failures keep the last known
// value, so a brief network problem never blanks or breaks the dashboard.
export function useMessageSummary(enabled: boolean) {
  const [summary, setSummary] = useState<UnreadSummary>(EMPTY_SUMMARY);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setSummary(await messageApi.unread());
    } catch {
      // Keep the previous summary.
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) void refresh();
    else setSummary(EMPTY_SUMMARY);
  }, [enabled, refresh]);

  usePolling(refresh, SUMMARY_POLL_MS, enabled);

  return { summary, refresh };
}
