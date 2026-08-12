import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SIGNALING_EVENTS, ICE_SERVERS, getSignalingChannelName } from './signalingProtocol';
import type { ScreenShareSession } from './screenShareApi';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type ViewerState =
  | 'idle'
  | 'connecting'    // Sent viewer-join, waiting for offer
  | 'watching'      // Stream is live and displayed
  | 'ended'         // Session ended by sharer
  | 'error';

interface UseViewerOptions {
  session: ScreenShareSession;
  userId: string;
  onEnded?: () => void;
  onError?: (msg: string) => void;
}

export interface ViewerControls {
  state: ViewerState;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  connect: () => Promise<void>;
  disconnect: () => void;
  errorMessage: string | null;
}

export function useScreenShareViewer({
  session,
  userId,
  onEnded,
  onError,
}: UseViewerOptions): ViewerControls {
  const [state, setState] = useState<ViewerState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const disconnect = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setState('idle');
  }, []);

  const connect = useCallback(async () => {
    if (state === 'watching' || state === 'connecting') return;

    setState('connecting');
    setErrorMessage(null);

    // Create peer connection (viewer is always the answerer)
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // When we receive remote tracks, attach them to the video element
    pc.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        setState('watching');
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        const msg = 'Connection to the sharer failed. The screen share may have ended.';
        setErrorMessage(msg);
        setState('error');
        onError?.(msg);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        setState('ended');
        onEnded?.();
      }
    };

    // Join the Supabase signaling channel for this session
    const channel = supabase.channel(getSignalingChannelName(session.id), {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    // Listen for the offer specifically addressed to us
    channel.on('broadcast', { event: `${SIGNALING_EVENTS.OFFER}:${userId}` }, async ({ payload }) => {
      const { offer, sharerId } = payload as { offer: RTCSessionDescriptionInit; sharerId: string };
      if (!pc || pc.signalingState !== 'stable') return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        channel.send({
          type: 'broadcast',
          event: `${SIGNALING_EVENTS.ANSWER}:${sharerId}`,
          payload: { answer: pc.localDescription?.toJSON(), viewerId: userId },
        });
      } catch (e: any) {
        const msg = `WebRTC negotiation failed: ${e.message}`;
        setErrorMessage(msg);
        setState('error');
        onError?.(msg);
      }
    });

    // Listen for ICE candidates addressed to us from the sharer
    channel.on(
      'broadcast',
      { event: `${SIGNALING_EVENTS.ICE_CANDIDATE}:${session.sharer_id}:${userId}` },
      async ({ payload }) => {
        const { candidate } = payload as { candidate: RTCIceCandidateInit };
        if (pc && candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('[ScreenShare viewer] addIceCandidate failed:', e);
          }
        }
      },
    );

    // Forward our ICE candidates to the sharer
    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      channel.send({
        type: 'broadcast',
        event: `${SIGNALING_EVENTS.ICE_CANDIDATE}:${session.sharer_id}`,
        payload: { candidate: candidate.toJSON(), viewerId: userId },
      });
    };

    // Listen for session-ended broadcast from the sharer
    channel.on('broadcast', { event: SIGNALING_EVENTS.SESSION_ENDED }, () => {
      setState('ended');
      disconnect();
      onEnded?.();
    });

    // Subscribe and then announce our presence so sharer creates an offer for us
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Announce to the sharer that we want to watch
        channel.send({
          type: 'broadcast',
          event: SIGNALING_EVENTS.VIEWER_JOIN,
          payload: { viewerId: userId },
        });
      }
    });
  }, [session, userId, state, disconnect, onEnded, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pcRef.current?.close();
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { state, videoRef, connect, disconnect, errorMessage };
}
