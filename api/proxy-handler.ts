// Reverse proxy: Browser -> this Edge Function (HTTPS) -> allow-listed upstream origin.
//
// This is a flat, non-dynamic file reached via an explicit rewrite in vercel.json
// (/api/proxy/:path* -> /api/proxy-handler) rather than Vercel's bracket-folder dynamic
// routing (api/proxy/[site]/[[...path]].ts), which turned out not to be picked up
// reliably for this project — requests 404'd at the platform level before this code
// ever ran. The site key + rest-of-path are parsed from the URL manually below, same
// as before.
//
// Deliberately does NOT:
//  - accept an arbitrary host from the client (SSRF-safe: origin comes only from
//    PROXY_SITES, resolved server-side)
//  - forward the browser's cookies/auth to upstream, or upstream's Set-Cookie back
//    to the browser
//  - forward arbitrary request headers (see FORWARD_REQUEST_HEADERS allowlist)
//  - spoof/alter identifying headers — the real User-Agent is relayed as-is
//  - attempt to defeat upstream auth, CAPTCHA, rate limiting or anti-bot checks
//
// See api/_proxy/config.ts for the shared allowlist/header/rate-limit logic.

import {
  findSite,
  sanitizePath,
  buildUpstreamHeaders,
  buildDownstreamHeaders,
  checkRateLimit,
  HOME_RELAY_URL,
  RELAY_SHARED_SECRET,
  isExtensionHandledHost,
} from './_proxy/config';

export const config = { runtime: 'edge' };

const REWRITABLE_TYPES = ['text/html', 'text/css'];

function rewriteBody(body: string, upstreamOrigin: string, proxyBase: string): string {
  // Same-origin absolute links only — this keeps markup that references the upstream
  // domain pointed at our proxy instead, so the browser doesn't need to know the
  // upstream URL for ordinary navigation/asset loads. It does NOT rewrite
  // JS-constructed URLs (e.g. absolute fetch() calls baked into a script bundle) —
  // those still hit the upstream directly if the page issues them itself, which is a
  // known limitation of a lightweight text-rewrite proxy like this one.
  return body.split(upstreamOrigin).join(proxyBase);
}

