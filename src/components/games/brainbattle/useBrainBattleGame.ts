import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '../shared/channelBus';
import { randomSeed } from '../shared/rng';
import {
  checkMcqAnswer,
  checkTextAnswer,
  computePoints,
  isMcqQuestion,
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
  timeMs: number; // kept for the "fastest player" stat only — no longer affects scoring, see below
  points: number;
  isFirstCorrect: boolean;
  display: string; // what they submitted, or '' if they didn't answer — safe to show post-reveal
}

// Friends-mode multiplayer is untimed by design: every player answers at their own pace,
// and a round ends once everyone has submitted (or the host manually ends it — see
// `forceFinish`, the escape hatch for a player who disconnects mid-round). Scoring
// therefore carries no speed component here — see computePoints's `timeLimitMs: null`.
// Solo mode is unaffected and keeps its own per-question timer (useSoloBattle.ts).
export interface BattleSettings {
  totalRounds: number;
  types: QType[];
  difficulties: Difficulty[];
}

export const DEFAULT_SETTINGS: BattleSettings = {
  totalRounds: 8,
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
  types: QType[];
  difficulties: Difficulty[];
  players: Record<string, BBPlayer>;
  active: string[];
  question: PublicQuestion | null;
  revealQuestion: Question | null;
  roundStartAt: number | null;
  phaseEndsAt: number | null; // used for round_start/reveal/round_results display timers only — never "answering"
  submittedKeys: string[];
  results: Record<string, RoundResult> | null;
  scores: Record<string, number>;
  prevScores: Record<string, number>;
  history: Record<string, number[]>;
  firstCorrectHistory: Record<string, number>; // how many rounds each player was first-correct in
  timeHistory: Record<string, number[]>; // answer time per round, correct answers only — stats/podium use only, not scoring
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
    types: DEFAULT_SETTINGS.types,
    difficulties: DEFAULT_SETTINGS.difficulties,
    players: {},
    active: [],
    question: null,
    revealQuestion: null,
    roundStartAt: null,
    phaseEndsAt: null,
    submittedKeys: [],
    results: null,
    scores: {},
    prevScores: {},
    history: {},
    firstCorrectHistory: {},
    timeHistory: {},
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
    // Settings persist from the lobby across every round of the game — only the initial
    // `start()` call passes them explicitly; later rounds reuse whatever's already in
    // state rather than silently falling back to "every type, every difficulty".
    const cfg: BattleSettings = settings ?? { totalRounds: s.totalRounds, types: s.types, difficulties: s.difficulties };
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
      types: cfg.types,
      difficulties: cfg.difficulties,
      active: activeFinal,
      question: question ? redactQuestion(question, seed) : null,
      revealQuestion: null,
      seed,
      roundStartAt: null,
      phaseEndsAt: Date.now() + COUNTDOWN_MS,
      submittedKeys: [],
      results: null,
      usedIds: question ? [...s.usedIds, question.id].slice(-QUESTION_BANK.length) : s.usedIds,
    });
  };

  const toAnswering = () => {
    // No deadline is set here on purpose — friends mode is untimed; see finishRound for
    // how the round actually ends (everyone's answered, or the host ends it manually).
    commit({ phase: 'answering', roundStartAt: Date.now() });
  };

  const finishRound = () => {
    const s = stateRef.current!;
    const q = liveQuestionRef.current;
    // Idempotency guard: this can be scheduled from two independent places — a manual
    // host force-finish and the "everyone already answered" fast path right after a
    // submission — and if their timing ever overlaps, both could fire. Without this
    // check, the second call would re-run scoring against the *already updated* scores
    // and double-award every player's round points.
    if (!q || s.phase !== 'answering') return;
    const results: Record<string, RoundResult> = { ...(s.results ?? {}) };
    s.active.forEach((key) => {
      if (!results[key]) {
        results[key] = { key, answered: false, correct: false, timeMs: 0, points: 0, isFirstCorrect: false, display: '' };
      }
    });
    const scores = { ...s.scores };
    const history = { ...s.history };
    const firstCorrectHistory = { ...s.firstCorrectHistory };
    const timeHistory = { ...s.timeHistory };
    s.active.forEach((key) => {
      const r = results[key];
      scores[key] = (scores[key] ?? 0) + r.points;
      history[key] = [...(history[key] ?? []), r.points];
      if (r.isFirstCorrect) firstCorrectHistory[key] = (firstCorrectHistory[key] ?? 0) + 1;
      if (r.correct) timeHistory[key] = [...(timeHistory[key] ?? []), r.timeMs];
    });
    commit({ phase: 'reveal', revealQuestion: q, results, scores, prevScores: s.scores, history, firstCorrectHistory, timeHistory, phaseEndsAt: Date.now() + REVEAL_MS });
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

    const correct = isMcqQuestion(q) ? checkMcqAnswer(q, payload.chosenIndex ?? -1) : checkTextAnswer(q as TextQuestion, payload.text ?? '');
    const timeMs = Math.max(0, Date.now() - (s.roundStartAt ?? Date.now()));
    const isFirstCorrect = correct && firstCorrectKeyRef.current === null;
    if (isFirstCorrect) firstCorrectKeyRef.current = key;
    // Untimed scoring: difficulty + correctness only, no speed component (see the
    // BattleSettings doc comment for why). `timeMs` is still recorded for the "fastest
    // player" end-of-game stat, it just no longer feeds points.
    const points = computePoints({ correct, difficulty: q.difficulty, timeMs, timeLimitMs: null, isFirstCorrect });
    const display = isMcqQuestion(q) ? q.options[payload.chosenIndex ?? -1] ?? '' : (payload.text ?? '').trim();

    const results = { ...(s.results ?? {}), [key]: { key, answered: true, correct, timeMs, points, isFirstCorrect, display } };
    const submittedKeys = [...s.submittedKeys, key];
    commit({ results, submittedKeys });

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

  // Host display timers — note 'answering' is deliberately absent: there is no automatic
  // timeout for it anymore (see finishRound / forceFinish).
  useEffect(() => {
    if (!isHost || !state) return;
    if (state.phase === 'round_start' && state.phaseEndsAt) {
      const t = setTimeout(() => hostApi.current.toAnswering(), Math.max(0, state.phaseEndsAt - Date.now()));
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
  }, [isHost, state?.phase, state?.phaseEndsAt, state?.round]);

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

  /** Host-only escape hatch: ends the round right now even if someone hasn't answered
   * (e.g. they disconnected) — the only way a round ever ends besides everyone answering,
   * now that there's no timer. */
  const forceFinish = () => {
    if (isHost && stateRef.current?.phase === 'answering') hostApi.current.finishRound();
  };

  const restart = () => {
    if (isHost) hostApi.current.commit({ phase: 'lobby', round: 0, scores: {}, prevScores: {}, history: {}, firstCorrectHistory: {}, timeHistory: {}, usedIds: stateRef.current?.usedIds ?? [] });
  };

  const getNow = useCallback(() => Date.now() + offsetRef.current, []);

  const hostMissing = !isHost && !hostConnected;

  return { state, actions: { start, submitMcq, submitText, skipAhead, forceFinish, restart }, getNow, hostMissing };
}
