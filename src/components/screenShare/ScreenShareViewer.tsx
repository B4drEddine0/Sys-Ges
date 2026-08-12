import { useEffect } from 'react';
import { X, Maximize2, Minimize2, MonitorOff, Loader2, WifiOff } from 'lucide-react';
import { Button, Avatar } from '@/components/ui';
import { useScreenShareViewer } from '@/features/screenShare/useScreenShareViewer';
import type { ScreenShareSession } from '@/features/screenShare/screenShareApi';
import { useState } from 'react';

interface ScreenShareViewerProps {
  session: ScreenShareSession;
  userId: string;
  onClose: () => void;
}

/**
 * Floating overlay that shows the sharer's screen.
 * Features:
 * - Inline status (connecting → watching → ended)
 * - Fullscreen toggle
 * - Dismiss button
 * - All viewer-side WebRTC management via useScreenShareViewer
 */
export function ScreenShareViewer({ session, userId, onClose }: ScreenShareViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { state, videoRef, connect, disconnect, errorMessage } = useScreenShareViewer({
    session,
    userId,
    onEnded: () => {
      // Session ended by sharer — auto-close after a brief moment so user sees the message
      setTimeout(onClose, 3500);
    },
    onError: () => {
      // Keep overlay open so the user can see the error and dismiss manually
    },
  });

  // Auto-connect when the component mounts
  useEffect(() => {
    void connect();
    return () => disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sharerName = session.sharer?.display_name ?? 'Someone';
  const sharerAvatar = session.sharer?.avatar_url ?? null;
  const sharerInitials = sharerName.slice(0, 2).toUpperCase();

  return (
    <div
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-[200] bg-black'
          : 'fixed bottom-6 right-6 z-[200] w-[640px] max-w-[calc(100vw-3rem)] aspect-video rounded-2xl overflow-hidden shadow-2xl border border-border bg-black'
      } flex flex-col`}
      style={{ minHeight: isFullscreen ? '100vh' : undefined }}
      id="screen-share-viewer"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/70 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            {state === 'watching' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                state === 'watching'
                  ? 'bg-rose-500'
                  : state === 'connecting'
                  ? 'bg-amber-400'
                  : 'bg-muted-foreground'
              }`}
            />
          </span>
          <Avatar name={sharerInitials} color="#2563eb" src={sharerAvatar} className="h-5 w-5 text-[10px]" />
          <span className="text-xs font-semibold text-white truncate max-w-[160px]">
            {sharerName}&apos;s screen
          </span>
          {state === 'watching' && (
            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-widest">Live</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsFullscreen((f) => !f)}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            id="screen-share-fullscreen-btn"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Close viewer"
            id="screen-share-close-btn"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Video / status area */}
      <div className="relative flex-1 flex items-center justify-center bg-black min-h-0">
        {/* Video element — always in DOM, hidden until stream arrives */}
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-contain ${state === 'watching' ? 'opacity-100' : 'opacity-0'}`}
          style={{ transition: 'opacity 0.3s ease' }}
        />

        {/* Overlay states */}
        {state === 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <Loader2 className="h-10 w-10 animate-spin opacity-60" />
            <p className="text-sm font-medium opacity-70">Connecting to {sharerName}…</p>
          </div>
        )}
        {state === 'ended' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <MonitorOff className="h-12 w-12 opacity-40" />
            <p className="text-base font-semibold">Screen sharing ended</p>
            <p className="text-xs opacity-60">{sharerName} stopped sharing their screen</p>
          </div>
        )}
        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <WifiOff className="h-10 w-10 text-rose-400 opacity-80" />
            <p className="text-sm font-semibold">Connection failed</p>
            {errorMessage && (
              <p className="text-xs opacity-60 max-w-[280px] text-center">{errorMessage}</p>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => connect()}
              className="mt-2 bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
