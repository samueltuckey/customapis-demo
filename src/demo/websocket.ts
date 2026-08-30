/**
 * ═══════════════════════════════════════════════════════════════════════════════════
 * DEMO-ONLY. Exists to make one thing visible: an event reaches a subscriber only AFTER
 * the transaction that produced it has committed.
 *
 *   **Every event is broadcast to every listener, with no tenant filter.** The framework
 *   scopes queries against a *caller*; a broadcast socket has no caller, so nothing
 *   scopes it. Safe here — one shared sandbox, synthetic data, public keys — and a
 *   tenant breach anywhere else.
 *
 * Also: listeners live in a Set on one node, so a restart loses them and a second node
 * never sees the first's events; there is no ack, retry or dead-letter path; and a failed
 * publish is swallowed. See `./publisher.ts`.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { subscribe, listenerCount } from '../plugins/publisher.js';

export const LIVE_EVENTS_PATH = '/events/live';

/** Attach the live-event socket to an existing HTTP server. */
export function attachLiveEvents(server: Server): { connections: () => number } {
  const wss = new WebSocketServer({ server, path: LIVE_EVENTS_PATH });

  wss.on('connection', (socket) => {
    const unsubscribe = subscribe((payload) => socket.send(payload));
    socket.on('close', unsubscribe);
    socket.on('error', unsubscribe);
  });

  return { connections: listenerCount };
}
