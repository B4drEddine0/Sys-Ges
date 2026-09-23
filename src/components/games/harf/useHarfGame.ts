import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORIES,
  COUNTDOWN_MS,
  PLAYER_COLORS,
  SUBMIT_GRACE_MS,
  initialState,
  pickLetter,
  revealStepMs,
  sanitizeAnswers,
  scoreRound,
  type HarfState,
} from './harfLogic';

// The room channel is created (and already subscribed) by OnlineGameWrapper, and
// supabase-js has no way to remove a `.on()` binding. So bindings are registered once
// per channel/event and fan out to a Set of listeners we can add to and remove from —
// otherwise React StrictMode remounts would stack duplicate handlers.
const registry = new WeakMap<object, Map<string, Set<(payload: any) => void>>>();
function listen(channel: any, event: string, fn: (payload: any) => void) {
  let events = registry.get(channel);
  if (!events) {
    events = new Map();
    registry.set(channel, events);
  }
  let set = events.get(event);
  if (!set) {
    const created = new Set<(payload: any) => void>();
    set = created;
    events.set(event, created);
    channel.on('broadcast', { event }, (msg: any) => created.forEach((f) => f(msg.payload)));
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
  };
}

interface Options {
  channel: any;
  isHost: boolean;
  myKey: string;
  playerKeys: string[];
  playerNames: string[];
}

