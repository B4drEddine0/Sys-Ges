import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkMcqAnswer,
  checkTextAnswer,
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
import { randomSeed } from '../shared/rng';
import { DEFAULT_SETTINGS } from './useBrainBattleGame';

const SEEN_KEY = 'bb_solo_seen';
const SEEN_CAP = 500; // oldest entries drop off so the list can't grow forever

function loadSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-SEEN_CAP)));
  } catch {
    /* best-effort only */
  }
}

export type SoloPhase = 'setup' | 'question' | 'reveal' | 'summary';

export interface SoloSettings {
  rounds: number;
  timeLimitMs: number;
  types: QType[];
  difficulties: Difficulty[];
}

export interface SoloRoundRecord {
  question: Question;
  correct: boolean;
  points: number;
  timeMs: number;
  display: string;
}

export function useSoloBattle() {
  const [phase, setPhase] = useState<SoloPhase>('setup');
  const [question, setQuestion] = useState<Question | null>(null);
  const [publicQuestion, setPublicQuestion] = useState<PublicQuestion | null>(null);
  const [round, setRound] = useState(0);
  const [settings, setSettings] = useState<SoloSettings>({ rounds: 10, timeLimitMs: 25000, types: DEFAULT_SETTINGS.types, difficulties: DEFAULT_SETTINGS.difficulties });
  const [history, setHistory] = useState<SoloRoundRecord[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<SoloRoundRecord | null>(null);
  const answeredRef = useRef(false);

  const seenRef = useRef<Set<string>>(new Set(loadSeen()));

  const nextQuestion = useCallback(() => {
    const [q] = selectQuestions(QUESTION_BANK, 1, seenRef.current, { types: settings.types, difficulties: settings.difficulties }, Math.random);
    if (!q) return null;
    seenRef.current.add(q.id);
    saveSeen([...seenRef.current]);
    return q;
  }, [settings.types, settings.difficulties]);

  const start = (opts: SoloSettings) => {
    setSettings(opts);
    setHistory([]);
    setRound(0);
    const q = nextQuestionWith(opts);
    if (!q) return;
    beginRound(q);
  };

  // Separate from `nextQuestion` so `start()` can use the settings passed in directly,
  // rather than racing React's async state update for `settings`.
  const nextQuestionWith = (opts: SoloSettings) => {
    const [q] = selectQuestions(QUESTION_BANK, 1, seenRef.current, { types: opts.types, difficulties: opts.difficulties }, Math.random);
    if (!q) return null;
    seenRef.current.add(q.id);
    saveSeen([...seenRef.current]);
    return q;
  };

  const beginRound = (q: Question) => {
    answeredRef.current = false;
    setQuestion(q);
    setPublicQuestion(redactQuestion(q, randomSeed()));
    setRound((r) => r + 1);
    setStartedAt(Date.now());
    setPhase('question');
  };

  const submit = (answer: { chosenIndex?: number; text?: string }) => {
    if (!question || answeredRef.current) return;
    answeredRef.current = true;
    const timeMs = Math.max(0, Date.now() - (startedAt ?? Date.now()));
    const correct =
      question.type === 'mcq_general' || question.type === 'mcq_proverb' || question.type === 'mcq_connection'
        ? checkMcqAnswer(question as McqQuestion, answer.chosenIndex ?? -1)
        : checkTextAnswer(question as TextQuestion, answer.text ?? '');
    const points = computePoints({ correct, difficulty: question.difficulty, timeMs, timeLimitMs: settings.timeLimitMs, isFirstCorrect: false });
    const display =
      question.type === 'mcq_general' || question.type === 'mcq_proverb' || question.type === 'mcq_connection'
        ? (question as McqQuestion).options[answer.chosenIndex ?? -1] ?? ''
        : (answer.text ?? '').trim();
    const record: SoloRoundRecord = { question, correct, points, timeMs, display };
    setLastResult(record);
    setHistory((h) => [...h, record]);
    setPhase('reveal');
  };

  const timeUp = () => {
    if (answeredRef.current) return;
    submit({});
  };

  const continueNext = () => {
    if (round >= settings.rounds) {
      setPhase('summary');
      return;
    }
    const q = nextQuestion();
    if (!q) {
      setPhase('summary');
      return;
    }
    beginRound(q);
  };

  const restart = () => setPhase('setup');

  // Auto-fire a "time's up" submit if the player never answers — mirrors the
  // multiplayer timer, just without a grace period (there's no one else to wait for).
  useEffect(() => {
    if (phase !== 'question' || !startedAt) return;
    const t = setTimeout(timeUp, Math.max(0, startedAt + settings.timeLimitMs - Date.now()));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, startedAt]);

  const totalScore = history.reduce((s, h) => s + h.points, 0);
  const correctCount = history.filter((h) => h.correct).length;

  return {
    phase,
    round,
    settings,
    question,
    publicQuestion,
    lastResult,
    history,
    totalScore,
    correctCount,
    startedAt,
    actions: { start, submit, continueNext, restart },
  };
}
