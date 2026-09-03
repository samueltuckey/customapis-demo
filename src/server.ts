/**
 * A live demo of tenant isolation that is derived, not configured.
 *
 * **Tenant safety is not something this application implements.** It is derived from the
 * schema — the foreign keys you already have. Configuring the framework is the list
 * below, and nothing in it mentions a tenant filter:
 *
 *   1. Connect a database
 *   2. Plug in identity           — verify a credential (a JWT, a session, an API key)
 *   3. Plug in access management  — where each permission is held
 *   4. Plug in publishing         — OPTIONAL; the publisher is no-op by default
 *   5. Register your routes       — one line per acceptable route
 *
 * Read the config object below and note what is NOT in it.
 */

import express from 'express';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Sequelize } from 'sequelize';
import { createFramework, type PgrmFramework } from 'pgrm';

import { defineModels } from './model/index.js';
import { registerRoutes } from './routes/index.js';
import { healthCheck } from './routes/health.js';
import { openApiDoc, humanDocs, llmsTxt } from './routes/docs.js';
import { openCors } from './cors.js';
import { getIdentityUser } from './plugins/getIdentityUser.js';
import { getAppUser } from './plugins/getAppUser.js';
import { createPublisher } from './plugins/publisher.js';
import { attachLiveEvents, LIVE_EVENTS_PATH } from './demo/websocket.js';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://demo:demo@localhost:55432/customapis_demo';
const PORT = Number(process.env.PORT ?? 3000);
/** What the docs tell an agent to call. Overridden in the deployed environment. */
const BASE_URL = process.env.DEMO_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

/**
 * Build the framework, un-booted. One definition, three consumers: the CLI (via
 * `pgrm.config.ts`), the server below, and the test harnesses.
 */
export function buildFramework(): PgrmFramework {
  const sequelize = new Sequelize(DATABASE_URL, { dialect: 'postgres', logging: false });
  defineModels(sequelize);

  const framework = createFramework({
    sequelize,
    app: 'customapis',

    // ── Tenancy ──────────────────────────────────────────────────────────────────
    // The tenant root and the column that reaches it directly. Everything else finds its
    // way to a company by the foreign keys already in the schema — a timesheet is four
    // joins away, and no route mentions that.
    tenancy: {
      rootModel: 'organisations',
      // The COLUMN, not a field name: the caller-facing SEARCH selector is derived from it.
      idColumn: 'organisation_id',
    },

    // ── Auth, in ONE section ─────────────────────────────────────────────────────
    // Verification runs on every request and is never cached; resolution runs once behind
    // the verified subject and never sees a credential. Both doc projections derive their
    // auth description from the two keys below, so they cannot disagree.
    auth: {
      getIdentityUser,
      getAppUser,
      credential: { kind: 'http', scheme: 'bearer' },
      howToObtainCredentialsDescription:
        'Keys are public — `GET /keys` returns one per persona, no signup — and rotate ' +
        'every 2 hours on clock-aligned boundaries, with a 15-minute grace for the ' +
        'previous set. A 401 means the key aged out: fetch `/keys` again.',
    },

    // ── House defaults ───────────────────────────────────────────────────────────
    // SEARCH paging for every list route; a route's own `paging` merges over this field by
    // field. A COUNT over a public sandbox is a free DoS lever, hence no total count.
    defaults: { paging: { defaultLimit: 25, maxLimit: 100, includeTotalCount: false } },

    // ── Audit ────────────────────────────────────────────────────────────────────
    // There is no audit section, and that is the configuration. `audit_log` is in model
    // space — which is what lets `GET /activity` be an ordinary search route — because this
    // deployment uses the shipped sink. Registration is not exposure: `/activity` is
    // reachable only because `activity.ts` declares a route on the model.

    // ── Events ───────────────────────────────────────────────────────────────────
    // No-op by default. This implements the same interface for the demo — a table and a
    // socket where yours would shape events for your broker. `ctx.emit(...)` is unchanged.
    events: { publisher: createPublisher(sequelize) },
  });

  registerRoutes(framework);
  return framework;
}

/**
 * Mount the whole HTTP surface onto an Express app. Exported so the harnesses drive the
 * SAME app this serves — a harness that assembles its own is testing an application
 * nobody ships.
 */
export function createApp(framework: PgrmFramework): express.Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(openCors());
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  // pgrm sends `no-store` on everything its router serves. These two are Express handlers
  // ahead of it, and both doc projections vary by `?key=` and by the bearer header — a CDN
  // keyed on the path alone serves one visitor's permission-filtered spec to the next.
  app.use(['/openapi.json', '/docs.md'], (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Express handlers, not pgrm routes: an OpenAPI document wrapped in `{ data, meta }` is
  // not one any tool will read. Mounted before the router, which ends in its own 404.
  app.get('/health', healthCheck(framework));
  app.get('/openapi.json', openApiDoc(framework));
  app.get('/docs.md', humanDocs(framework));
  app.get('/llms.txt', llmsTxt(() => BASE_URL));

  // No global `express.json()` — pgrm parses per route, so it can enforce a body-size
  // limit and keep the untouched original for the audit trail.
  app.use(framework.router);

  return app;
}

async function main(): Promise<void> {
  const framework = buildFramework();
  await framework.boot();

  const app = createApp(framework);
  const server = createServer(app);
  const live = attachLiveEvents(server);

  server.listen(PORT, () => {
    console.log(`customapis demo listening on :${PORT}  (live events: ${LIVE_EVENTS_PATH})`);
  });

  /**
   * Event publishing and deferred audit run OFF the response path, so exiting without
   * draining loses whatever is in flight — on every ordinary deploy, not just crashes.
   */
  async function shutdown(): Promise<void> {
    console.log(`shutting down (${live.connections()} live subscriber(s))`);
    await new Promise((resolve) => server.close(resolve));
    await framework.flushBackgroundWork();
    await framework.getRegistry().runtime.getSequelize().close();
    process.exit(0);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Listen only when this file IS the entry point: `pgrm.config.ts` imports
// `buildFramework` from here, and the CLI must not start a server by loading it.
const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) void main();
