// Relays third-party video-embed/CDN requests that a proxied page (e.g. topcinema.io)
// points to, forging Referer/Origin to whatever the actual requesting page's URL would
// be for that hop.
//
// This function exists ONLY because these embed hosts and their CDNs refuse to serve
// video unless the request's Referer looks right, and the operator explicitly chose —
// after being told this conflicts with this project's original "never spoof/forge
// headers, never bypass anti-hotlink/access-control checks" rule — to override that
// rule specifically for this endpoint. See buildEmbedUpstreamHeaders in
// api/_proxy/config.ts.
//
// Referer isn't one fixed value: a real browser sends the URL of whatever page/script
// actually issued a request, so a resource discovered *inside* an already-relayed page
// (an m3u8 manifest referenced from an embed page, say) needs Referer = that embed
// page's own URL, not the original site's. That's what the `pageRef` param threads
// through: the first hop (rewriteIframeEmbeds in proxy-handler.ts) omits it, so Referer
// falls back to the registered site's origin (topcinema.io); every hop after that
// carries pageRef = the page it was discovered on.
//
// Unlike the main proxy, the target host here is NOT a single configured origin — it's
// whatever https URL a proxied page pointed at (embed hosts, CDNs, HLS manifests/
// segments), because that set isn't known ahead of time. It's still bounded: https
// only, private/loopback hostnames blocked, rate-limited, and the "ref" site key must
// be one of the explicitly configured PROXY_SITES.

import { findSite, checkRateLimit, buildEmbedUpstreamHeaders, buildDownstreamHeaders } from './_proxy/config';

export const config = { runtime: 'edge' };

const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fe80:/i,
];

function isBlockedHost(hostname: string): boolean {
  const bare = hostname.replace(/^\[/, '').replace(/\]$/, '');
  return PRIVATE_HOSTNAME_PATTERNS.some((p) => p.test(bare));
}

function embedLink(refKey: string, target: string, pageRef: string): string {
  return `/api/embed?ref=${refKey}&pageRef=${encodeURIComponent(pageRef)}&u=${encodeURIComponent(target)}`;
}

// --- Dean Edwards "packer" unpacker (no eval/Function — pure string parsing) ----------
// A huge fraction of embed players ship their actual player-init code (which is where
// the real video URL lives) run through this well-known, non-cryptographic packer —
// it's for size/mild obfuscation, not real security. Since the payload is a plain JS
// string until unpacked, our usual quoted-URL rewrite never sees the real URL inside
// it; we have to unpack it first. We deliberately don't eval() anything (Edge runtimes
// may disallow dynamic code execution, and this content is untrusted) — just replicate
// the substitution algorithm as string operations.

function parseJsStringLiteral(src: string, pos: number): { value: string; next: number } | null {
  const quote = src[pos];
  if (quote !== '"' && quote !== "'") return null;
  let i = pos + 1;
  let out = '';
  const escapes: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"' };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && i + 1 < src.length) {
      const next = src[i + 1];
      out += escapes[next] !== undefined ? escapes[next] : next;
      i += 2;
      continue;
    }
    if (ch === quote) return { value: out, next: i + 1 };
    out += ch;
    i++;
  }
  return null; // unterminated string — malformed input
}

