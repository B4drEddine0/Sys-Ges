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

// Non-secret parsing diagnostics — never includes an origin URL, only counts and
// rejection reasons, so it's safe to surface on an unauthenticated health endpoint.
export type ProxyDiagnostics = {
  envVarPresent: boolean;
  rawEntryCount: number;
  rejected: { entry: string; reason: string }[];
};

const diagnostics: ProxyDiagnostics = { envVarPresent: false, rawEntryCount: 0, rejected: [] };
export function getProxyDiagnostics(): ProxyDiagnostics {
  return diagnostics;
}

function redactEntry(entry: string): string {
  // Keep the key (if any) visible for debugging, redact everything after the first "=".
  const eq = entry.indexOf('=');
  if (eq === -1) return `"${entry}" (no "=" found)`;
  return `"${entry.slice(0, eq)}=<redacted>"`;
}

function readSites(): ProxySite[] {
  // PROXY_SITES="cinema=https://topcinema.io;example=https://example.com"
  // Each entry MUST be "key=origin" — a bare URL with no key (e.g. just
  // "https://topcinema.io/") is invalid and gets dropped, since the key is what
  // shows up in the proxied path (/api/proxy/<key>/...).
  const rawValue = process.env.PROXY_SITES;
  diagnostics.envVarPresent = typeof rawValue === 'string' && rawValue.trim().length > 0;

  const raw = rawValue?.trim();
  if (!raw) return [];

  const rawEntries = raw.split(';').map((entry) => entry.trim()).filter(Boolean);
  diagnostics.rawEntryCount = rawEntries.length;

  return rawEntries
    .map((entry) => {
      const eqIndex = entry.indexOf('=');
      if (eqIndex === -1) {
        diagnostics.rejected.push({ entry: redactEntry(entry), reason: 'missing "=" — format is "key=https://origin"' });
        return { key: '', origin: '', label: '' };
      }
      const key = entry.slice(0, eqIndex).trim();
      const origin = entry.slice(eqIndex + 1).trim();
      if (!key || !origin) {
        diagnostics.rejected.push({ entry: redactEntry(entry), reason: 'empty key or origin' });
        return { key: '', origin: '', label: '' };
      }
      return { key, origin, label: key };
    })
    .filter((site): site is ProxySite => {
      if (!site.key || !site.origin) return false;
      try {
        const url = new URL(site.origin);
        if (url.protocol !== 'https:') {
          diagnostics.rejected.push({ entry: `"${site.key}=<redacted>"`, reason: `origin must start with "https://" (got "${url.protocol}//")` });
          return false;
        }
        if (url.pathname !== '/' || url.search || url.hash) {
          diagnostics.rejected.push({ entry: `"${site.key}=<redacted>"`, reason: 'origin must be a bare domain with no path/query/hash, e.g. "https://topcinema.io"' });
          return false;
        }
        return true;
      } catch {
        diagnostics.rejected.push({ entry: `"${site.key}=<redacted>"`, reason: 'not a valid URL' });
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

// When set, points the browser's *first* embed hop at a relay running on the
// operator's own network (relay/server.ts) instead of this Vercel deployment's own
// /api/embed — specifically for video providers that block requests from cloud/
// datacenter IP ranges. Must match RELAY_SHARED_SECRET configured on the relay itself.
// No trailing slash, e.g. "https://cinema-relay.example.com".
export const HOME_RELAY_URL = process.env.HOME_RELAY_URL?.trim().replace(/\/$/, '') || null;
export const RELAY_SHARED_SECRET = process.env.RELAY_SHARED_SECRET?.trim() || null;

// Domains (and their subdomains) for a video-embed provider whose Referer requirement
// a companion browser extension (see extension/) fixes client-side via
// declarativeNetRequest. For these, proxy-handler.ts leaves the iframe pointed at the
// real upstream URL instead of routing it through the embed relay: a viewer with the
// extension installed gets a normal direct browser request (their own real IP, header
// fixed by the extension); a viewer without it just sees the same failure the raw site
// would show anyone without special handling. Only add a host here once its Referer
// requirements have actually been verified — see extension/rules.json.
export const EXTENSION_HANDLED_HOSTS = ['down.vidtube.one'];

export function isExtensionHandledHost(hostname: string): boolean {
  return EXTENSION_HANDLED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
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
  // Needed for POST bodies (e.g. a same-origin AJAX "switch server" form submit) —
  // without it upstream can't tell how to parse the body we're forwarding.
  'content-type',
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

/**
 * Same as buildUpstreamHeaders, but additionally forges Referer/Origin.
 *
 * This ONLY exists for api/embed.ts, and only because the operator explicitly chose to
 * override this project's original "never spoof/forge headers, never bypass
 * anti-hotlink/access-control checks" rule — specifically for third-party video-embed
 * hosts and CDNs that refuse to serve content unless the Referer looks right. It is
 * deliberately not used anywhere else in this codebase.
 *
 * `refererUrl` is the exact URL to forge as Referer (its origin becomes the Origin
 * header). This is NOT always the original site (topcinema.io) — real browsers send
 * the URL of whatever page/script actually issued the request, which for a nested
 * resource (an m3u8 manifest referenced from within an embed page, say) is that embed
 * page's own URL, not the original site's. Callers are responsible for chaining this
 * correctly hop by hop — see api/embed.ts's `pageRef` handling.
 */
export function buildEmbedUpstreamHeaders(reqHeaders: Headers, browserUA: string | null, refererUrl: string): Headers {
  const out = buildUpstreamHeaders(reqHeaders, browserUA);
  out.set('referer', refererUrl);
  out.set('origin', new URL(refererUrl).origin);
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
