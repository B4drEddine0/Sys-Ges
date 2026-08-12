/**
 * WebRTC + Supabase Realtime Signaling Protocol
 * -----------------------------------------------
 * We use Supabase Realtime Broadcast channels (NOT Postgres CDC) for signaling.
 * Each screen-share session gets its own ephemeral channel: `screen-share:{sessionId}`
 *
 * The signaling flow (simplified SFU-less mesh for N viewers):
 *
 * SHARER side:
 *  1. Creates session in DB → gets sessionId
 *  2. Joins channel `screen-share:{sessionId}` as sharer
 *  3. Listens for 'viewer-join' events → for each one, creates a new RTCPeerConnection,
 *     captures the screen stream, creates an offer, and broadcasts 'offer:{viewerId}'
 *  4. Listens for 'answer:{sharerId}:{viewerId}' and sets remote description
 *  5. Listens for 'ice-candidate:{viewerId}:{sharerId}' and adds ICE candidates
 *  6. When stopping: broadcasts 'session-ended', updates DB, closes all connections
 *
 * VIEWER side:
 *  1. Fetches active session from DB (so they know the sessionId)
 *  2. Joins channel `screen-share:{sessionId}`
 *  3. Broadcasts 'viewer-join' with their userId
 *  4. Receives 'offer:{viewerId}' → creates answer → broadcasts 'answer:{sharerId}:{viewerId}'
 *  5. Receives 'ice-candidate:{sharerId}:{viewerId}' and adds ICE candidates
 *  6. On 'session-ended' or channel disappears → shows ended state
 *
 * Security:
 *  - Channel names include the sessionId (UUID), which is only known if you can read from the
 *    screen_share_sessions table, which requires being a chat_member (enforced by RLS).
 *  - Supabase Broadcast channels require a valid JWT (anon key is fine for authenticated users).
 *  - No service role key is used anywhere.
 */

export const SIGNALING_EVENTS = {
  VIEWER_JOIN: 'viewer-join',
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice-candidate',
  SESSION_ENDED: 'session-ended',
} as const;

/**
 * STUN servers used for ICE negotiation.
 * Using Google's public STUN servers — no TURN server needed for most LAN/office use cases.
 * For production, add TURN servers here.
 */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function getSignalingChannelName(sessionId: string): string {
  return `screen-share:${sessionId}`;
}
