/**
 * Step one of authentication: **verify the credential**.
 *
 * Extraction and verification together — where the credential lives and how it is proven
 * are both the application's business. Runs on every request and is never cached, so an
 * expired credential stops working when it expires. No database, no persona lookup, no
 * permissions: it answers whether this credential is genuine and whose it is, and the
 * answer is a subject string, not a user. Resolving that to a local user is `getAppUser`.
 *
 * DEMO-ONLY: an HMAC of a published secret over a two-hour window, served to anyone.
 */

import type { GetIdentityUser, IdentityResult } from 'pgrm';
import { verifyKey } from '../demo/keys.js';

export const getIdentityUser: GetIdentityUser = (ctx): IdentityResult => {
  const presented = readBearer(ctx.originalRequestHttp?.headers as Record<string, unknown>);
  const result = verifyKey(presented);

  if ('reason' in result) {
    // `detail` is log-only and never reaches the response. The framework records the
    // reason on the completion line, so an operator can alert on a spike in `expired`
    // separately from `invalid_signature`, while the caller still gets a uniform 401.
    return { failure: { reason: result.reason, detail: result.detail } };
  }

  return {
    identity: {
      provider: 'demo-keys',
      // The persona name, not a user id — resolving to a local user is the next seam's job.
      subject: result.persona,
      // Set by the verifier, never inferred downstream: only what minted the credential
      // knows what kind of principal it was for.
      kind: 'human',
    },
  };
};

function readBearer(headers: Record<string, unknown> | undefined): string | null {
  const raw = headers?.['authorization'];
  if (typeof raw !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match ? match[1]! : null;
}
