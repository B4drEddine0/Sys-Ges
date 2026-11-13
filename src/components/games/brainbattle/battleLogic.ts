// تحدّي العقول (Brain Battle) — pure game engine: question selection, anti-repetition,
// answer validation, scoring and tie-breaking. No React, no networking — see
// useBrainBattleGame.ts (multiplayer, host-authoritative) and useSoloBattle.ts (solo,
// purely local) for the two drivers built on top of this.

import { normalizeAnswerText } from '../shared/arabicText';
import { mulberry32, shuffleWithRng as shuffle } from '../shared/rng';

export type QType = 'mcq_general' | 'mcq_proverb' | 'mcq_connection' | 'scramble' | 'hidden_word' | 'riddle';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const QTYPE_LABEL: Record<QType, { ar: string; icon: string }> = {
  mcq_general: { ar: 'ثقافة عامة', icon: '🧠' },
  mcq_proverb: { ar: 'أكمل العبارة', icon: '✍️' },
  mcq_connection: { ar: 'ما الرابط؟', icon: '🔗' },
  scramble: { ar: 'تشكيل الكلمات', icon: '🔤' },
  hidden_word: { ar: 'الكلمة المخفية', icon: '🕵️' },
  riddle: { ar: 'لغز ذكي', icon: '❓' },
};

export const DIFFICULTY_LABEL: Record<Difficulty, { ar: string; base: number }> = {
  easy: { ar: 'سهل', base: 100 },
  medium: { ar: 'متوسط', base: 150 },
  hard: { ar: 'صعب', base: 220 },
  expert: { ar: 'خبير', base: 300 },
};

interface BaseQuestion {
  id: string;
  type: QType;
  difficulty: Difficulty;
  category: string;
  prompt: string;
  /** Optional: an MCQ question states one explicitly; a word puzzle's "explanation" is
   * just its revealed answer/clues, so it isn't required to also repeat one. */
  explanation?: string;
}

export interface McqQuestion extends BaseQuestion {
  type: 'mcq_general' | 'mcq_proverb' | 'mcq_connection';
  options: string[];
  correctIndex: number;
}

export interface TextQuestion extends BaseQuestion {
  type: 'scramble' | 'hidden_word' | 'riddle';
  answer: string;
  altAnswers?: string[];
  clues: string[]; // progressive hints, revealed in order over time
}

export type Question = McqQuestion | TextQuestion;

/** What's safe to show players before the answer is known — no correct option/answer. */
export type PublicQuestion =
  | (Omit<McqQuestion, 'correctIndex'> & { correctIndex?: undefined })
  | (Omit<TextQuestion, 'answer' | 'altAnswers'> & { answer?: undefined; altAnswers?: undefined; letters?: string[] });

export function isMcqQuestion(q: Question): q is McqQuestion {
  return q.type === 'mcq_general' || q.type === 'mcq_proverb' || q.type === 'mcq_connection';
}

export function redactQuestion(q: Question, seed: number): PublicQuestion {
  if (isMcqQuestion(q)) {
    const { id, type, difficulty, category, prompt, explanation, options } = q;
    return { id, type, difficulty, category, prompt, explanation, options, correctIndex: undefined };
  }
  const { id, type, difficulty, category, prompt, explanation, clues } = q;
  const letters = type === 'scramble' ? shuffle([...q.answer.replace(/\s/g, '')], mulberry32(seed)) : undefined;
  return { id, type, difficulty, category, prompt, explanation, clues, answer: undefined, altAnswers: undefined, letters };
}

// ---------------------------------------------------------------- answer checking

export function checkMcqAnswer(q: McqQuestion, chosenIndex: number): boolean {
  return chosenIndex === q.correctIndex;
}

export function checkTextAnswer(q: TextQuestion, raw: string): boolean {
  const given = normalizeAnswerText(raw);
  if (!given) return false;
  const candidates = [q.answer, ...(q.altAnswers ?? [])].map(normalizeAnswerText);
  return candidates.includes(given);
}

// ---------------------------------------------------------------- selection / anti-repetition

export interface SelectionFilters {
  types?: QType[];
  difficulties?: Difficulty[];
}

/**
 * Picks `count` questions, preferring ones not in `usedIds`. If the unseen pool runs dry
 * (small bank, long session), falls back to allowing repeats rather than failing — but
 * only once every matching question has actually been used at least once.
 */
export function selectQuestions(bank: Question[], count: number, usedIds: Set<string>, filters: SelectionFilters, rng: () => number): Question[] {
  const pool = bank.filter((q) => (!filters.types || filters.types.includes(q.type)) && (!filters.difficulties || filters.difficulties.includes(q.difficulty)));
  const unseen = pool.filter((q) => !usedIds.has(q.id));
  const shuffledUnseen = shuffle(unseen, rng);
  if (shuffledUnseen.length >= count) return shuffledUnseen.slice(0, count);
  // Not enough unseen questions — take all of them, then backfill with (shuffled) seen ones.
  const seen = shuffle(
    pool.filter((q) => usedIds.has(q.id)),
    rng,
  );
  return [...shuffledUnseen, ...seen].slice(0, count);
}

// ---------------------------------------------------------------- scoring

export const SPEED_BONUS_MAX = 100;
export const FIRST_CORRECT_BONUS = 30;

/**
 * Correctness and difficulty always dominate speed: the base award (100–300, by
 * difficulty) is at least equal to the maximum possible speed bonus (100), so a slow
 * correct answer always beats a fast wrong one, and knowledge is never made irrelevant
 * by reflexes alone.
 */
export function computePoints(opts: { correct: boolean; difficulty: Difficulty; timeMs: number; timeLimitMs: number; isFirstCorrect: boolean; penalty?: number }): number {
  if (!opts.correct) return (opts.penalty ?? 0) === 0 ? 0 : -(opts.penalty ?? 0);
  const base = DIFFICULTY_LABEL[opts.difficulty].base;
  const frac = Math.max(0, Math.min(1, 1 - opts.timeMs / Math.max(1, opts.timeLimitMs)));
  const speedBonus = Math.round(SPEED_BONUS_MAX * frac);
  return base + speedBonus + (opts.isFirstCorrect ? FIRST_CORRECT_BONUS : 0);
}

// ---------------------------------------------------------------- grace-period deadline

/**
 * The round ends at the *earlier* of the original time limit and (first submission time +
 * grace period) — recompute this every time a new first-submission arrives (there's only
 * ever one "first", so in practice this fires once per round, but it's written to be safe
 * to call repeatedly / out of order).
 */
export function computeDeadline(roundStartAt: number, timeLimitMs: number, firstSubmitAt: number | null, graceMs: number): number {
  const hardDeadline = roundStartAt + timeLimitMs;
  if (firstSubmitAt == null) return hardDeadline;
  return Math.min(hardDeadline, firstSubmitAt + graceMs);
}

// ---------------------------------------------------------------- ranking

export interface RankRow {
  key: string;
  score: number;
  correctCount: number;
  totalTimeMs: number;
}

/** Deterministic: higher score wins; ties broken by more correct answers, then faster cumulative time, then key. */
export function rankPlayers(rows: RankRow[]): RankRow[] {
  return [...rows].sort((a, b) => b.score - a.score || b.correctCount - a.correctCount || a.totalTimeMs - b.totalTimeMs || a.key.localeCompare(b.key));
}
