// تحدّي العقول (Brain Battle) — pure game engine: question selection, anti-repetition,
// answer validation, scoring and tie-breaking. No React, no networking — see
// useBrainBattleGame.ts (multiplayer, host-authoritative) and useSoloBattle.ts (solo,
// purely local) for the two drivers built on top of this.

import { normalizeAnswerText, stripArticle } from '../shared/arabicText';
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
  | (Omit<TextQuestion, 'answer' | 'altAnswers'> & { answer?: undefined; altAnswers?: undefined; letters?: string[]; answerLength: number });

export function isMcqQuestion(q: Question): q is McqQuestion {
  return q.type === 'mcq_general' || q.type === 'mcq_proverb' || q.type === 'mcq_connection';
}

/**
 * A deterministic permutation of an MCQ's option indices, seeded so every client derives
 * the identical shuffled order from the same small seed (same pattern as Wobble Race's
 * obstacle phases / Harf's letter deck) — this is what makes the correct answer's on-screen
 * position vary question to question instead of always sitting wherever it was authored.
 */
export function shuffledMcqOrder(q: McqQuestion, seed: number): number[] {
  return shuffle(
    q.options.map((_, i) => i),
    mulberry32(seed),
  );
}

// Harder difficulties get fewer progressive clues — "hard"/"expert" should be able to
// genuinely stump a knowledgeable player, which a full staircase of hints undercuts. The
// letter-count hint (answerLength, below) is left untouched at every difficulty: that one
// exists purely to resolve an unfair-miss bug (not knowing whether to include "ال" or
// write one word vs. several), not to make the question easier.
function cluesForDifficulty(clues: string[], difficulty: Difficulty): string[] {
  if (difficulty === 'expert') return clues.slice(0, Math.min(1, clues.length));
  if (difficulty === 'hard') return clues.slice(0, Math.max(1, clues.length - 1));
  return clues;
}

export function redactQuestion(q: Question, seed: number): PublicQuestion {
  if (isMcqQuestion(q)) {
    const { id, type, difficulty, category, prompt, explanation } = q;
    const order = shuffledMcqOrder(q, seed);
    return { id, type, difficulty, category, prompt, explanation, options: order.map((i) => q.options[i]), correctIndex: undefined };
  }
  const { id, type, difficulty, category, prompt, explanation, clues } = q;
  const bareAnswer = q.answer.replace(/\s/g, '');
  const letters = type === 'scramble' ? shuffle([...bareAnswer], mulberry32(seed)) : undefined;
  // Letter count alone isn't a spoiler — it doesn't reveal any letter — but it resolves a
  // real source of unfair misses: without it, a player has no way to know whether the
  // expected form includes "ال", is one word or several, etc.
  return {
    id,
    type,
    difficulty,
    category,
    prompt,
    explanation,
    clues: cluesForDifficulty(clues, difficulty),
    answer: undefined,
    altAnswers: undefined,
    letters,
    answerLength: bareAnswer.length,
  };
}

// ---------------------------------------------------------------- answer checking

/** `chosenIndex` refers to the *shuffled* display order the player actually saw — see shuffledMcqOrder. */
export function checkMcqAnswer(q: McqQuestion, chosenIndex: number, seed: number): boolean {
  const order = shuffledMcqOrder(q, seed);
  return order[chosenIndex] === q.correctIndex;
}

// The leading "ال" (definite article) is stripped on both sides before comparing — a
// player who answers "وجه" for a target stored as "الوجه" (or vice versa) is answering
// correctly in any normal sense, and without this a correct answer could be marked wrong
// just because the player didn't guess whether the bank's author happened to include the
// article. This is in addition to whatever specific altAnswers a question already lists.
export function checkTextAnswer(q: TextQuestion, raw: string): boolean {
  const given = normalizeAnswerText(raw);
  if (!given) return false;
  const givenBare = stripArticle(given);
  const candidates = [q.answer, ...(q.altAnswers ?? [])].map(normalizeAnswerText);
  return candidates.some((c) => c === given || c === givenBare || stripArticle(c) === givenBare);
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
 *
 * `timeLimitMs: null` means untimed play (friends-mode multiplayer, each player at their
 * own pace) — the speed bonus is skipped entirely rather than prorated against nothing,
 * since there's no time pressure to reward. "First correct" is still meaningful untimed
 * (first to submit a correct answer, in arrival order) and keeps its own small bonus.
 */
export function computePoints(opts: { correct: boolean; difficulty: Difficulty; timeMs: number; timeLimitMs: number | null; isFirstCorrect: boolean; penalty?: number }): number {
  if (!opts.correct) return (opts.penalty ?? 0) === 0 ? 0 : -(opts.penalty ?? 0);
  const base = DIFFICULTY_LABEL[opts.difficulty].base;
  const speedBonus =
    opts.timeLimitMs == null ? 0 : Math.round(SPEED_BONUS_MAX * Math.max(0, Math.min(1, 1 - opts.timeMs / Math.max(1, opts.timeLimitMs))));
  return base + speedBonus + (opts.isFirstCorrect ? FIRST_CORRECT_BONUS : 0);
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
