// Verifies the Private Space PIN server-side so the correct value never ships inside
// the browser bundle. Unlock state itself is just a client-side UI gate (sessionStorage)
// for casual privacy on a shared machine — it is not an authentication/authorization
// boundary protecting sensitive data, so we don't issue a signed session for it.

import { checkRateLimit } from '../_proxy/config';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false }), { status: 405 });
  }

  const clientKey = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
  if (!checkRateLimit(`unlock:${clientKey}`)) {
    return new Response(JSON.stringify({ ok: false }), { status: 429 });
  }

  const expected = process.env.PRIVATE_SPACE_PIN;
  if (!expected) {
    return new Response(JSON.stringify({ ok: false }), { status: 503 });
  }

  let pin = '';
  try {
    const body = await req.json();
    pin = typeof body?.pin === 'string' ? body.pin : '';
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }

  const ok = pin.length === expected.length && timingSafeEqual(pin, expected);
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 401,
    headers: { 'content-type': 'application/json' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