export function useHarfGame({ channel, isHost, myKey, playerKeys, playerNames }: Options) {
  const [state, setState] = useState<HarfState | null>(() => (isHost ? initialState() : null));
  const stateRef = useRef<HarfState | null>(state);
  const answersRef = useRef<Record<string, string[]>>({});
  const offsetRef = useRef(0);
  const [localLockedRound, setLocalLockedRound] = useState(-1);

  const roster = useMemo(
    () => playerKeys.map((key, i) => ({ key, name: playerNames[i] && playerNames[i] !== 'Player' ? playerNames[i] : `لاعب ${i + 1}` })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playerKeys.join('|'), playerNames.join('|')],
  );
  const rosterRef = useRef(roster);
  rosterRef.current = roster;

  const send = useCallback(
    (event: string, payload: unknown) => channel?.send({ type: 'broadcast', event, payload }),
    [channel],
  );

  // ---------- host: single source of truth ----------
  const commit = (patch: Partial<HarfState>) => {
    const next = { ...stateRef.current!, ...patch, now: Date.now() };
    stateRef.current = next;
    setState(next);
    send('harf_state', next);
  };

  const connectedKeys = () => new Set(rosterRef.current.map((r) => r.key));

  const startRound = (round: number) => {
    const s = stateRef.current!;
    const letter = pickLetter(s.usedLetters);
    const conn = connectedKeys();
    answersRef.current = {};
    commit({
      phase: 'round_start',
      round,
      letter,
      usedLetters: [...s.usedLetters, letter],
      active: s.players.filter((p) => conn.has(p.key)).map((p) => p.key),
      submitted: {},
      progress: {},
      results: null,
      roundPoints: {},
      revealIndex: 0,
      phaseEndsAt: Date.now() + COUNTDOWN_MS,
    });
  };

  const toPlaying = () => commit({ phase: 'playing', phaseEndsAt: Date.now() + stateRef.current!.roundSeconds * 1000 });

  const toReveal = () => {
    const s = stateRef.current!;
    const { results, roundPoints } = scoreRound(s.active, answersRef.current, s.letter);
    commit({
      phase: 'reveal',
      revealIndex: 0,
      results,
      roundPoints,
      phaseEndsAt: Date.now() + revealStepMs(s.active.length),
    });
  };

  const toRoundResults = () => {
    const s = stateRef.current!;
    const scores = { ...s.scores };
    const history = { ...s.history };
    s.players.forEach((p) => {
      const pts = s.roundPoints[p.key] ?? 0;
      scores[p.key] = (scores[p.key] ?? 0) + pts;
      history[p.key] = [...(history[p.key] ?? []), pts];
    });
    commit({ phase: 'round_results', prevScores: s.scores, scores, history, phaseEndsAt: null });
  };

  const advance = () => {
    const s = stateRef.current!;
    if (s.phase === 'round_start') toPlaying();
    else if (s.phase === 'reveal') {
      if (s.revealIndex + 1 < CATEGORIES.length) {
        commit({ revealIndex: s.revealIndex + 1, phaseEndsAt: Date.now() + revealStepMs(s.active.length) });
      } else toRoundResults();
    }
  };

  const receiveSubmit = (key: string, raw: unknown) => {
    const s = stateRef.current;
    if (!s || s.phase !== 'playing' || !s.active.includes(key) || s.submitted[key]) return;
    const answers = sanitizeAnswers(raw);
    answersRef.current[key] = answers;
    commit({
      submitted: { ...s.submitted, [key]: true },
      progress: { ...s.progress, [key]: answers.filter(Boolean).length },
    });
  };

  const receiveProgress = (key: string, count: unknown) => {
    const s = stateRef.current;
    if (!s || s.phase !== 'playing' || s.submitted[key] || typeof count !== 'number') return;
    if (s.progress[key] === count) return;
    commit({ progress: { ...s.progress, [key]: count } });
  };

  const hostApi = useRef({ advance, toReveal, receiveSubmit, receiveProgress, commit, startRound });
  hostApi.current = { advance, toReveal, receiveSubmit, receiveProgress, commit, startRound };

  // Keep the host's player list in step with room presence (join / leave / rename).
  useEffect(() => {
    if (!isHost || !stateRef.current) return;
    const s = stateRef.current;
    const conn = new Set(roster.map((r) => r.key));
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
    void conn;
  }, [isHost, roster]);

  // Phase timers (host only).
  const allDone =
    !!state &&
    state.phase === 'playing' &&
    (() => {
      const live = state.active.filter((k) => state.players.find((p) => p.key === k)?.connected);
      return live.length > 0 && live.every((k) => state.submitted[k]);
    })();

  useEffect(() => {
    if (!isHost || !state) return;
    const { phase, phaseEndsAt } = state;
    if (phase === 'lobby' || phase === 'round_results' || phaseEndsAt == null) return;
    let delay = phaseEndsAt - Date.now();
    let run = () => hostApi.current.advance();
    if (phase === 'playing') {
      run = () => hostApi.current.toReveal();
      delay = allDone ? 900 : delay + SUBMIT_GRACE_MS;
    }
    const t = setTimeout(run, Math.max(0, delay));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.round, state?.revealIndex, allDone]);

  // ---------- messaging ----------
  useEffect(() => {
    if (!channel) return;
    const offs: Array<() => void> = [];
    if (isHost) {
      offs.push(listen(channel, 'harf_hello', () => stateRef.current && send('harf_state', { ...stateRef.current, now: Date.now() })));
      offs.push(listen(channel, 'harf_submit', (p) => hostApi.current.receiveSubmit(p.key, p.answers)));
      offs.push(listen(channel, 'harf_progress', (p) => hostApi.current.receiveProgress(p.key, p.count)));
      offs.push(
        listen(channel, 'harf_next', () => {
          if (stateRef.current?.phase === 'reveal') hostApi.current.advance();
        }),
      );
      // Re-announce in case guests bound their listeners after the first snapshot.
      if (stateRef.current) send('harf_state', { ...stateRef.current, now: Date.now() });
    } else {
      offs.push(
        listen(channel, 'harf_state', (p: HarfState) => {
          offsetRef.current = p.now - Date.now();
          stateRef.current = p;
          setState(p);
        }),
      );
    }
    return () => offs.forEach((f) => f());
  }, [channel, isHost, send]);

  // Guests (also after a refresh) ask the host for the current snapshot until it arrives.
  const hasState = !!state;
  useEffect(() => {
    if (isHost || !channel || hasState) return;
    send('harf_hello', { key: myKey });
    const t = setInterval(() => send('harf_hello', { key: myKey }), 1500);
    return () => clearInterval(t);
  }, [isHost, channel, hasState, myKey, send]);

  // ---------- actions ----------
  const start = (settings: { roundSeconds: number }) => {
    if (!isHost) return;
    hostApi.current.commit({ ...settings, totalRounds: 1, scores: {}, prevScores: {}, history: {}, usedLetters: [] });
    hostApi.current.startRound(1);
  };

  const submit = (answers: string[]) => {
    const s = stateRef.current;
    if (!s) return;
    if (isHost) hostApi.current.receiveSubmit(myKey, answers);
    else {
      setLocalLockedRound(s.round);
      send('harf_submit', { key: myKey, answers });
    }
  };

  const reportProgress = (count: number) => {
    if (isHost) hostApi.current.receiveProgress(myKey, count);
    else send('harf_progress', { key: myKey, count });
  };

  const next = () => {
    if (isHost) {
      if (stateRef.current?.phase === 'reveal') hostApi.current.advance();
    } else send('harf_next', {});
  };

  // Another round with a fresh letter; the scoreboard keeps accumulating.
  const playAgain = () => {
    if (isHost && stateRef.current?.phase === 'round_results') hostApi.current.startRound(stateRef.current.round + 1);
  };

  const getNow = useCallback(() => Date.now() + offsetRef.current, []);
  const locked = !!state && (!!state.submitted[myKey] || localLockedRound === state.round);

  return { state, locked, getNow, actions: { start, submit, reportProgress, next, playAgain } };
}
