/**
 * Open CORS, deliberately — the demo wants strangers calling it from a browser. A real
 * API names its origins; this one cannot know them.
 *
 * `Access-Control-Expose-Headers` is the line that matters. Browsers hide all but a
 * handful of response headers from JavaScript, so without it a browser client cannot read
 * `x-api-request-id` and cannot correlate a request against the audit trail. Curl users
 * would never notice; every browser user would.
 *
 * DEMO-ONLY: `Access-Control-Allow-Origin: *` on an API that mutates state. Safe here
 * because every key is public and every row is synthetic.
 */

import type { RequestHandler } from 'express';

export function openCors(): RequestHandler {
  return (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Request-Id');
    // Never `Access-Control-Allow-Credentials`: incompatible with `*`, and this API
    // authenticates by header rather than cookie. `date` is exposed because it is the
    // server's clock — anything counting down to a key rotation needs it, since the
    // visitor's own clock may be wrong by hours.
    res.setHeader('Access-Control-Expose-Headers', 'x-api-request-id, x-request-id, date');

    // Preflight is answered here, ahead of the framework's router.
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  };
}
