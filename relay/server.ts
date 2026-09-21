// Home relay for the video-embed proxy. Run this on a machine on your OWN network
// (not a cloud/datacenter box — that's the entire point of it) and expose it publicly
// over HTTPS via a tunnel (e.g. `cloudflared tunnel --url http://localhost:8787`).
// Then set, on the Vercel deployment:
//   HOME_RELAY_URL=https://<your-tunnel-hostname>
//   RELAY_SHARED_SECRET=<same long random value as below>
// and set PROXY_SITES + RELAY_SHARED_SECRET here too (e.g. in a local .env, loaded
// however you run this — see the "relay" script in package.json).
//
// Why this exists at all: some video-embed providers block requests from cloud/
// datacenter IP ranges outright, separate from (and in addition to) the Referer check
// api/embed.ts already handles. Running the actual outbound fetch from a real home
// connection is the only way around that — see api/_proxy/embedCore.ts's module
// comment for the full reasoning and the tradeoffs the operator explicitly accepted.
//
// This process has to stay running whenever you want video from an affected provider
// to work; if it's down, that video breaks (the rest of the app, hosted on Vercel,
// keeps working fine either way).

import http from 'node:http';
import { Readable } from 'node:stream';
import { createEmbedHandler } from '../api/_proxy/embedCore';

const PORT = Number(process.env.RELAY_PORT) || 8787;
const REQUIRE_KEY = process.env.RELAY_SHARED_SECRET?.trim() || undefined;

if (!REQUIRE_KEY) {
  console.warn('[relay] WARNING: RELAY_SHARED_SECRET is not set — this relay would be an open, unauthenticated internet-facing proxy. Refusing to start.');
  process.exit(1);
}

const handleEmbedRequest = createEmbedHandler({ basePath: '/embed', requireKey: REQUIRE_KEY });

function toWebRequest(req: http.IncomingMessage): Request {
  const host = req.headers.host ?? `localhost:${PORT}`;
  const url = new URL(req.url ?? '/', `http://${host}`);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(', '));
  }
  return new Request(url, { method: req.method ?? 'GET', headers });
}

async function writeWebResponse(res: http.ServerResponse, webResponse: Response): Promise<void> {
  const headers: Record<string, string> = {};
  webResponse.headers.forEach((value, key) => { headers[key] = value; });
  res.writeHead(webResponse.status, headers);

  if (!webResponse.body) {
    res.end();
    return;
  }
  const nodeStream = Readable.fromWeb(webResponse.body as any);
  await new Promise<void>((resolve, reject) => {
    nodeStream.pipe(res);
    nodeStream.on('error', reject);
    res.on('finish', () => resolve());
  });
}

const server = http.createServer((req, res) => {
  handleEmbedRequest(toWebRequest(req))
    .then((webResponse) => writeWebResponse(res, webResponse))
    .catch((err) => {
      console.error('[relay] request failed:', err instanceof Error ? err.message : err);
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
      res.end('Relay error');
    });
});

server.listen(PORT, () => {
  console.log(`[relay] listening on http://localhost:${PORT} (mounted at /embed)`);
  console.log('[relay] expose this publicly over HTTPS with a tunnel, then set HOME_RELAY_URL on Vercel to the tunnel hostname.');
});
