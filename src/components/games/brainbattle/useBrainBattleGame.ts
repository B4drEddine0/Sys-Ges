import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '../shared/channelBus';
import { randomSeed } from '../shared/rng';
import {
  checkMcqAnswer,
  checkTextAnswer,
  computeDeadline,
  computePoints,
  redactQuestion,
  selectQuestions,
  type Difficulty,
  type McqQuestion,
  type PublicQuestion,
  type QType,
  type Question,
  type TextQuestion,
} from './battleLogic';
import { QUESTION_BANK } from './questionBank';

export type BattlePhase = 'lobby' | 'round_start' | 'answering' | 'reveal' | 'round_results' | 'final';

export interface BBPlayer {
  key: string;
  name: string;
  color: number;
  connected: boolean;
}

export interface RoundResult {
  key: string;
  answered: boolean;
  correct: boolean;
  timeMs: number;
  points: number;
  isFirstCorrect: boolean;
  display: string; // what they submitted, or '' if they didn't answer — safe to show post-reveal
}

export interface BattleSettings {
  totalRounds: number;
  timeLimitMs: number;
  graceMs: number;
  types: QType[];
  difficulties: Difficulty[];
}

export const DEFAULT_SETTINGS: BattleSettings = {
  totalRounds: 8,
  timeLimitMs: 25000,
  graceMs: 10000,
  types: ['mcq_general', 'mcq_proverb', 'mcq_connection', 'scramble', 'hidden_word', 'riddle'],
  difficulties: ['easy', 'medium', 'hard', 'expert'],
};

const COUNTDOWN_MS = 2600;
const REVEAL_MS = 5500;
const RESULTS_MS = 4500;

export interface BattlePublicState {
  phase: BattlePhase;
  round: number;
  totalRounds: number;
  players: Record<string, BBPlayer>;
  active: string[];
  question: PublicQuestion | null;
  revealQuestion: Question | null;
  roundStartAt: number | null;
  phaseEndsAt: number | null; // used for round_start/reveal/round_results display timers
  timeLimitMs: number;
  graceMs: number;
  firstSubmitAt: number | null;
  deadlineAt: number | null;
  submittedKeys: string[];
  results: Record<string, RoundResult> | null;
  scores: Record<string, number>;
  prevScores: Record<string, number>;
  history: Record<string, number[]>;
  firstCorrectHistory: Record<string, number>; // how many rounds each player was first-correct in
  usedIds: string[];
  seed: number;
  now: number;
  seq: number;
}

function initialLobbyState(): BattlePublicState {
  return {
    phase: 'lobby',
    round: 0,
    totalRounds: DEFAULT_SETTINGS.totalRounds,
    players: {},
    active: [],
    question: null,
    revealQuestion: null,
    roundStartAt: null,
    phaseEndsAt: null,
    timeLimitMs: DEFAULT_SETTINGS.timeLimitMs,
    graceMs: DEFAULT_SETTINGS.graceMs,
    firstSubmitAt: null,
    deadlineAt: null,
    submittedKeys: [],
    results: null,
    scores: {},
    prevScores: {},
    history: {},
    firstCorrectHistory: {},
    usedIds: [],
    seed: 0,
    now: Date.now(),
    seq: 0,
  };
}

const PLAYER_COLORS_COUNT = 10;

interface Options {
  channel: any;
  isHost: boolean;
  myKey: string;
  playerKeys: string[];
  playerNames: string[];
  hostConnected: boolean;
}

/**
 * Networking layer for Brain Battle. Same host-authoritative pattern as every other
 * online game here (see useHarfGame.ts / useHezzGame.ts) — the room host's browser tab
 * is trusted by convention, there's no real backend game server in this project. The
 * correct answer is kept out of the broadcast `question` entirely during 'answering' (a
 * redacted `PublicQuestion`) and only included once the phase flips to 'reveal' — same
 * discipline as Hezz's hidden hands and Harf's hidden answers pre-reveal. As with those,
 * this is "kept out of this app's own UI/state," not cryptographically secret from
 * someone reading raw websocket frames.
 */
