/**
 * The live-event socket — an event reaches a subscriber only AFTER the transaction that
 * produced it has committed.
 *
 * DEMO-ONLY: every event is broadcast to every listener, with no tenant filter.
 *
 * The framework scopes queries against a *caller*, and a broadcast socket has no caller.
 * Safe here — one shared sandbox, synthetic data, public keys — and a tenant breach
 * anywhere else. Single node, no ack, no retry, failures swallowed: see `./publisher.ts`.
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