function findMatchingParen(src: string, openParenIndex: number): number {
  let depth = 0;
  let inStr: string | null = null;
  for (let i = openParenIndex; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

type PackerArgs = { p: string; a: number; c: number; k: string[] };

function parsePackerCallArgs(src: string, argsStart: number): PackerArgs | null {
  let i = argsStart;
  const skipWs = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  skipWs();
  const pLit = parseJsStringLiteral(src, i);
  if (!pLit) return null;
  i = pLit.next;
  skipWs();
  if (src[i] !== ',') return null;
  i++;
  skipWs();
  const aMatch = /^\d+/.exec(src.slice(i));
  if (!aMatch) return null;
  const a = parseInt(aMatch[0], 10);
  i += aMatch[0].length;
  skipWs();
  if (src[i] !== ',') return null;
  i++;
  skipWs();
  const cMatch = /^\d+/.exec(src.slice(i));
  if (!cMatch) return null;
  const c = parseInt(cMatch[0], 10);
  i += cMatch[0].length;
  skipWs();
  if (src[i] !== ',') return null;
  i++;
  skipWs();
  const kLit = parseJsStringLiteral(src, i);
  if (!kLit) return null;
  return { p: pLit.value, a, c, k: kLit.value.split('|') };
}

function unpackDeanEdwards({ p, a, c, k }: PackerArgs): string {
  const base = (n: number): string => {
    const head = n < a ? '' : base(Math.floor(n / a));
    const rem = n % a;
    const digit = rem > 35 ? String.fromCharCode(rem + 29) : rem.toString(36);
    return head + digit;
  };
  let result = p;
  let i = c;
  while (i--) {
    if (k[i]) {
      const token = base(i);
      const replacement = k[i];
      result = result.replace(new RegExp(`\\b${token}\\b`, 'g'), () => replacement);
    }
  }
  return result;
}

const PACKER_MARKER = 'function(p,a,c,k,e,d)';

// Finds every `eval(function(p,a,c,k,e,d){...}(...))` block, unpacks it, rewrites URLs
// found in the unpacked source, and splices the plain (unpacked) code back in place of
// the eval(...) wrapper — the browser then just runs ordinary JS instead of packed JS.
function unpackAndRewriteEvalBlocks(src: string, refKey: string, pageRef: string): string {
  let out = '';
  let cursor = 0;
  while (true) {
    const markerIdx = src.indexOf(PACKER_MARKER, cursor);
    if (markerIdx === -1) {
      out += src.slice(cursor);
      break;
    }
    const evalIdx = src.lastIndexOf('eval(', markerIdx);
    if (evalIdx === -1 || markerIdx - evalIdx > 20) {
      // Not actually preceded by eval( close enough — not the pattern we expect.
      out += src.slice(cursor, markerIdx + PACKER_MARKER.length);
      cursor = markerIdx + PACKER_MARKER.length;
      continue;
    }
    const outerOpenParen = evalIdx + 4; // index of '(' right after "eval"
    const outerClose = findMatchingParen(src, outerOpenParen);
    if (outerClose === -1) {
      out += src.slice(cursor, markerIdx + PACKER_MARKER.length);
      cursor = markerIdx + PACKER_MARKER.length;
      continue;
    }
    // Inside eval(...), find the function body's closing brace, then its own call "(args)".
    const bodyStart = src.indexOf('{', markerIdx);
    const bodyEnd = bodyStart === -1 ? -1 : findMatchingBrace(src, bodyStart);
    const callOpenParen = bodyEnd === -1 ? -1 : src.indexOf('(', bodyEnd);
    if (bodyStart === -1 || bodyEnd === -1 || callOpenParen === -1 || callOpenParen > outerClose) {
      out += src.slice(cursor, outerClose + 1);
      cursor = outerClose + 1;
      continue;
    }

    const args = parsePackerCallArgs(src, callOpenParen + 1);
    out += src.slice(cursor, evalIdx);
    if (args) {
      const unpacked = unpackDeanEdwards(args);
      out += rewriteQuotedUrls(unpacked, refKey, pageRef);
    } else {
      // Couldn't parse it — leave the original eval(...) call intact rather than
      // dropping functionality we don't understand.
      out += src.slice(evalIdx, outerClose + 1);
    }
    cursor = outerClose + 1;
  }
  return out;
}

function findMatchingBrace(src: string, openBraceIndex: number): number {
  let depth = 0;
  for (let i = openBraceIndex; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// --- Plain URL rewriting for non-packed content ---------------------------------------

// Rewrites absolute http(s) URLs found in quoted strings. Relative URLs constructed at
// runtime by a script are a known miss — same caveat as the main proxy's rewriteBody.
function rewriteQuotedUrls(body: string, refKey: string, pageRef: string): string {
  return body.replace(/(["'])(https?:\/\/[^"'\s]+)\1/g, (_m, quote, rawUrl) => {
    return `${quote}${embedLink(refKey, rawUrl, pageRef)}${quote}`;
  });
}

// HLS (.m3u8) playlists are plain text, line-based: '#EXT-*' directives (some of which
// carry a quoted URI="...") and bare URL/path lines for segments or nested playlists.
function rewriteM3u8(body: string, baseUrl: URL, refKey: string, pageRef: string): string {
  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/i, (whole, uri) => {
          try {
            const abs = new URL(uri, baseUrl).toString();
            return `URI="${embedLink(refKey, abs, pageRef)}"`;
          } catch {
            return whole;
          }
        });
      }
      try {
        const abs = new URL(trimmed, baseUrl).toString();
        return embedLink(refKey, abs, pageRef);
      } catch {
        return line;
      }
    })
    .join('\n');
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const refKey = url.searchParams.get('ref') ?? '';
  const site = findSite(refKey);
  if (!site) {
    return new Response('Not found', { status: 404, headers: { 'x-proxy-reason': 'site-not-registered' } });
  }

  const targetRaw = url.searchParams.get('u') ?? '';
  let target: URL;
  try {
    target = new URL(targetRaw);
  } catch {
    return new Response('Bad request', { status: 400, headers: { 'x-proxy-reason': 'bad-target' } });
  }

  if (target.protocol !== 'https:') {
    return new Response('Bad request', { status: 400, headers: { 'x-proxy-reason': 'non-https-target' } });
  }
  if (isBlockedHost(target.hostname)) {
    return new Response('Bad request', { status: 400, headers: { 'x-proxy-reason': 'blocked-host' } });
  }

  const clientKey = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
  if (!checkRateLimit(`embed:${clientKey}`)) {
    return new Response('Too many requests', { status: 429, headers: { 'x-proxy-reason': 'rate-limited' } });
  }

  const pageRefRaw = url.searchParams.get('pageRef');
  let refererUrl = `${new URL(site.origin).origin}/`;
  if (pageRefRaw) {
    try {
      refererUrl = new URL(pageRefRaw).toString();
    } catch {
      // keep the site-origin fallback
    }
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(target, {
      method: req.method,
      headers: buildEmbedUpstreamHeaders(req.headers, req.headers.get('user-agent'), refererUrl),
      redirect: 'manual',
    });
  } catch {
    return new Response('Upstream unavailable', { status: 502, headers: { 'x-proxy-reason': 'fetch-failed' } });
  }

  if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
    const location = upstreamResponse.headers.get('location');
    if (location) {
      try {
        const resolved = new URL(location, target);
        if (resolved.protocol === 'https:' && !isBlockedHost(resolved.hostname)) {
          const proxied = embedLink(refKey, resolved.toString(), refererUrl);
          return new Response(null, {
            status: upstreamResponse.status,
            headers: { location: new URL(proxied, url.origin).toString(), 'x-proxy-reason': 'upstream-redirect' },
          });
        }
      } catch {
        // falls through to the blocked response below
      }
    }
    return new Response('Upstream redirect blocked', { status: 502, headers: { 'x-proxy-reason': 'redirect-blocked' } });
  }

  const headers = buildDownstreamHeaders(upstreamResponse.headers);
  const contentType = upstreamResponse.headers.get('content-type') ?? '';
  const isM3u8 = /mpegurl|m3u8/i.test(contentType) || target.pathname.endsWith('.m3u8');
  const isTextRewritable = isM3u8 || /text\/html|javascript|text\/plain/i.test(contentType);
  headers.set('x-proxy-reason', 'upstream');

  // Minimal logging: method + ref + status only. Never the target URL.
  console.log(`[embed] ${req.method} ref=${refKey} status=${upstreamResponse.status}`);

  if (isTextRewritable) {
    const text = await upstreamResponse.text();
    // A real browser pins Referer to the current *document* for every sub-resource
    // fetch a script/player makes (manifests, segments, nested JS) — it does not
    // advance hop-by-hop to each resource's own URL. Only an actual HTML page
    // establishes a new document context, so only that case updates pageRef; JS/m3u8
    // responses keep propagating whatever referer got them served in the first place.
    const nextPageRef = contentType.includes('text/html') ? target.toString() : refererUrl;
    let rewritten = isM3u8
      ? rewriteM3u8(text, target, refKey, nextPageRef)
      : rewriteQuotedUrls(text, refKey, nextPageRef);
    if (!isM3u8 && text.includes(PACKER_MARKER)) {
      rewritten = unpackAndRewriteEvalBlocks(rewritten, refKey, nextPageRef);
    }
    if (contentType) headers.set('content-type', contentType);
    // The rewritten body's byte length no longer matches the original Content-Length.
    headers.delete('content-length');
    if (!headers.has('cache-control')) headers.set('cache-control', 'private, no-store');
    return new Response(rewritten, { status: upstreamResponse.status, headers });
  }

  // Binary passthrough (video segments, mp4, images, fonts, etc.) — streamed, not
  // buffered, so this stays cheap even for large files. Range/Accept-Ranges/
  // Content-Range are already in the header allowlists, so seeking still works.
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'public, max-age=3600');
  }
  return new Response(upstreamResponse.body, { status: upstreamResponse.status, headers });
}
