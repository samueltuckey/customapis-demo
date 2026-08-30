/**
 * `GET /health` — the load balancer's question, and the one route that is NOT a pgrm
 * route. Plain Express middleware on purpose: a load balancer reads a status code, not a
 * body, and this is mounted BEFORE the framework's router.
 *
 * It touches the database, because a check that only proves Node is running will keep a
 * deployment with a dead connection pool in rotation. It stays a `SELECT 1`: a health
 * check that does real work can take the service down under load.
 */

import type { RequestHandler } from 'express';
import type { PgrmFramework } from 'pgrm';

export function healthCheck(framework: PgrmFramework): RequestHandler {
  return async (_req, res) => {
    try {
      await framework.getRegistry().runtime.getSequelize().query('SELECT 1');
      res.status(200).send('ok');
    } catch {
      res.status(503).send('database unavailable');
    }
  };
}
