// Shared configuration + helpers for the reverse-proxy Edge Functions under /api/proxy/*.
//
// Security model (see requirements in the task that introduced this file):
// - Only explicitly configured upstream origins can ever be reached (no user-controlled host).
// - Nothing about this proxy tries to defeat the upstream site's own protections
//   (auth, CAPTCHA, rate limits, anti-bot, paywalls) — it is a transparent relay for
//   content the operator already has a legal right to access and re-serve.
// - Cookies/credentials from the upstream are never forwarded back to the browser and
//   never logged.

export type ProxySite = {
  /** Public path segment, e.g. "cinema" -> /api/proxy/cinema/* */
  key: string;
  /** The single allowed upstream origin. Must be HTTPS. */
  origin: string;
  /** Human label for logs/UI only. */
  label: string;
};

function readSites(): ProxySite[] {
  // PROXY_SITES="cinema=https://topcinema.io;example=https://example.com"
  // Each entry MUST be "key=origin" — a bare URL with no key (e.g. just
  // "https://topcinema.io/") is invalid and gets dropped, since the key is what
  // shows up in the proxied path (/api/proxy/<key>/...).
  const raw = process.env.PROXY_SITES?.trim();
  if (!raw) return [];

  return raw
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key, origin] = entry.split('=').map((part) => part.trim());
      if (!key || !origin) {
        console.warn(`[proxy] ignoring malformed PROXY_SITES entry (expected "key=origin"): "${entry}"`);
        return { key: '', origin: '', label: '' };
      }
      return { key, origin, label: key };
    })
    .filter((site): site is ProxySite => {
      if (!site.key || !site.origin) return false;
      try {
        const url = new URL(site.origin);
        if (url.protocol !== 'https:' || url.pathname !== '/') {
          console.warn(`[proxy] ignoring PROXY_SITES entry for "${site.key}": origin must be a bare https:// URL`);
          return false;
        }
        return true;
      } catch {
        console.warn(`[proxy] ignoring PROXY_SITES entry for "${site.key}": not a valid URL`);
        return false;
      }
    });
}

// Computed once per cold start — this is intentionally NOT user-configurable at
// request time, so a request can never point the proxy at an arbitrary host (SSRF).
export const PROXY_SITES: ProxySite[] = readSites();

export function findSite(key: string): ProxySite | undefined {
  return PROXY_SITES.find((s) => s.key === key);
}

// Headers we allow through to the upstream. Everything else (auth, our own cookies,
// Vercel/CF internal headers, etc.) is dropped rather than blindly forwarded.
export const FORWARD_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'range',
  'if-range',
  'if-none-match',
  'if-modified-since',
] as const;

// Headers we allow back through to the browser. Notably no `set-cookie` — upstream
// sessions are never handed to the client.
export const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
  'cache-control',
] as const;

export function buildUpstreamHeaders(reqHeaders: Headers, browserUA: string | null): Headers {
  const out = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = reqHeaders.get(name);
    if (value) out.set(name, value);
  }
  // Forward the browser's real User-Agent unmodified — we never fabricate or mask
  // client identity, we just relay it.
  if (browserUA) out.set('user-agent', browserUA);
  return out;
}

export function buildDownstreamHeaders(upstreamHeaders: Headers): Headers {
  const out = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstreamHeaders.get(name);
    if (value) out.set(name, value);
  }
  return out;
}

/**
 * Validates a requested path segment array before it's joined into an upstream URL.
 * Rejects anything that could escape the upstream origin or smuggle a second URL
 * (protocol-relative, absolute, traversal, etc).
 */
export function sanitizePath(segments: string[]): string | null {
  const joined = segments.join('/');
  if (joined.includes('..')) return null;
  if (joined.startsWith('//')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(joined)) return null; // e.g. "https:", "javascript:"
  return joined;
}

// --- Minimal best-effort rate limiter -------------------------------------------------
// Serverless/edge functions are stateless across cold starts and can run as many
// concurrent instances as traffic demands, so this in-memory bucket only limits abuse
// within a single warm instance. It is a courtesy backstop, not a real distributed
// limiter — for production-grade limiting, put a real store (e.g. Upstash Redis) behind
// the same `checkRateLimit` signature.
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

export function checkRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(clientKey);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(clientKey, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}
