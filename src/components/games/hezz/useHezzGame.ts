import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '../shared/channelBus';
import { applyAction, emptyLobbyState, startGame, type Action, type Card, type EngineState, type PlayerMeta, type PublicState, type Suit } from './hezzLogic';

const PLAYER_COLORS_COUNT = 8; // just needs to exceed any realistic table size

interface Options {
  channel: any;
  isHost: boolean;
  myKey: string;
  playerKeys: string[];
  playerNames: string[];
}

/**
 * Networking layer for Hezz Jouj. Mirrors the host-authoritative pattern every other
 * online game in this app uses (see useHarfGame.ts) — there's no real backend game
 * server here, the host's browser tab runs the engine and is trusted by convention, same
 * as Pong/Checkers/Harf/Wobble Race. The one thing done differently from those games:
 * hands are never included in the broadcast `PublicState` at all, and each player's hand
 * is sent as a separate "whisper" event addressed to just that player's key — every
 * other client ignores it. That keeps opponents' cards out of this app's own UI/state
 * the same way Harf keeps answers hidden pre-reveal. It is NOT cryptographic privacy:
 * broadcast is still plain traffic on a shared channel, so a player who opens devtools
 * and reads raw websocket frames could see messages addressed to others. Real hidden
 * information would need an actual authoritative server, which this project doesn't have.
 */
export function useHezzGame({ channel, isHost, myKey, playerKeys, playerNames }: Options) {
  const [state, setState] = useState<PublicState | null>(() => (isHost ? emptyLobbyState() : null));
  const [myHand, setMyHand] = useState<Card[]>([]);
  // `stateRef` is always the latest PublicState once the host has mounted (lobby or
  // in-game). `engineRef` only exists once a game has actually been dealt — it holds the
  // private hands/draw pile a lobby snapshot has no need for.
  const stateRef = useRef<PublicState | null>(state);
  const engineRef = useRef<EngineState | null>(null);
  const lastSeqRef = useRef(-1);

  const roster = useMemo(
    () => playerKeys.map((key, i) => ({ key, name: playerNames[i] && playerNames[i] !== 'Player' ? playerNames[i] : `Player ${i + 1}` })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playerKeys.join('|'), playerNames.join('|')],
  );
  const rosterRef = useRef(roster);
  rosterRef.current = roster;

  const send = useCallback((event: string, payload: unknown) => channel?.send({ type: 'broadcast', event, payload }), [channel]);

  // ---------- host: single source of truth ----------
  const commitPublic = (pub: PublicState) => {
    stateRef.current = pub;
    setState(pub);
    send('hezz_state', pub);
  };

  const broadcastEngine = (engine: EngineState) => {
    engineRef.current = engine;
    commitPublic(engine.public);
    rosterRef.current.forEach((r) => send('hezz_hand', { to: r.key, hand: engine.hands[r.key] ?? [] }));
    if (engine.hands[myKey]) setMyHand(engine.hands[myKey]);
  };

  const hostStart = (handSize: 4 | 6) => {
    const names: Record<string, string> = {};
    const colors: Record<string, number> = {};
    rosterRef.current.forEach((r, i) => {
      names[r.key] = r.name;
      colors[r.key] = i % PLAYER_COLORS_COUNT;
    });
    const engine = startGame({ playerKeys: rosterRef.current.map((r) => r.key), playerNames: names, playerColors: colors, handSize });
    broadcastEngine(engine);
  };

  const hostApply = (action: Action) => {
    if (!engineRef.current) return;
    const res = applyAction(engineRef.current, action);
    if (res.ok) broadcastEngine(res.state);
    // Silently ignored if illegal (e.g. a stale/duplicate client request) — the host's
    // state is authoritative and simply doesn't change, so clients just see no update.
  };

  const hostApi = useRef({ hostStart, hostApply, broadcastEngine, commitPublic });
  hostApi.current = { hostStart, hostApply, broadcastEngine, commitPublic };

  // Keep the lobby's visible player list in step with room presence (join/leave/rename),
  // same as Harf/Wobble — only touches state while nobody has dealt a game yet; once
  // play starts, `players` is owned by the engine (hand counts, finished flags, etc).
  useEffect(() => {
    if (!isHost || !stateRef.current || stateRef.current.phase !== 'lobby') return;
    const pub = stateRef.current;
    const players: Record<string, PlayerMeta> = {};
    roster.forEach((r, i) => {
      const existing = pub.players[r.key];
      players[r.key] = existing
        ? { ...existing, name: r.name, connected: true }
        : { key: r.key, name: r.name, color: i % PLAYER_COLORS_COUNT, connected: true, finished: false, finishOrder: null, handCount: 0 };
    });
    if (JSON.stringify(players) !== JSON.stringify(pub.players)) {
      hostApi.current.commitPublic({ ...pub, players, order: roster.map((r) => r.key) });
    }
  }, [isHost, roster]);

  // ---------- messaging ----------
  useEffect(() => {
    if (!channel) return;
    const offs: Array<() => void> = [];
    if (isHost) {
      offs.push(
        listen(channel, 'hezz_hello', (p) => {
          if (stateRef.current) send('hezz_state', stateRef.current);
          if (engineRef.current) send('hezz_hand', { to: p.key, hand: engineRef.current.hands[p.key] ?? [] });
        }),
      );
      offs.push(listen(channel, 'hezz_action', (p) => hostApi.current.hostApply(p.action)));
      if (stateRef.current) send('hezz_state', stateRef.current);
    } else {
      offs.push(
        listen(channel, 'hezz_state', (p: PublicState) => {
          if (p.seq < lastSeqRef.current) return; // stale/out-of-order — ignore
          lastSeqRef.current = p.seq;
          stateRef.current = p;
          setState(p);
        }),
      );
      offs.push(
        listen(channel, 'hezz_hand', (p: { to: string; hand: Card[] }) => {
          if (p.to !== myKey) return; // not addressed to me — never render it
          setMyHand(p.hand);
        }),
      );
    }
    return () => offs.forEach((f) => f());
  }, [channel, isHost, myKey, send]);

  // Guests (and refreshes) ask the host to resend the latest snapshot + their own hand.
  const hasState = !!state;
  useEffect(() => {
    if (isHost || !channel || hasState) return;
    send('hezz_hello', { key: myKey });
    const t = setInterval(() => send('hezz_hello', { key: myKey }), 1500);
    return () => clearInterval(t);
  }, [isHost, channel, hasState, myKey, send]);

  // ---------- public API ----------
  const start = (handSize: 4 | 6) => {
    if (isHost) hostApi.current.hostStart(handSize);
  };

  const play = (cardId: string, chosenSuit?: Suit) => {
    const action: Action = { type: 'play', player: myKey, cardId, chosenSuit };
    if (isHost) hostApi.current.hostApply(action);
    else send('hezz_action', { action });
  };

  const draw = () => {
    const action: Action = { type: 'draw', player: myKey };
    if (isHost) hostApi.current.hostApply(action);
    else send('hezz_action', { action });
  };

  const playAgain = (handSize: 4 | 6) => {
    if (isHost) hostApi.current.hostStart(handSize);
  };

  return { state, myHand, actions: { start, play, draw, playAgain } };
}
