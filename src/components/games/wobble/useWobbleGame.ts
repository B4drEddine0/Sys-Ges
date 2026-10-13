import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '../shared/channelBus';
import { BASE_LEVEL, COUNTDOWN_MS, PLAYER_COLORS, POINTS_BY_RANK, RACE_TIME_CAP_MS, levelForSeed, randomSeed, type Level } from './wobbleLogic';

export type WobblePhase = 'lobby' | 'countdown' | 'racing' | 'results';

export interface WobblePlayer {
  key: string;
  name: string;
  color: number;
  connected: boolean;
}

export interface WobbleFinish {
  rank: number;
  timeMs: number;
}

export interface WobbleState {
  phase: WobblePhase;
  raceNum: number;
  players: WobblePlayer[];
  active: string[];
  raceStartAt: number | null;
  raceEndsAt: number | null;
  /** Drives levelForSeed() so every client renders obstacles in the exact same places. */
  seed: number;
  finishes: Record<string, WobbleFinish>;
  scores: Record<string, number>;
  prevScores: Record<string, number>;
  history: Record<string, number[]>;
  now: number;
}

function initialState(): WobbleState {
  return {
    phase: 'lobby',
    raceNum: 0,
    players: [],
    active: [],
    raceStartAt: null,
    raceEndsAt: null,
    seed: 0,
    finishes: {},
    scores: {},
    prevScores: {},
    history: {},
    now: Date.now(),
  };
}

// A remote racer's last couple of position snapshots, interpolated toward on every
// render frame. Kept out of React state entirely — at ~12 snapshots/sec/player this
// would otherwise cause a re-render storm; the canvas reads it imperatively instead.
export interface RemoteSnap {
  x: number;
  y: number;
  facing: 1 | -1;
  anim: 'idle' | 'run' | 'air' | 'hit' | 'finished';
  renderX: number;
  renderY: number;
  fromX: number;
  fromY: number;
  tStart: number;
  tDur: number;
}

interface Options {
  channel: any;
  isHost: boolean;
  myKey: string;
  playerKeys: string[];
  playerNames: string[];
}

