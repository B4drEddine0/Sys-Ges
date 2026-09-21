import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clapperboard, AlertTriangle, RotateCw } from 'lucide-react';

const SITE_KEY = 'cinema';
// Same-origin path only — the browser never navigates to the upstream host directly,
// so this is what shows up in devtools/history instead of the real destination.
const CINEMA_PROXY_PATH = `/api/proxy/${SITE_KEY}/`;

type Status = { state: 'checking' } | { state: 'ready' } | { state: 'error'; message: string };

export function CinemaPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ state: 'checking' });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Bumping this forces the iframe to remount at the base URL — the fallback for when
  // an in-page reload isn't possible (e.g. something navigated the frame off-origin).
  const [resetKey, setResetKey] = useState(0);

  // The episode/server picker on these sites is often JS-driven (fetches a player via
  // AJAX rather than a real page navigation), so it never goes through our HTML
  // rewriting and can just hang. Reloading the frame's current document — not
  // navigating back to the start — retries whatever page it's actually stuck on.
  const refreshFrame = () => {
    try {
      iframeRef.current?.contentWindow?.location.reload();
    } catch {
      // Cross-origin (frame navigated somewhere outside our proxy) — the only way
      // back is to remount at the known-good base path.
      setResetKey((k) => k + 1);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const health = await fetch('/api/proxy/health', { cache: 'no-store' });
        const data = await health.json().catch(() => ({ configuredSites: [] as string[], diagnostics: null }));
        if (cancelled) return;

        if (!data.configuredSites?.includes(SITE_KEY)) {
          const diag = data.diagnostics as
            | { envVarPresent: boolean; rawEntryCount: number; rejected: { entry: string; reason: string }[] }
            | null
            | undefined;

          let reason: string;
          if (!diag || !diag.envVarPresent) {
            reason = 'The PROXY_SITES env var is not set (or empty) for this deployment/environment — set it and redeploy.';
          } else if (diag.rejected.length > 0) {
            reason = `PROXY_SITES is set but every entry was rejected: ${diag.rejected.map((r) => `${r.entry} — ${r.reason}`).join('; ')}`;
          } else {
            reason = `PROXY_SITES is set with ${diag.rawEntryCount} entr${diag.rawEntryCount === 1 ? 'y' : 'ies'}, but none used the key "${SITE_KEY}".`;
          }

          setStatus({
            state: 'error',
            message: `No proxy site is registered for "${SITE_KEY}". ${reason} Expected format: "${SITE_KEY}=https://your-upstream-domain".`,
          });
          return;
        }

        // GET, not HEAD — some upstream sites (this one included) behave inconsistently
        // between the two methods (e.g. redirect logic that only applies to GET), and
        // GET is what the iframe itself will actually issue.
        const probe = await fetch(CINEMA_PROXY_PATH, { cache: 'no-store' });
        if (cancelled) return;

        const reason = probe.headers.get('x-proxy-reason');
        if (probe.ok) {
          setStatus({ state: 'ready' });
        } else if (probe.status === 429) {
          setStatus({ state: 'error', message: 'Rate limited — wait a moment and reload.' });
        } else if (reason && reason !== 'upstream') {
          setStatus({ state: 'error', message: `Proxy rejected the request before reaching upstream (${reason}, HTTP ${probe.status}).` });
        } else {
          setStatus({
            state: 'error',
            message: `The upstream site itself returned HTTP ${probe.status} for this request. This is not a proxy config issue — it may be a real 404, or the upstream's anti-bot/WAF blocking requests from this server's network (which this proxy won't attempt to circumvent).`,
          });
        }
      } catch {
        if (!cancelled) setStatus({ state: 'error', message: 'Could not reach the proxy endpoint.' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background/80 px-6 backdrop-blur-sm gap-4 shrink-0">
        <button
          onClick={() => navigate('/private')}
          className="p-2 -ml-2 rounded-lg hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Clapperboard className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight flex-1">Cinema</h2>
        {status.state === 'ready' && (
          <button
            onClick={refreshFrame}
            title="Reload the player if it gets stuck after picking an episode/server"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-muted"
          >
            <RotateCw className="h-4 w-4" /> Refresh
          </button>
        )}
      </header>

      <div className="flex items-start gap-3 px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs shrink-0">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          This loads the configured site through the proxy at <code className="font-mono">{CINEMA_PROXY_PATH}</code>.
          Some pages may fail to display here if the upstream site blocks being framed
          (CSP <code className="font-mono">frame-ancestors</code> / <code className="font-mono">X-Frame-Options</code>),
          and video players hosted on separate third-party domains won't be proxied.
          If picking an episode or server leaves it stuck, use the Refresh button above.
        </p>
      </div>

      {status.state === 'checking' && (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Checking proxy…
        </div>
      )}

      {status.state === 'error' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-2">
            <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
            <p className="font-semibold">Cinema proxy isn't working</p>
            <p className="text-sm text-muted-foreground">{status.message}</p>
          </div>
        </div>
      )}

      {status.state === 'ready' && (
        <iframe
          key={resetKey}
          ref={iframeRef}
          title="Cinema"
          src={CINEMA_PROXY_PATH}
          className="flex-1 w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}
