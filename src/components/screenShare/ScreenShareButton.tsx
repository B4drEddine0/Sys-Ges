import { Monitor, MonitorOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import type { SharerControls } from '@/features/screenShare/useScreenSharer';

interface ScreenShareButtonProps {
  controls: SharerControls;
  /** True when someone else is already sharing in this room */
  someoneElseSharing: boolean;
}

/**
 * The "Share Screen" / "Stop Sharing" button shown in the chat header.
 * The sharer sees state-aware feedback.
 * If someone else is sharing, the button is disabled.
 */
export function ScreenShareButton({ controls, someoneElseSharing }: ScreenShareButtonProps) {
  const { state, startSharing, stopSharing } = controls;

  const isSharing = state === 'sharing';
  const isPending = state === 'requesting' || state === 'stopping';
  const isDisabled = isPending || someoneElseSharing;

  if (isSharing) {
    return (
      <Button
        onClick={stopSharing}
        variant="destructive"
        size="sm"
        className="flex items-center gap-2 animate-pulse-slow font-semibold"
        title="Stop sharing your screen"
        id="stop-screen-share-btn"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
        </span>
        <MonitorOff className="h-4 w-4" />
        Stop Sharing
      </Button>
    );
  }

  return (
    <Button
      onClick={startSharing}
      variant="secondary"
      size="sm"
      disabled={isDisabled}
      className="flex items-center gap-2 font-medium"
      title={
        someoneElseSharing
          ? 'Another member is already sharing'
          : 'Share your screen with the group'
      }
      id="start-screen-share-btn"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Monitor className="h-4 w-4" />
      )}
      {state === 'requesting' ? 'Pick Screen…' : state === 'stopping' ? 'Stopping…' : 'Share Screen'}
    </Button>
  );
}
