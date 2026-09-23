export const CATEGORIES = ['بنت', 'ولد', 'حيوان', 'جماد', 'بلد', 'أكلة', 'لون'] as const;

// Letters that are realistic to fill seven categories with.
export const LETTERS = [
  'ا', 'ب', 'ت', 'ج', 'ح', 'خ', 'د', 'ر', 'ز', 'س', 'ش', 'ص', 'ط', 'ع', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي',
];

export const PLAYER_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899'];

export const POINTS_UNIQUE = 10;
export const POINTS_DUPLICATE = 5;

export const COUNTDOWN_MS = 3400;
export const RESULTS_MS = 11000;
export const SUBMIT_GRACE_MS = 1600;

export type Phase = 'lobby' | 'round_start' | 'playing' | 'reveal' | 'round_results' | 'game_results';
export type AnswerStatus = 'unique' | 'duplicate' | 'empty' | 'rejected';

export interface HarfPlayer {
  key: string;
  name: string;
  color: number;
  connected: boolean;
}

export interface CellResult {
  text: string;
  status: AnswerStatus;
  points: number;
}

export interface HarfState {
  phase: Phase;
  round: number;
  totalRounds: number;
  roundSeconds: number;
  letter: string;
  usedLetters: string[];
  players: HarfPlayer[];
  /** Keys of the players taking part in the current round (late joiners wait for the next one). */
  active: string[];
  submitted: Record<string, boolean>;
  /** How many categories each player has filled — a count only, never the content. */
  progress: Record<string, number>;
  phaseEndsAt: number | null;
  /** Host clock when this snapshot was made, so guests can correct for clock skew. */
  now: number;
  revealIndex: number;
  /** Everyone's answers, public from the voting phase onward. */
  answers: Record<string, string[]> | null;
  /** Votes keyed `${category}|${target}|${voter}` → is the answer correct. */
  votes: Record<string, boolean>;
  roundPoints: Record<string, number>;
  scores: Record<string, number>;
  prevScores: Record<string, number>;
  history: Record<string, number[]>;
}

export function initialState(): HarfState {
  return {
    phase: 'lobby',
    round: 0,
    totalRounds: 5,
    roundSeconds: 60,
    letter: '',
    usedLetters: [],
    players: [],
    active: [],
    submitted: {},
    progress: {},
    phaseEndsAt: null,
    now: Date.now(),
    revealIndex: 0,
    answers: null,
    votes: {},
    roundPoints: {},
    scores: {},
    prevScores: {},
    history: {},
  };
}

export function normalizeArabic(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[ً-ٰٟـ]/g, '') // tashkeel + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

const stripArticle = (s: string) => (s.startsWith('ال') && s.length > 3 ? s.slice(2) : s);

export function startsWithLetter(answer: string, letter: string): boolean {
  const n = normalizeArabic(answer);
  const l = normalizeArabic(letter);
  if (!n) return false;
  return n.startsWith(l) || stripArticle(n).startsWith(l);
}

export function pickLetter(used: string[]): string {
  let pool = LETTERS.filter((l) => !used.includes(l));
  if (pool.length === 0) pool = LETTERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function sanitizeAnswers(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : [];
  return CATEGORIES.map((_, i) => (typeof arr[i] === 'string' ? arr[i].trim().slice(0, 40) : ''));
}

export const voteKey = (cat: number, target: string, voter: string) => `${cat}|${target}|${voter}`;

export function tally(votes: Record<string, boolean>, cat: number, target: string) {
  let yes = 0;
  let no = 0;
  const prefix = `${cat}|${target}|`;
  for (const k in votes) {
    if (!k.startsWith(prefix)) continue;
    if (votes[k]) yes++;
    else no++;
  }
  return { yes, no };
}

/** An answer counts when at least as many voters said yes as no (no votes = accepted). */
export const isAccepted = (votes: Record<string, boolean>, cat: number, target: string) => {
  const { yes, no } = tally(votes, cat, target);
  return yes >= no;
};

/** Accepted and unique = 10, accepted but shared = 5, rejected / empty = 0. */
export function scoreRound(
  keys: string[],
  answers: Record<string, string[]>,
  votes: Record<string, boolean>,
): { results: Record<string, CellResult[]>; roundPoints: Record<string, number> } {
  const results: Record<string, CellResult[]> = {};
  const roundPoints: Record<string, number> = {};
  keys.forEach((k) => {
    results[k] = [];
    roundPoints[k] = 0;
  });

  CATEGORIES.forEach((_, ci) => {
    const groups = new Map<string, number>();
    keys.forEach((k) => {
      const text = answers[k]?.[ci] ?? '';
      if (text && isAccepted(votes, ci, k)) {
        const id = stripArticle(normalizeArabic(text));
        groups.set(id, (groups.get(id) ?? 0) + 1);
      }
    });

    keys.forEach((k) => {
      const text = answers[k]?.[ci] ?? '';
      let cell: CellResult;
      if (!text) cell = { text, status: 'empty', points: 0 };
      else if (!isAccepted(votes, ci, k)) cell = { text, status: 'rejected', points: 0 };
      else if ((groups.get(stripArticle(normalizeArabic(text))) ?? 1) > 1) cell = { text, status: 'duplicate', points: POINTS_DUPLICATE };
      else cell = { text, status: 'unique', points: POINTS_UNIQUE };
      results[k].push(cell);
      roundPoints[k] += cell.points;
    });
  });

  return { results, roundPoints };
}