// Video players on sites like this are usually embedded from a separate third-party
// host (a CDN/embed provider), not the configured upstream origin, so the same-origin
// rewrite above never touches them. Route those through the embed relay instead, which
// (per an explicit, deliberate exception for this project — see api/_proxy/embedCore.ts)
// forges the Referer/Origin those hosts require to actually serve video.
//
// Normally that's api/embed.ts on this same Vercel deployment. But some providers also
// block requests from cloud/datacenter IPs outright (a separate anti-bot layer, found
// by testing) — for those, HOME_RELAY_URL points browsers at a relay on the operator's
// own network instead, so the *first* embed fetch comes from a real home connection.
// Every hop after that stays on whichever base the first link pointed at (the relay's
// own generated links are relative to itself), so only this one call site needs to
// choose between the two.
//
// A third option, for hosts in EXTENSION_HANDLED_HOSTS: leave the iframe pointing at
// the real upstream URL untouched. A viewer with the companion browser extension
// installed (see extension/) gets a normal direct browser request — their own real
// device's IP, with Referer fixed client-side via declarativeNetRequest — which sidesteps
// both the Referer check and the cloud-IP block at once, no relay needed. A viewer
// without the extension just gets whatever the raw site would show them anyway.
function rewriteIframeEmbeds(body: string, siteKey: string): string {
  const base = HOME_RELAY_URL ? `${HOME_RELAY_URL}/embed` : '/api/embed';
  const key = HOME_RELAY_URL && RELAY_SHARED_SECRET ? `&k=${encodeURIComponent(RELAY_SHARED_SECRET)}` : '';
  return body.replace(/(<iframe\b[^>]*\bsrc=)(["'])(https?:\/\/[^"']+)\2/gi, (_m, prefix, quote, src) => {
    try {
      if (isExtensionHandledHost(new URL(src).hostname)) return `${prefix}${quote}${src}${quote}`;
    } catch {
      // fall through to the relay rewrite below
    }
    return `${prefix}${quote}${base}?ref=${siteKey}&u=${encodeURIComponent(src)}${key}${quote}`;
  });
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const match = url.pathname.match(/^\/api\/proxy\/([^/]+)\/?(.*)$/);
  if (!match) return new Response('Not found', { status: 404, headers: { 'x-proxy-reason': 'bad-path' } });

  const [, siteKey, rest] = match;
  const site = findSite(siteKey);
  if (!site) {
    // Deliberately generic — never echo back what was requested.
    return new Response('Not found', { status: 404, headers: { 'x-proxy-reason': 'site-not-registered' } });
  }

  const clientKey = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
  if (!checkRateLimit(`${siteKey}:${clientKey}`)) {
    return new Response('Too many requests', { status: 429, headers: { 'x-proxy-reason': 'rate-limited' } });
  }

  const pathSegments = rest ? rest.split('/') : [];
  const safePath = sanitizePath(pathSegments);
  if (safePath === null) {
    return new Response('Bad request', { status: 400, headers: { 'x-proxy-reason': 'bad-path-segment' } });
  }

  const upstreamUrl = new URL(safePath, site.origin.endsWith('/') ? site.origin : `${site.origin}/`);
  upstreamUrl.search = url.search;

  let upstreamResponse: Response;
  try {
    // Some sites (this one included) drive their in-page "switch episode/server"
    // controls via a same-origin AJAX POST rather than a real page navigation — that
    // has to go through as a POST, with its form body and Content-Type intact, or it
    // just 405s and the picker silently does nothing.
    const body = req.method === 'POST' ? await req.arrayBuffer() : undefined;
    upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: buildUpstreamHeaders(req.headers, req.headers.get('user-agent')),
      body,
      redirect: 'manual',
    });
  } catch {
    // No upstream detail in the error response or logs.
    return new Response('Upstream unavailable', { status: 502, headers: { 'x-proxy-reason': 'fetch-failed' } });
  }

  // Upstream redirects are rewritten to stay inside the proxy rather than leaking the
  // upstream host to the browser's address bar / history.
  if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
    const location = upstreamResponse.headers.get('location');
    if (location) {
      const resolved = new URL(location, upstreamUrl);
      if (resolved.origin === new URL(site.origin).origin) {
        const proxied = `/api/proxy/${siteKey}/${resolved.pathname.replace(/^\//, '')}${resolved.search}`;
        // Not Response.redirect() — its Headers object is immutable per spec, so we
        // can't attach x-proxy-reason to it. Build the redirect response by hand instead.
        return new Response(null, {
          status: upstreamResponse.status,
          headers: { location: new URL(proxied, url.origin).toString(), 'x-proxy-reason': 'upstream-redirect' },
        });
      }
    }
    return new Response('Upstream redirect blocked', { status: 502, headers: { 'x-proxy-reason': 'redirect-off-origin' } });
  }

  const headers = buildDownstreamHeaders(upstreamResponse.headers);
  const contentType = upstreamResponse.headers.get('content-type') ?? '';
  const isRewritable = REWRITABLE_TYPES.some((t) => contentType.includes(t));
  // Present on every response that actually reached the upstream (as opposed to one
  // of this function's own early-exit responses above) — lets you tell "our function
  // said 404" apart from "upstream said 404" just by reading response headers, without
  // needing the Vercel function logs.
  headers.set('x-proxy-reason', 'upstream');

  // Minimal logging: method + site + status only. Never the full path/query, never
  // headers or body.
  console.log(`[proxy] ${req.method} site=${siteKey} status=${upstreamResponse.status}`);

  if (isRewritable) {
    const text = await upstreamResponse.text();
    const proxyBase = `${url.origin}/api/proxy/${siteKey}`;
    const sameOriginRewritten = rewriteBody(text, new URL(site.origin).origin, proxyBase);
    const rewritten = contentType.includes('text/html') ? rewriteIframeEmbeds(sameOriginRewritten, siteKey) : sameOriginRewritten;
    headers.set('content-type', contentType);
    headers.delete('content-length');
    if (!headers.has('cache-control')) headers.set('cache-control', 'private, no-store');
    return new Response(rewritten, { status: upstreamResponse.status, headers });
  }

  // Static assets: let the CDN/browser cache them if upstream didn't already say
  // otherwise, since these aren't personalized responses.
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
  }

  return new Response(upstreamResponse.body, { status: upstreamResponse.status, headers });
}
