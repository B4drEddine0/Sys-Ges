import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { screenShareApi, type ScreenShareSession } from './screenShareApi';
import { SIGNALING_EVENTS, ICE_SERVERS, getSignalingChannelName } from './signalingProtocol';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type SharerState =
  | 'idle'
  | 'requesting'    // Waiting for browser screen picker
  | 'sharing'       // Actively sharing
  | 'stopping'      // Cleaning up
  | 'error';

interface PeerEntry {
  viewerId: string;
  pc: RTCPeerConnection;
}

interface UseSharerOptions {
  chatId: string;
  userId: string;
  onError?: (msg: string) => void;
}

export interface SharerControls {
  state: SharerState;
  session: ScreenShareSession | null;
  startSharing: () => Promise<void>;
  stopSharing: () => Promise<void>;
  errorMessage: string | null;
}

export function useScreenSharer({ chatId, userId, onError }: UseSharerOptions): SharerControls {
  const [state, setState] = useState<SharerState>('idle');
  const [session, setSession] = useState<ScreenShareSession | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs to avoid stale closures
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const sessionRef = useRef<ScreenShareSession | null>(null);

  // Keep sessionRef in sync with state
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  /**
   * Create an RTCPeerConnection for a new viewer.
   * The sharer is always the offerer; each viewer gets its own PC.
   */
  const createPeerForViewer = useCallback(
    async (viewerId: string, channel: RealtimeChannel) => {
      if (!streamRef.current) return;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      // Add all tracks from the screen stream to this peer connection
      streamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, streamRef.current!);
      });

      // Send ICE candidates to this viewer
      pc.onicecandidate = ({ candidate }) => {
        if (!candidate || !sessionRef.current) return;
        channel.send({
          type: 'broadcast',
          event: `${SIGNALING_EVENTS.ICE_CANDIDATE}:${userId}:${viewerId}`,
          payload: { candidate: candidate.toJSON() },
        });
      };

      // Handle peer disconnection
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peersRef.current.delete(viewerId);
          pc.close();
        }
      };

      peersRef.current.set(viewerId, pc);

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channel.send({
        type: 'broadcast',
        event: `${SIGNALING_EVENTS.OFFER}:${viewerId}`,
        payload: { offer: pc.localDescription?.toJSON(), sharerId: userId },
      });

      return pc;
    },
    [userId],
  );

  const stopSharing = useCallback(async () => {
    if (state === 'stopping' || state === 'idle') return;
    setState('stopping');

    const currentSession = sessionRef.current;
    const channel = channelRef.current;

    // 1. Broadcast session-ended to all viewers
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: SIGNALING_EVENTS.SESSION_ENDED,
        payload: { sessionId: currentSession?.id },
      });
    }

    // 2. Close all peer connections
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();

    // 3. Stop all media tracks (this also dismisses the browser "Stop sharing" UI)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // 4. Leave the Supabase channel
    if (channel) {
      await supabase.removeChannel(channel);
      channelRef.current = null;
    }

    // 5. Mark session as ended in the database
    if (currentSession) {
      await screenShareApi.endSession(currentSession.id).catch(console.error);
    }

    setSession(null);
    sessionRef.current = null;
    setState('idle');
    setErrorMessage(null);
  }, [state]);

  const startSharing = useCallback(async () => {
    if (state !== 'idle') return;

    // Check for browser support
    if (!navigator.mediaDevices?.getDisplayMedia) {
      const msg = 'Screen sharing is not supported in this browser. Try Chrome or Edge.';
      setErrorMessage(msg);
      setState('error');
      onError?.(msg);
      return;
    }

    setState('requesting');
    setErrorMessage(null);

    let stream: MediaStream;
    try {
      // Request the screen/window/tab from the user
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: false, // Audio sharing is opt-in and complex; screen-only for now
      });
    } catch (err: any) {
      // User cancelled the picker or denied permission
      const msg =
        err.name === 'NotAllowedError'
          ? 'Screen sharing permission was denied or cancelled.'
          : `Could not get screen: ${err.message}`;
      setErrorMessage(msg);
      setState('idle');
      onError?.(msg);
      return;
    }

    streamRef.current = stream;

    // Create DB session
    let newSession: ScreenShareSession;
    try {
      newSession = await screenShareApi.startSession(chatId);
    } catch (err: any) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const msg = `Failed to start session: ${err.message}`;
      setErrorMessage(msg);
      setState('error');
      onError?.(msg);
      return;
    }

    setSession(newSession);
    sessionRef.current = newSession;
    setState('sharing');

    // Join the Supabase Realtime channel for this session
    const channel = supabase.channel(getSignalingChannelName(newSession.id), {
      config: { broadcast: { self: false } },
    });

    channelRef.current = channel;

    // Listen for viewers wanting to connect
    channel.on('broadcast', { event: SIGNALING_EVENTS.VIEWER_JOIN }, async ({ payload }) => {
      const { viewerId } = payload as { viewerId: string };
      if (!viewerId || viewerId === userId) return;
      await createPeerForViewer(viewerId, channel);
    });

    // Listen for answers from viewers
    channel.on('broadcast', { event: `${SIGNALING_EVENTS.ANSWER}:${userId}` }, async ({ payload }) => {
      const { answer, viewerId } = payload as { answer: RTCSessionDescriptionInit; viewerId: string };
      const pc = peersRef.current.get(viewerId);
      if (pc && pc.signalingState !== 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (e) {
          console.warn('[ScreenShare sharer] setRemoteDescription failed:', e);
        }
      }
    });

    // Listen for ICE candidates from viewers
    channel.on('broadcast', { event: `${SIGNALING_EVENTS.ICE_CANDIDATE}:${userId}` }, async ({ payload }) => {
      const { candidate, viewerId } = payload as { candidate: RTCIceCandidateInit; viewerId: string };
      const pc = peersRef.current.get(viewerId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[ScreenShare sharer] addIceCandidate failed:', e);
        }
      }
    });

    await channel.subscribe();

    // Detect if the user stops sharing via the browser's native "Stop sharing" button
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        // The browser stopped the stream (user clicked browser "Stop sharing")
        void stopSharing();
      });
    });
  }, [state, chatId, userId, createPeerForViewer, stopSharing, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Best-effort cleanup when component unmounts (e.g. user navigates away)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (channelRef.current) {
        if (sessionRef.current) {
          // Fire-and-forget
          void screenShareApi.endSession(sessionRef.current.id);
          channelRef.current.send({
            type: 'broadcast',
            event: SIGNALING_EVENTS.SESSION_ENDED,
            payload: { sessionId: sessionRef.current.id },
          });
        }
        void supabase.removeChannel(channelRef.current);
      }
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { state, session, startSharing, stopSharing, errorMessage };
}
