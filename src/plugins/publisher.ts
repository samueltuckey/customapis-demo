/**
 * The event transport seam — a real implementation of pgrm's `Publisher`.
 *
 * The publisher is no-op by default, so `ctx.emit(...)` in a route is the same call whether
 * events go nowhere, to this table and socket, or to Kafka. Shaping them for your own system
 * is this file's job, and yours. Events drain AFTER the transaction commits, so nothing here
 * can publish a change that rolled back.
 *
 * Valid, not exemplary: the transport below is sized for a demo, and says so.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * DEMO-ONLY — DOES NOT SCALE, AND ONE PART IS UNSAFE. Four reasons, worst first:
 *
 * 1. EVERY EVENT IS BROADCAST TO EVERY LISTENER, WITH NO TENANT FILTER. The framework
 *    scopes *queries*, against a caller; a fan-out socket has no caller. Acceptable here
 *    — synthetic data, public keys, one shared sandbox — and a tenant breach anywhere
 *    else. A real subscriber authenticates and the transport filters per subscription.
 *
 * 2. THE SOCKET IS IN-PROCESS. Listeners live in a Set on one node, so a restart loses
 *    them and a second node sees only its own events. No delivery guarantee, no retry,
 *    no acknowledgement, no dead-letter path.
 *
 * 3. RETENTION IS A DELETE PER WRITE — a second statement on every event. A real system
 *    partitions by time, or lets the broker own retention and keeps no table at all.
 *
 * 4. DELIVERY IS BEST-EFFORT AND FAILURES ARE SWALLOWED. A publish that throws must not
 *    fail the request that caused it, since the write is already committed — so an event
 *    can be lost with nobody downstream knowing. The durable answer is a transactional
 *    outbox.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

import type { Sequelize } from 'sequelize';
import { QueryTypes } from 'sequelize';
import type { Event, Publisher } from 'pgrm';

/** Rows kept in `demo_events`. Small on purpose — this is a window, not a log. */
const KEEP_ROWS = 200;

type Listener = (payload: string) => void;
const listeners = new Set<Listener>();

/** Subscribe a connected socket. Returns the unsubscribe. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function listenerCount(): number {
  return listeners.size;
}

/** The connection the publisher was built with, so the read side need not reach into
 *  framework internals for one. */
let connection: Sequelize | undefined;

/** Most recent events, newest first. Throws if the publisher was never created: an empty
 *  list would be indistinguishable from "no events have happened". */
export async function readRecentEvents(limit = 50): Promise<Array<Record<string, unknown>>> {
  if (!connection) throw new Error('demo publisher was never created; no connection to read from');
  return (await connection.query(
    // `correlationId` is selected so the backfill matches the socket field for field. A
    // client correlating an event to its own request must get the same answer whether the
    // event arrived live or was read back after a reload.
    `SELECT event_type AS "eventType", model, tenant_id AS "tenantId",
            object_data AS "objectData", correlation_id AS "correlationId",
            emitted_at AS "emittedAt"
       FROM demo_events ORDER BY emitted_at DESC, id DESC LIMIT $1`,
    { bind: [limit], type: QueryTypes.SELECT },
  )) as Array<Record<string, unknown>>;
}

export function createPublisher(sequelize: Sequelize): Publisher {
  connection = sequelize;
  return {
    async publish(event: Event): Promise<void> {
      const record = {
        eventType: event.eventType,
        model: event.model,
        tenantId: event.tenantId === null ? null : String(event.tenantId),
        objectData: event.objectData,
        emittedAt: new Date(event.epochTimestamp).toISOString(),
        // `ctx.requestId`, which is also the `x-api-request-id` response header and the
        // audit row's `correlationId`. Without it a subscriber can only guess which call
        // produced an event — matching on row id and timing, which is a guess dressed as
        // a fact. With it, a client that made a request can prove the event is its own.
        correlationId: event.correlationId,
      };

      // Reason 1 above: no filtering, in a sandbox where everything is public.
      const payload = JSON.stringify(record);
      for (const listener of listeners) {
        try {
          listener(payload);
        } catch {
          /* a dead socket must not take the others down with it */
        }
      }

      try {
        await sequelize.query(
          `INSERT INTO demo_events
             (event_type, model, tenant_id, object_data, correlation_id, emitted_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          {
            bind: [
              record.eventType,
              record.model,
              record.tenantId,
              JSON.stringify(record.objectData ?? null),
              // The column has been here since the schema was written and nothing ever
              // filled it, so /events/recent answered `correlationId: null` for every row.
              // The socket carries it now, and the backfill the feed loads on arrival has
              // to agree with the socket or the same event correlates one way live and
              // another way after a refresh.
              record.correlationId,
              record.emittedAt,
            ],
            type: QueryTypes.INSERT,
          },
        );
        // Reason 3 above.
        await sequelize.query(
          `DELETE FROM demo_events WHERE id NOT IN (
             SELECT id FROM demo_events ORDER BY emitted_at DESC, id DESC LIMIT ${KEEP_ROWS})`,
          { type: QueryTypes.DELETE },
        );
      } catch (err) {
        // Reason 4 above: the transaction is already committed, so the caller must not be
        // told their write failed because our bookkeeping did.
        console.error('demo publisher: event dropped', err);
      }
    },
  };
}
