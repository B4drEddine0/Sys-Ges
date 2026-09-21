// Operator-facing diagnostic: lists which proxy site keys are registered (never the
// upstream origins) so misconfigured PROXY_SITES entries are easy to spot without
// exposing anything to a random visitor.

import { PROXY_SITES } from '../_proxy/config';

export const config = { runtime: 'edge' };

export default async function handler(): Promise<Response> {
  return new Response(
    JSON.stringify({ configuredSites: PROXY_SITES.map((s) => s.key) }),
    { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
  );
}
