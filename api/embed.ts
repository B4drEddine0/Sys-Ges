// Vercel Edge entry point for the shared embed-relay logic — see
// api/_proxy/embedCore.ts for what this actually does and why. This is the default
// path; when HOME_RELAY_URL is configured, proxy-handler.ts points browsers at the
// home relay (relay/server.ts) instead, for the specific providers that block
// requests originating from Vercel's network.

import { createEmbedHandler } from './_proxy/embedCore';

export const config = { runtime: 'edge' };

export default createEmbedHandler({ basePath: '/api/embed' });
