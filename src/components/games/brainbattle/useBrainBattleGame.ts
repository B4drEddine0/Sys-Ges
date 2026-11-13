import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '../shared/channelBus';
import { randomSeed } from '../shared/rng';
import {
  checkMcqAnswer,
  checkTextAnswer,
  computePoints,
  FIRST_CORRECT_BONUS,
  isMcqQuestion,
  redactQuestion,
  selectQuestions,
  shuffledMcqOrder,
  type Difficulty,
  type PublicQuestion,
  type QType,
  type Question,
  type TextQuestion,
} from './battleLogic';
import { QUESTION_BANK } from './questionBank';

export type BattlePhase = 'lobby' | 'playing' | 'final';

export interface BBPlayer {
  key: string;
  name: string;
  color: number;
  connected: boolean;
}

/** One player's result for one question — safe to broadcast only once the whole game is over. */
export interface FinalAnswerCell {
  answered: boolean;
  correct: boolean;
  points: number;
  display: string; // '' if never answered
}

// Friends mode is untimed and fully self-paced by design: every player works through the
// *same* list of questions independently, moving on the instant they answer, and only
// waits once they've finished the whole list. There is no per-question synchronization
// left to time out, so scoring carries no speed component (see computePoints's
// `timeLimitMs: null`) — the one speed-flavored reward left is a small bonus for
// whoever finishes the entire list first.
export interface BattleSettings {
  totalQuestions: number;
  types: QType[];
  difficulties: Difficulty[];
}

export const DEFAULT_SETTINGS: BattleSettings = {
  totalQuestions: 15,
  types: ['mcq_general', 'mcq_proverb', 'mcq_connection', 'scramble', 'hidden_word', 'riddle'],
  difficulties: ['easy', 'medium', 'hard', 'expert'],
};

export interface BattlePublicState {
  phase: BattlePhase;
  totalQuestions: number;
  types: QType[];
  difficulties: Difficulty[];
  players: Record<string, BBPlayer>;
  active: string[];
  questions: PublicQuestion[]; // the whole game's list, redacted — empty in 'lobby'
  progress: Record<string, number>; // 0..totalQuestions, live, content-free
  finished: string[];
  firstFinisherKey: string | null;
  // Populated only once phase === 'final' — this is the "fun reveal table" moment.
  scores: Record<string, number>;
  revealTable: Record<string, FinalAnswerCell[]> | null;
  correctAnswers: string[] | null; // the correct text for each question — safe now the game is over
  usedIds: string[];
  now: number;
  seq: number;
}

