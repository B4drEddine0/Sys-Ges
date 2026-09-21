import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clapperboard, AlertTriangle } from 'lucide-react';

// Same-origin path only — the browser never navigates to the upstream host directly,
// so this is what shows up in devtools/history instead of the real destination.
const CINEMA_PROXY_PATH = '/api/proxy/cinema/';

export function CinemaPage() {
  const navigate = useNavigate();

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
        <h2 className="text-lg font-semibold tracking-tight">Cinema</h2>
      </header>

      <div className="flex items-start gap-3 px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs shrink-0">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          This loads the configured site through the proxy at <code className="font-mono">{CINEMA_PROXY_PATH}</code>.
          Some pages may fail to display here if the upstream site blocks being framed
          (CSP <code className="font-mono">frame-ancestors</code> / <code className="font-mono">X-Frame-Options</code>),
          and video players hosted on separate third-party domains won't be proxied — see the
          README for details and how to configure the upstream origin.
        </p>
      </div>

      <iframe
        title="Cinema"
        src={CINEMA_PROXY_PATH}
        className="flex-1 w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
