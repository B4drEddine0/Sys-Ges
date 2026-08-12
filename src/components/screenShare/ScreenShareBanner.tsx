import { Monitor, Eye } from 'lucide-react';
import { Avatar } from '@/components/ui';
import type { ScreenShareSession } from '@/features/screenShare/screenShareApi';

interface ScreenShareBannerProps {
  session: ScreenShareSession;
  currentUserId: string;
  onWatch: () => void;
  isWatching: boolean;
}

/**
 * Banner shown to non-sharer room members when a screen share is active.
 * Provides a "Watch" button to open the viewer overlay.
 */
export function ScreenShareBanner({
  session,
  currentUserId,
  onWatch,
  isWatching,
}: ScreenShareBannerProps) {
  // Don't show banner to the sharer themselves (they see the "Stop Sharing" button)
  if (session.sharer_id === currentUserId) return null;

  const sharerName = session.sharer?.display_name ?? 'Someone';
  const sharerAvatar = session.sharer?.avatar_url ?? null;
  const sharerInitials = sharerName.slice(0, 2).toUpperCase();

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-violet-600/90 to-blue-600/90 text-white text-sm rounded-none"
      id="screen-share-banner"
      role="status"
      aria-label={`${sharerName} is sharing their screen`}
    >
      {/* Pulsing live indicator */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
      </span>

      <Avatar
        name={sharerInitials}
        color="#2563eb"
        src={sharerAvatar}
        className="h-6 w-6 text-[10px] ring-1 ring-white/40"
      />

      <div className="flex-1 min-w-0">
        <span className="font-semibold">{sharerName}</span>
        <span className="opacity-80"> is sharing their screen</span>
      </div>

      <button
        onClick={onWatch}
        id="watch-screen-share-btn"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
          isWatching
            ? 'bg-white/30 text-white cursor-default'
            : 'bg-white text-violet-700 hover:bg-white/90 hover:text-violet-800'
        }`}
        disabled={isWatching}
        aria-pressed={isWatching}
      >
        <Eye className="h-3.5 w-3.5" />
        {isWatching ? 'Watching' : 'Watch Screen'}
      </button>
    </div>
  );
}
