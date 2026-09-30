'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createElement } from 'react';

const PresenceContext = createContext<number | null>(null);

// One id per browser tab, kept only in memory for the life of the tab —
// this is not a login/tracking id, it just lets the backend tell "same
// tab pinging again" apart from "a different tab/visitor" when counting
// how many are currently online.
function makeClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Shares the site-wide "online users" count via context, refreshed by
 * heartbeat polling.
 *
 * This used to open a raw WebSocket straight to the backend
 * (ws://.../ws/presence), but that never worked reliably here: Next.js's
 * dev-mode `rewrites()` only proxy plain HTTP, not WebSocket upgrade
 * requests, so the socket had to hit the backend on a hardcoded
 * NEXT_PUBLIC_WS_PRESENCE_URL — which kept pointing at a dead/unreachable
 * address on this Windows setup (the same "localhost resolves to two
 * different things" issue that broke other connections), so the counter
 * silently stayed stuck at null forever. The fix mirrors what the review
 * section already switched to: instead of a live push connection, this
 * tab "checks in" every 20s via a plain POST (proxied through the normal
 * /presence/* rewrite, exactly like /graphql and /upload already are —
 * no separate env var needed), and separately polls the current count
 * every 20s. A dropped tab simply stops renewing its heartbeat and ages
 * out of the count within ~45s.
 */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const clientIdRef = useRef<string>();

  useEffect(() => {
    if (!clientIdRef.current) clientIdRef.current = makeClientId();
    const clientId = clientIdRef.current;
    let cancelled = false;

    async function beat() {
      try {
        await fetch('/presence/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId }),
          keepalive: true,
        });
      } catch {
        // A missed heartbeat just means this tab ages out a bit early on
        // the count — not worth surfacing as an error anywhere.
      }
    }

    async function refreshCount() {
      try {
        const res = await fetch('/presence/online-count');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data?.count === 'number') setOnlineCount(data.count);
      } catch {
        // Leave the last-known count showing rather than flashing to null
        // on a single failed poll.
      }
    }

    beat();
    refreshCount();
    const heartbeatTimer = setInterval(beat, 20_000);
    const pollTimer = setInterval(refreshCount, 20_000);

    return () => {
      cancelled = true;
      clearInterval(heartbeatTimer);
      clearInterval(pollTimer);
    };
  }, []);

  return createElement(PresenceContext.Provider, { value: onlineCount }, children);
}

export function usePresence() {
  return useContext(PresenceContext);
}
