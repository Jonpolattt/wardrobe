'use client';

import { usePresence } from '@/lib/hooks/use-presence';

// Renders nothing — just keeps a presence WebSocket connection open for
// as long as this tab is on the site. Mounted once in the root Providers
// so EVERY visitor (not just admins viewing the dashboard) is counted.
// Previously `usePresence()` was only called from the admin dashboard
// page, so the "online now" counter only ever reflected how many admin
// tabs were open, not real site traffic — that's why it looked stuck at 1.
export function PresenceBeacon() {
  usePresence();
  return null;
}