export function useBrainBattleGame({ channel, isHost, myKey, playerKeys, playerNames, hostConnected }: Options) {
  const [state, setState] = useState<BattlePublicState | null>(() => (isHost ? initialLobbyState() : null));
  const stateRef = useRef<BattlePublicState | null>(state);
  // The FULL, un-redacted current question (host-only) — never broadcast until reveal.
  const liveQuestionRef = useRef<Question | null>(null);
  const firstCorrectKeyRef = useRef<string | null>(null);
  // Hook-owned, strictly increasing for the whole room session — see the writeup on the
  // identical bug this fixed in Hezz Jouj's "Play Again": trusting a per-game counter
  // that resets on restart makes a fresh game's broadcast look "stale" to guests.
  const broadcastSeqRef = useRef(0);
  const lastSeqRef = useRef(-1);
  const offsetRef = useRef(0); // host-clock - local-clock, derived from each broadcast's `now`

  const roster = useMemo(
    () => playerKeys.map((key, i) => ({ key, name: playerNames[i] && playerNames[i] !== 'Player' ? playerNames[i] : `لاعب ${i + 1}` })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playerKeys.join('|'), playerNames.join('|')],
  );
  const rosterRef = useRef(roster);
  rosterRef.current = roster;

  const send = useCallback((event: string, payload: unknown) => channel?.send({ type: 'broadcast', event, payload }), [channel]);

  const commit = (patch: Partial<BattlePublicState>) => {
    const next: BattlePublicState = { ...stateRef.current!, ...patch, now: Date.now(), seq: ++broadcastSeqRef.current };
    stateRef.current = next;
    setState(next);
    send('bb_state', next);
  };

  // ---------- host round logic ----------
  const startRound = (settings?: BattleSettings) => {
    const s = stateRef.current!;
    const cfg: BattleSettings = settings ?? { totalRounds: s.totalRounds, timeLimitMs: s.timeLimitMs, graceMs: s.graceMs, types: DEFAULT_SETTINGS.types, difficulties: DEFAULT_SETTINGS.difficulties };
    // Active players for this round = whoever's currently connected. For round 1 that's
    // the whole lobby roster; for later rounds it's recomputed fresh each time too (not
    // carried over from the previous round's snapshot), so a player who joined mid-game
    // is included starting next round, and one who left drops out.
    const activeFinal = rosterRef.current.map((r) => r.key);

    const used = new Set(s.usedIds);
    const [question] = selectQuestions(QUESTION_BANK, 1, used, { types: cfg.types, difficulties: cfg.difficulties }, Math.random);
    liveQuestionRef.current = question ?? null;
    firstCorrectKeyRef.current = null;
    const seed = randomSeed();

    commit({
      phase: 'round_start',
      round: s.round + 1,
      totalRounds: cfg.totalRounds,
      timeLimitMs: cfg.timeLimitMs,
      graceMs: cfg.graceMs,
      active: activeFinal,
      question: question ? redactQuestion(question, seed) : null,
      revealQuestion: null,
      seed,
      roundStartAt: null,
      phaseEndsAt: Date.now() + COUNTDOWN_MS,
      firstSubmitAt: null,
      deadlineAt: null,
      submittedKeys: [],
      results: null,
      usedIds: question ? [...s.usedIds, question.id].slice(-QUESTION_BANK.length) : s.usedIds,
    });
  };

  const toAnswering = () => {
    const s = stateRef.current!;
    const now = Date.now();
    commit({ phase: 'answering', roundStartAt: now, deadlineAt: now + s.timeLimitMs });
  };

  const finishRound = () => {
    const s = stateRef.current!;
    const q = liveQuestionRef.current;
    // Idempotency guard: this can be scheduled from two independent places — the
    // deadline timer effect and the "everyone already answered" fast path right after a
    // submission — and if their timing ever overlaps (e.g. the last submission lands at
    // almost exactly the deadline), both could fire. Without this check, the second call
    // would re-run scoring against the *already updated* scores and double-award every
    // player's round points.
    if (!q || s.phase !== 'answering') return;
    const results: Record<string, RoundResult> = { ...(s.results ?? {}) };
    s.active.forEach((key) => {
      if (!results[key]) {
        results[key] = { key, answered: false, correct: false, timeMs: s.timeLimitMs, points: 0, isFirstCorrect: false, display: '' };
      }
    });
    const scores = { ...s.scores };
    const history = { ...s.history };
    const firstCorrectHistory = { ...s.firstCorrectHistory };
    s.active.forEach((key) => {
      const r = results[key];
      scores[key] = (scores[key] ?? 0) + r.points;
      history[key] = [...(history[key] ?? []), r.points];
      if (r.isFirstCorrect) firstCorrectHistory[key] = (firstCorrectHistory[key] ?? 0) + 1;
    });
    commit({ phase: 'reveal', revealQuestion: q, results, scores, prevScores: s.scores, history, firstCorrectHistory, phaseEndsAt: Date.now() + REVEAL_MS });
  };

  const toRoundResults = () => commit({ phase: 'round_results', phaseEndsAt: Date.now() + RESULTS_MS });

  const advanceAfterResults = () => {
    const s = stateRef.current!;
    if (s.round >= s.totalRounds) commit({ phase: 'final', phaseEndsAt: null });
    else startRound();
  };

  const receiveSubmit = (key: string, payload: { chosenIndex?: number; text?: string }) => {
    const s = stateRef.current;
    const q = liveQuestionRef.current;
    if (!s || !q || s.phase !== 'answering' || !s.active.includes(key)) return;
    if (s.submittedKeys.includes(key)) return; // duplicate submission — ignored
    const now = Date.now();
    if (s.deadlineAt != null && now > s.deadlineAt) return; // too late — host clock is authoritative, not the client's

    const correct = q.type === 'mcq_general' || q.type === 'mcq_proverb' || q.type === 'mcq_connection' ? checkMcqAnswer(q as McqQuestion, payload.chosenIndex ?? -1) : checkTextAnswer(q as TextQuestion, payload.text ?? '');
    const timeMs = Math.max(0, now - (s.roundStartAt ?? now));
    const isFirstCorrect = correct && firstCorrectKeyRef.current === null;
    if (isFirstCorrect) firstCorrectKeyRef.current = key;
    const points = computePoints({ correct, difficulty: q.difficulty, timeMs, timeLimitMs: s.timeLimitMs, isFirstCorrect });
    const display =
      q.type === 'mcq_general' || q.type === 'mcq_proverb' || q.type === 'mcq_connection'
        ? (q as McqQuestion).options[payload.chosenIndex ?? -1] ?? ''
        : (payload.text ?? '').trim();

    const results = { ...(s.results ?? {}), [key]: { key, answered: true, correct, timeMs, points, isFirstCorrect, display } };
    const submittedKeys = [...s.submittedKeys, key];

    let firstSubmitAt = s.firstSubmitAt;
    let deadlineAt = s.deadlineAt;
    if (firstSubmitAt == null) {
      firstSubmitAt = now;
      deadlineAt = computeDeadline(s.roundStartAt ?? now, s.timeLimitMs, firstSubmitAt, s.graceMs);
    }

    commit({ results, submittedKeys, firstSubmitAt, deadlineAt });

    const allIn = s.active.every((k) => submittedKeys.includes(k));
    if (allIn) setTimeout(finishRound, 0);
  };

  const hostApi = useRef({ startRound, toAnswering, finishRound, toRoundResults, advanceAfterResults, receiveSubmit, commit });
  hostApi.current = { startRound, toAnswering, finishRound, toRoundResults, advanceAfterResults, receiveSubmit, commit };

  // Keep the lobby's player list in step with room presence (same pattern as every other game here).
  useEffect(() => {
    if (!isHost || !stateRef.current) return;
    const s = stateRef.current;
    const players: Record<string, BBPlayer> = {};
    const existingColors = new Set(Object.values(s.players).map((p) => p.color));
    roster.forEach((r, i) => {
      const existing = s.players[r.key];
      players[r.key] = existing ? { ...existing, name: r.name, connected: true } : { key: r.key, name: r.name, color: (existingColors.size + i) % PLAYER_COLORS_COUNT, connected: true };
    });
    // Players who left presence stay in the record (so finished-round history/avatars
    // don't vanish mid-game) but are marked disconnected.
    Object.keys(s.players).forEach((k) => {
      if (!players[k]) players[k] = { ...s.players[k], connected: false };
    });
    if (JSON.stringify(players) !== JSON.stringify(s.players)) hostApi.current.commit({ players });
  }, [isHost, roster]);

  // Host round timers.
  useEffect(() => {
    if (!isHost || !state) return;
    if (state.phase === 'round_start' && state.phaseEndsAt) {
      const t = setTimeout(() => hostApi.current.toAnswering(), Math.max(0, state.phaseEndsAt - Date.now()));
      return () => clearTimeout(t);
    }
    if (state.phase === 'answering' && state.deadlineAt) {
      const t = setTimeout(() => hostApi.current.finishRound(), Math.max(0, state.deadlineAt - Date.now()));
      return () => clearTimeout(t);
    }
    if (state.phase === 'reveal' && state.phaseEndsAt) {
      const t = setTimeout(() => hostApi.current.toRoundResults(), Math.max(0, state.phaseEndsAt - Date.now()));
      return () => clearTimeout(t);
    }
    if (state.phase === 'round_results' && state.phaseEndsAt) {
      const t = setTimeout(() => hostApi.current.advanceAfterResults(), Math.max(0, state.phaseEndsAt - Date.now()));
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.deadlineAt, state?.phaseEndsAt, state?.round]);

  // Re-check the deadline whenever it tightens mid-"answering" (a new first-submission
  // arrived) — the effect above already re-runs since `state.deadlineAt` is a dependency.

  // ---------- messaging ----------
  useEffect(() => {
    if (!channel) return;
    const offs: Array<() => void> = [];
    if (isHost) {
      offs.push(listen(channel, 'bb_hello', () => stateRef.current && send('bb_state', stateRef.current)));
      offs.push(listen(channel, 'bb_submit', (p) => hostApi.current.receiveSubmit(p.key, p.payload)));
      if (stateRef.current) send('bb_state', stateRef.current);
    } else {
      offs.push(
        listen(channel, 'bb_state', (p: BattlePublicState) => {
          if (p.seq < lastSeqRef.current) return;
          lastSeqRef.current = p.seq;
          offsetRef.current = p.now - Date.now();
          stateRef.current = p;
          setState(p);
        }),
      );
    }
    return () => offs.forEach((f) => f());
  }, [channel, isHost, send]);

  const hasState = !!state;
  useEffect(() => {
    if (isHost || !channel || hasState) return;
    send('bb_hello', { key: myKey });
    const t = setInterval(() => send('bb_hello', { key: myKey }), 1500);
    return () => clearInterval(t);
  }, [isHost, channel, hasState, myKey, send]);

  // ---------- public API ----------
  const start = (settings: BattleSettings) => {
    if (isHost) hostApi.current.startRound(settings);
  };

  const submitMcq = (chosenIndex: number) => {
    if (isHost) hostApi.current.receiveSubmit(myKey, { chosenIndex });
    else send('bb_submit', { key: myKey, payload: { chosenIndex } });
  };

  const submitText = (text: string) => {
    if (isHost) hostApi.current.receiveSubmit(myKey, { text });
    else send('bb_submit', { key: myKey, payload: { text } });
  };

  const skipAhead = () => {
    if (!isHost || !stateRef.current) return;
    const ph = stateRef.current.phase;
    if (ph === 'reveal') hostApi.current.toRoundResults();
    else if (ph === 'round_results') hostApi.current.advanceAfterResults();
  };

  const restart = () => {
    if (isHost) hostApi.current.commit({ phase: 'lobby', round: 0, scores: {}, prevScores: {}, history: {}, firstCorrectHistory: {}, usedIds: stateRef.current?.usedIds ?? [] });
  };

  const getNow = useCallback(() => Date.now() + offsetRef.current, []);

  const hostMissing = !isHost && !hostConnected;

  return { state, actions: { start, submitMcq, submitText, skipAhead, restart }, getNow, hostMissing };
}