export function useWobbleGame({ channel, isHost, myKey, playerKeys, playerNames }: Options) {
  const [state, setState] = useState<WobbleState | null>(() => (isHost ? initialState() : null));
  const stateRef = useRef<WobbleState | null>(state);
  const offsetRef = useRef(0);
  const remotes = useRef<Map<string, RemoteSnap>>(new Map());

  const roster = useMemo(
    () => playerKeys.map((key, i) => ({ key, name: playerNames[i] && playerNames[i] !== 'Player' ? playerNames[i] : `Player ${i + 1}` })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playerKeys.join('|'), playerNames.join('|')],
  );
  const rosterRef = useRef(roster);
  rosterRef.current = roster;

  const send = useCallback((event: string, payload: unknown) => channel?.send({ type: 'broadcast', event, payload }), [channel]);

  const commit = (patch: Partial<WobbleState>) => {
    const next = { ...stateRef.current!, ...patch, now: Date.now() };
    stateRef.current = next;
    setState(next);
    send('wobble_state', next);
  };

  // ---------- host logic ----------
  const startRace = () => {
    const s = stateRef.current!;
    const conn = new Set(rosterRef.current.map((r) => r.key));
    remotes.current.clear();
    commit({
      phase: 'countdown',
      raceNum: s.raceNum + 1,
      active: s.players.filter((p) => conn.has(p.key)).map((p) => p.key),
      finishes: {},
      seed: randomSeed(),
      raceStartAt: Date.now() + COUNTDOWN_MS,
      raceEndsAt: null,
    });
  };

  const toRacing = () => {
    const s = stateRef.current!;
    const now = Date.now();
    commit({ phase: 'racing', raceStartAt: now, raceEndsAt: now + RACE_TIME_CAP_MS });
    void s;
  };

  const finishRaceIfDone = () => {
    const s = stateRef.current;
    if (!s || s.phase !== 'racing') return;
    const live = s.active.filter((k) => s.players.find((p) => p.key === k)?.connected);
    if (live.length > 0 && live.every((k) => s.finishes[k])) endRace();
  };

  const endRace = () => {
    const s = stateRef.current!;
    const scores = { ...s.scores };
    const history = { ...s.history };
    s.players.forEach((p) => {
      const pts = s.active.includes(p.key) ? POINTS_BY_RANK[(s.finishes[p.key]?.rank ?? 99) - 1] ?? 0 : 0;
      scores[p.key] = (scores[p.key] ?? 0) + pts;
      history[p.key] = [...(history[p.key] ?? []), pts];
    });
    commit({ phase: 'results', prevScores: s.scores, scores, history, raceEndsAt: null });
  };

  const receiveFinish = (key: string, timeMs: unknown) => {
    const s = stateRef.current;
    if (!s || s.phase !== 'racing' || !s.active.includes(key) || s.finishes[key] || typeof timeMs !== 'number') return;
    const rank = Object.keys(s.finishes).length + 1;
    commit({ finishes: { ...s.finishes, [key]: { rank, timeMs } } });
    setTimeout(finishRaceIfDone, 0);
  };

  const hostApi = useRef({ startRace, toRacing, endRace, finishRaceIfDone, receiveFinish, commit });
  hostApi.current = { startRace, toRacing, endRace, finishRaceIfDone, receiveFinish, commit };

  // Keep the host's roster in step with room presence.
  useEffect(() => {
    if (!isHost || !stateRef.current) return;
    const s = stateRef.current;
    const players = s.players.map((p) => {
      const r = roster.find((x) => x.key === p.key);
      return { ...p, name: r?.name ?? p.name, connected: !!r };
    });
    roster.forEach((r) => {
      if (!players.some((p) => p.key === r.key)) {
        const used = new Set(players.map((p) => p.color));
        const color = PLAYER_COLORS.findIndex((_, i) => !used.has(i));
        players.push({ key: r.key, name: r.name, color: color >= 0 ? color : players.length % PLAYER_COLORS.length, connected: true });
      }
    });
    if (JSON.stringify(players) !== JSON.stringify(s.players)) hostApi.current.commit({ players });
  }, [isHost, roster]);

  // Host phase timers: countdown -> racing, and the 90s race time cap.
  useEffect(() => {
    if (!isHost || !state) return;
    if (state.phase === 'countdown' && state.raceStartAt) {
      const t = setTimeout(() => hostApi.current.toRacing(), Math.max(0, state.raceStartAt - Date.now()));
      return () => clearTimeout(t);
    }
    if (state.phase === 'racing' && state.raceEndsAt) {
      const t = setTimeout(() => hostApi.current.endRace(), Math.max(0, state.raceEndsAt - Date.now()));
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.raceStartAt, state?.raceEndsAt]);

  // ---------- messaging ----------
  useEffect(() => {
    if (!channel) return;
    const offs: Array<() => void> = [];
    if (isHost) {
      offs.push(listen(channel, 'wobble_hello', () => stateRef.current && send('wobble_state', { ...stateRef.current, now: Date.now() })));
      offs.push(listen(channel, 'wobble_finish', (p) => hostApi.current.receiveFinish(p.key, p.timeMs)));
      if (stateRef.current) send('wobble_state', { ...stateRef.current, now: Date.now() });
    } else {
      offs.push(
        listen(channel, 'wobble_state', (p: WobbleState) => {
          offsetRef.current = p.now - Date.now();
          stateRef.current = p;
          setState(p);
        }),
      );
    }
    // Position sync: every client (host included) listens directly, no host relay needed.
    offs.push(
      listen(channel, 'wobble_pos', (p: any) => {
        if (p.key === myKey) return;
        const now = performance.now();
        const prevSnap = remotes.current.get(p.key);
        const fromX = prevSnap ? prevSnap.renderX : p.x;
        const fromY = prevSnap ? prevSnap.renderY : p.y;
        remotes.current.set(p.key, {
          x: p.x,
          y: p.y,
          facing: p.facing,
          anim: p.anim,
          renderX: fromX,
          renderY: fromY,
          fromX,
          fromY,
          tStart: now,
          tDur: prevSnap ? Math.min(220, Math.max(50, now - prevSnap.tStart)) : 80,
        });
      }),
    );
    return () => offs.forEach((f) => f());
  }, [channel, isHost, myKey, send]);

  const hasState = !!state;
  useEffect(() => {
    if (isHost || !channel || hasState) return;
    send('wobble_hello', { key: myKey });
    const t = setInterval(() => send('wobble_hello', { key: myKey }), 1500);
    return () => clearInterval(t);
  }, [isHost, channel, hasState, myKey, send]);

  // ---------- public API ----------
  const start = () => {
    if (isHost) hostApi.current.startRace();
  };

  const playAgain = () => {
    if (isHost && stateRef.current?.phase === 'results') hostApi.current.startRace();
  };

  const reportFinish = (timeMs: number) => {
    if (isHost) hostApi.current.receiveFinish(myKey, timeMs);
    else send('wobble_finish', { key: myKey, timeMs });
  };

  const sendPos = useCallback(
    (x: number, y: number, facing: 1 | -1, anim: RemoteSnap['anim']) => send('wobble_pos', { key: myKey, x, y, facing, anim }),
    [send, myKey],
  );

  const getNow = useCallback(() => Date.now() + offsetRef.current, []);
  const level = useMemo(() => (state?.seed ? levelForSeed(state.seed) : BASE_LEVEL), [state?.seed]);

  /** Imperative read for the canvas's render loop — interpolates each remote racer toward its last snapshot. */
  const getRemotePositions = useCallback(() => {
    const now = performance.now();
    const out: Record<string, { x: number; y: number; facing: 1 | -1; anim: RemoteSnap['anim'] }> = {};
    remotes.current.forEach((snap, key) => {
      const k = snap.tDur <= 0 ? 1 : Math.min(1, (now - snap.tStart) / snap.tDur);
      snap.renderX = snap.fromX + (snap.x - snap.fromX) * k;
      snap.renderY = snap.fromY + (snap.y - snap.fromY) * k;
      out[key] = { x: snap.renderX, y: snap.renderY, facing: snap.facing, anim: snap.anim };
    });
    return out;
  }, []);

  return {
    state,
    level,
    getNow,
    getRemotePositions,
    actions: { start, playAgain, reportFinish, sendPos },
  };
}
