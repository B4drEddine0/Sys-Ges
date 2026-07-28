import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { buildApiUrl } from '@/lib/apiConfig';
import { LoadingScreen } from '@/components/AppLoader/LoadingScreen';

const HEALTH_CHECK_PATH = '/tasks?_limit=1';
const RETRY_INTERVAL_MS = 2500;
const REQUEST_TIMEOUT_MS = 8000;
const CONNECTION_HELP_MS = 90000;
const READY_DELAY_MS = 500;

async function pingBackend() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildApiUrl(HEALTH_CHECK_PATH), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function AppLoader({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [showConnectionHelp, setShowConnectionHelp] = useState(false);
  const [wakeCycle, setWakeCycle] = useState(0);

  useEffect(() => {
    if (isReady) return;

    let cancelled = false;
    let retryTimerId: number | undefined;
    let readyTimerId: number | undefined;

    const connectionHelpTimerId = window.setTimeout(() => {
      if (!cancelled) setShowConnectionHelp(true);
    }, CONNECTION_HELP_MS);

    const checkBackend = async () => {
      const isAwake = await pingBackend();

      if (cancelled) return;

      if (isAwake) {
        readyTimerId = window.setTimeout(() => {
          if (!cancelled) setIsReady(true);
        }, READY_DELAY_MS);
        return;
      }

      retryTimerId = window.setTimeout(checkBackend, RETRY_INTERVAL_MS);
    };

    void checkBackend();

    return () => {
      cancelled = true;
      window.clearTimeout(connectionHelpTimerId);
      if (retryTimerId) window.clearTimeout(retryTimerId);
      if (readyTimerId) window.clearTimeout(readyTimerId);
    };
  }, [isReady, wakeCycle]);

  const retry = useCallback(() => {
    setShowConnectionHelp(false);
    setIsReady(false);
    setWakeCycle((current) => current + 1);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {isReady ? (
        <motion.div
          key="app-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="h-full"
        >
          {children}
        </motion.div>
      ) : (
        <LoadingScreen key="loading-screen" showConnectionHelp={showConnectionHelp} onRetry={retry} />
      )}
    </AnimatePresence>
  );
}