function initialLobbyState(): BattlePublicState {
  return {
    phase: 'lobby',
    totalQuestions: DEFAULT_SETTINGS.totalQuestions,
    types: DEFAULT_SETTINGS.types,
    difficulties: DEFAULT_SETTINGS.difficulties,
    players: {},
    active: [],
    questions: [],
    progress: {},
    finished: [],
    firstFinisherKey: null,
    scores: {},
    revealTable: null,
    correctAnswers: null,
    usedIds: [],
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
 * real question list (with correct answers) is kept host-only in `fullQuestionsRef` and
 * never broadcast — clients only ever see the redacted `questions` in public state.
 * Likewise each player's own per-question result is kept host-only in `answersRef` and
 * only published, for everyone, once the whole game reaches 'final' — same discipline as
 * Hezz's hidden hands and Harf's hidden answers pre-reveal. As with those, this is "kept
 * out of this app's own UI/state," not cryptographically secret from someone reading raw
 * websocket frames.
 */
export function useBrainBattleGame({ channel, isHost, myKey, playerKeys, playerNames, hostConnected }: Options) {
  const [state, setState] = useState<BattlePublicState | null>(() => (isHost ? initialLobbyState() : null));
  const stateRef = useRef<BattlePublicState | null>(state);
  const fullQuestionsRef = useRef<Question[]>([]);
  const seedsRef = useRef<number[]>([]);
  const answersRef = useRef<Record<string, FinalAnswerCell[]>>({});
  // Hook-owned, strictly increasing for the whole room session — see the writeup on the
  // identical bug this fixed in Hezz Jouj's "Play Again": trusting a per-game counter
  // that resets on restart makes a fresh game's broadcast look "stale" to guests.
  const broadcastSeqRef = useRef(0);
  const lastSeqRef = useRef(-1);

  // Per-question instant personal feedback ("✅ +150" / "❌") — a private whisper, never
  // broadcast, so it can't leak anything about *your* answer to other players either.
  const [lastAck, setLastAck] = useState<{ questionIndex: number; correct: boolean; points: number } | null>(null);

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

  // ---------- host game logic ----------
  const startGame = (settings: BattleSettings) => {
    const activeFinal = rosterRef.current.map((r) => r.key);
    const used = new Set(stateRef.current?.usedIds ?? []);
    const picked = selectQuestions(QUESTION_BANK, settings.totalQuestions, used, { types: settings.types, difficulties: settings.difficulties }, Math.random);
    fullQuestionsRef.current = picked;
    seedsRef.current = picked.map(() => randomSeed());
    answersRef.current = {};
    const questions = picked.map((q, i) => redactQuestion(q, seedsRef.current[i]));

    commit({
      phase: 'playing',
      totalQuestions: picked.length,
      types: settings.types,
      difficulties: settings.difficulties,
      active: activeFinal,
      questions,
      progress: Object.fromEntries(activeFinal.map((k) => [k, 0])),
      finished: [],
      firstFinisherKey: null,
      scores: {},
      revealTable: null,
      correctAnswers: null,
      usedIds: [...(stateRef.current?.usedIds ?? []), ...picked.map((q) => q.id)].slice(-QUESTION_BANK.length),
    });
  };

  const finalize = (opts: { forced: boolean }) => {
    const s = stateRef.current!;
    const revealTable: Record<string, FinalAnswerCell[]> = {};
    const scores: Record<string, number> = {};
    s.active.forEach((key) => {
      const cells = [...(answersRef.current[key] ?? [])];
      // A player who disconnected / never finished (only reachable via the host's manual
      // "end the game now" override) gets empty, zero-point cells for whatever's left —
      // never a penalty beyond the points they simply didn't earn.
      for (let i = cells.length; i < s.totalQuestions; i++) cells.push({ answered: false, correct: false, points: 0, display: '' });
      revealTable[key] = cells;
      scores[key] = cells.reduce((sum, c) => sum + c.points, 0) + (key === s.firstFinisherKey ? FIRST_CORRECT_BONUS : 0);
    });
    // The correct text for every question — safe to reveal now that the game is over,
    // and what makes the final table useful for more than just a score tally.
    const correctAnswers = fullQuestionsRef.current.map((q) => (isMcqQuestion(q) ? q.options[q.correctIndex] : q.answer));
    commit({ phase: 'final', revealTable, scores, correctAnswers });
    void opts;
  };

  const receiveSubmit = (key: string, payload: { questionIndex: number; chosenIndex?: number; text?: string }): { correct: boolean; points: number } | null => {
    const s = stateRef.current;
    if (!s || s.phase !== 'playing' || !s.active.includes(key) || s.finished.includes(key)) return null;
    const expectedIndex = s.progress[key] ?? 0;
    if (payload.questionIndex !== expectedIndex) return null; // out of order / duplicate / replay — ignored
    const q = fullQuestionsRef.current[expectedIndex];
    const seed = seedsRef.current[expectedIndex];
    if (!q) return null;

    const correct = isMcqQuestion(q) ? checkMcqAnswer(q, payload.chosenIndex ?? -1, seed) : checkTextAnswer(q as TextQuestion, payload.text ?? '');
    const points = computePoints({ correct, difficulty: q.difficulty, timeMs: 0, timeLimitMs: null, isFirstCorrect: false });
    // For MCQ, map the chosen *display* index back through the same shuffle used to
    // redact this question, so the recorded text matches what the player actually picked
    // (not whatever happens to sit at that index in the unshuffled authored order).
    const display = isMcqQuestion(q) ? q.options[shuffledMcqOrder(q, seed)[payload.chosenIndex ?? -1]] ?? '' : (payload.text ?? '').trim();

    answersRef.current[key] = [...(answersRef.current[key] ?? []), { answered: true, correct, points, display }];
    send('bb_ack', { to: key, questionIndex: expectedIndex, correct, points });

    const progress = { ...s.progress, [key]: expectedIndex + 1 };
    const justFinished = progress[key] >= s.totalQuestions;
    const finished = justFinished && !s.finished.includes(key) ? [...s.finished, key] : s.finished;
    const firstFinisherKey = justFinished && s.firstFinisherKey === null ? key : s.firstFinisherKey;
    commit({ progress, finished, firstFinisherKey });

    if (finished.length >= s.active.length) setTimeout(() => hostApi.current.finalize({ forced: false }), 0);
    return { correct, points };
  };

  const hostApi = useRef({ startGame, finalize, receiveSubmit, commit });
  hostApi.current = { startGame, finalize, receiveSubmit, commit };

  // Keep the player list in step with room presence (same pattern as every other game
  // here). A player who joins while a game is already 'playing' is added to `active` too
  // (starting fresh at question 0 of the same shared list) rather than locked out until
  // the next game — matches "a player joins after the game has started".
  useEffect(() => {
    if (!isHost || !stateRef.current) return;
    const s = stateRef.current;
    const players: Record<string, BBPlayer> = {};
    const existingColors = new Set(Object.values(s.players).map((p) => p.color));
    roster.forEach((r, i) => {
      const existing = s.players[r.key];
      players[r.key] = existing ? { ...existing, name: r.name, connected: true } : { key: r.key, name: r.name, color: (existingColors.size + i) % PLAYER_COLORS_COUNT, connected: true };
    });
    Object.keys(s.players).forEach((k) => {
      if (!players[k]) players[k] = { ...s.players[k], connected: false };
    });

    const patch: Partial<BattlePublicState> = {};
    if (JSON.stringify(players) !== JSON.stringify(s.players)) patch.players = players;
    if (s.phase === 'playing') {
      const joiners = roster.map((r) => r.key).filter((k) => !s.active.includes(k));
      if (joiners.length > 0) {
        patch.active = [...s.active, ...joiners];
        patch.progress = { ...s.progress, ...Object.fromEntries(joiners.map((k) => [k, 0])) };
      }
    }
    if (Object.keys(patch).length > 0) hostApi.current.commit(patch);
  }, [isHost, roster]);

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
          stateRef.current = p;
          setState(p);
        }),
      );
    }
    // Everyone listens for their own ack, including the host (it sends to itself too).
    offs.push(
      listen(channel, 'bb_ack', (p: { to: string; questionIndex: number; correct: boolean; points: number }) => {
        if (p.to !== myKey) return;
        setLastAck({ questionIndex: p.questionIndex, correct: p.correct, points: p.points });
      }),
    );
    return () => offs.forEach((f) => f());
  }, [channel, isHost, myKey, send]);

  const hasState = !!state;
  useEffect(() => {
    if (isHost || !channel || hasState) return;
    send('bb_hello', { key: myKey });
    const t = setInterval(() => send('bb_hello', { key: myKey }), 1500);
    return () => clearInterval(t);
  }, [isHost, channel, hasState, myKey, send]);

  // ---------- public API ----------
  const start = (settings: BattleSettings) => {
    if (isHost) hostApi.current.startGame(settings);
  };

  // The host applies its own submission directly (no network round trip) via the same
  // `receiveSubmit` the broadcast handler uses, and — since supabase-js broadcast never
  // delivers a message back to its own sender — sets its own instant-feedback ack from
  // that same call's result, rather than recomputing the scoring a second time.
  const submitMcq = (questionIndex: number, chosenIndex: number) => {
    if (isHost) {
      const result = hostApi.current.receiveSubmit(myKey, { questionIndex, chosenIndex });
      if (result) setLastAck({ questionIndex, ...result });
    } else {
      send('bb_submit', { key: myKey, payload: { questionIndex, chosenIndex } });
    }
  };

  const submitText = (questionIndex: number, text: string) => {
    if (isHost) {
      const result = hostApi.current.receiveSubmit(myKey, { questionIndex, text });
      if (result) setLastAck({ questionIndex, ...result });
    } else {
      send('bb_submit', { key: myKey, payload: { questionIndex, text } });
    }
  };

  /** Host-only escape hatch: ends the game right now even if someone hasn't finished
   * (e.g. they disconnected) — the only way the game ends besides everyone finishing, now
   * that there's no per-question timer. */
  const forceFinishGame = () => {
    if (isHost && stateRef.current?.phase === 'playing') hostApi.current.finalize({ forced: true });
  };

  const restart = () => {
    if (isHost) hostApi.current.commit({ phase: 'lobby', questions: [], progress: {}, finished: [], firstFinisherKey: null, scores: {}, revealTable: null, correctAnswers: null });
  };

  const hostMissing = !isHost && !hostConnected;

  return { state, lastAck, actions: { start, submitMcq, submitText, forceFinishGame, restart }, hostMissing };
}
