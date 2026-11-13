import { describe, expect, it } from 'vitest';
import {
  checkMcqAnswer,
  checkTextAnswer,
  computePoints,
  rankPlayers,
  redactQuestion,
  selectQuestions,
  type McqQuestion,
  type Question,
  type TextQuestion,
} from './battleLogic';
import { QUESTION_BANK } from './questionBank';
import { mulberry32 } from '../shared/rng';

const seededRng = (seed: number) => mulberry32(seed);

describe('answer checking', () => {
  const mcq: McqQuestion = { id: 'x', type: 'mcq_general', difficulty: 'easy', category: 'c', prompt: 'p', options: ['a', 'b', 'c'], correctIndex: 1, explanation: 'e' };
  it('MCQ matches only the exact correct index', () => {
    expect(checkMcqAnswer(mcq, 1)).toBe(true);
    expect(checkMcqAnswer(mcq, 0)).toBe(false);
    expect(checkMcqAnswer(mcq, 2)).toBe(false);
  });

  const text: TextQuestion = { id: 'y', type: 'riddle', difficulty: 'easy', category: 'c', prompt: 'p', answer: 'الظفر', altAnswers: ['أظافر'], clues: [], explanation: 'e' };
  it('accepts the exact answer', () => {
    expect(checkTextAnswer(text, 'الظفر')).toBe(true);
  });
  it('accepts a listed alternate answer', () => {
    expect(checkTextAnswer(text, 'أظافر')).toBe(true);
  });
  it('tolerates diacritics, hamza-on-alef variants, and surrounding whitespace', () => {
    expect(checkTextAnswer(text, '  اَلظُّفر  ')).toBe(true);
    expect(checkTextAnswer({ ...text, answer: 'أمل' }, 'امل')).toBe(true);
  });
  it('tolerates alef maqsura / ta marbuta typing variation', () => {
    expect(checkTextAnswer({ ...text, answer: 'هدية' }, 'هديه')).toBe(true);
    expect(checkTextAnswer({ ...text, answer: 'مستشفى' }, 'مستشفي')).toBe(true);
  });
  it('does not accept an unrelated word', () => {
    expect(checkTextAnswer(text, 'كرسي')).toBe(false);
  });
  it('rejects an empty answer', () => {
    expect(checkTextAnswer(text, '   ')).toBe(false);
  });
  it('does not over-normalize distinct words into matching (hamza-on-ya/waw and standalone hamza preserved)', () => {
    // "سماء" (sky) vs "سما" (a different, unrelated spelling) must stay distinct.
    expect(checkTextAnswer({ ...text, answer: 'سماء' }, 'سما')).toBe(false);
  });
  it('accepts the answer with or without a leading "ال" even when no altAnswer lists it', () => {
    const face: TextQuestion = { ...text, answer: 'الوجه', altAnswers: [] };
    expect(checkTextAnswer(face, 'وجه')).toBe(true); // bare noun, stored form has the article
    expect(checkTextAnswer(face, 'الوجه')).toBe(true); // exact match still works
    const hole: TextQuestion = { ...text, answer: 'حفرة', altAnswers: [] };
    expect(checkTextAnswer(hole, 'الحفرة')).toBe(true); // article added, stored form is bare
  });
});

describe('redactQuestion', () => {
  it('never leaks the MCQ correct index', () => {
    const q = QUESTION_BANK.find((x): x is McqQuestion => x.type === 'mcq_general')!;
    const pub = redactQuestion(q, 1);
    expect('correctIndex' in pub ? pub.correctIndex : undefined).toBeUndefined();
    expect(JSON.stringify(pub)).not.toContain('"correctIndex":' + q.correctIndex);
  });
  it('never leaks a text question answer or alternates', () => {
    const q = QUESTION_BANK.find((x): x is TextQuestion => x.type === 'riddle')!;
    const pub = redactQuestion(q, 1);
    expect(JSON.stringify(pub)).not.toContain(q.answer);
  });
  it('scramble letters are exactly the answer letters, just reordered', () => {
    const q = QUESTION_BANK.find((x): x is TextQuestion => x.type === 'scramble')!;
    const pub = redactQuestion(q, 42) as any;
    expect(pub.letters.slice().sort().join('')).toBe([...q.answer].sort().join(''));
  });
  it('the same seed always produces the same scramble order (so every player sees the same puzzle)', () => {
    const q = QUESTION_BANK.find((x): x is TextQuestion => x.type === 'scramble')!;
    const a = redactQuestion(q, 777) as any;
    const b = redactQuestion(q, 777) as any;
    expect(a.letters).toEqual(b.letters);
  });
  it('exposes the answer length for hidden_word/riddle, without exposing the letters themselves', () => {
    const q = QUESTION_BANK.find((x): x is TextQuestion => x.type === 'riddle')!;
    const pub = redactQuestion(q, 1) as any;
    expect(pub.answerLength).toBe(q.answer.replace(/\s/g, '').length);
    expect(pub.letters).toBeUndefined();
  });
});

describe('selectQuestions anti-repetition', () => {
  const bank: Question[] = Array.from({ length: 6 }, (_, i) => ({
    id: `q${i}`,
    type: 'riddle',
    difficulty: 'easy',
    category: 'c',
    prompt: 'p',
    answer: 'a',
    clues: [],
    explanation: 'e',
  }));

  it('prefers unseen questions', () => {
    const used = new Set(['q0', 'q1', 'q2']);
    const picked = selectQuestions(bank, 3, used, {}, seededRng(1));
    expect(picked.every((q) => !used.has(q.id))).toBe(true);
  });

  it('falls back to repeats only once the unseen pool is exhausted', () => {
    const used = new Set(['q0', 'q1', 'q2', 'q3', 'q4']); // only q5 unseen
    const picked = selectQuestions(bank, 3, used, {}, seededRng(1));
    expect(picked.map((q) => q.id)).toContain('q5');
    expect(picked).toHaveLength(3);
  });

  it('respects type/difficulty filters', () => {
    const mixed: Question[] = [...bank, { ...bank[0], id: 'hard1', difficulty: 'hard' }];
    const picked = selectQuestions(mixed, 10, new Set(), { difficulties: ['hard'] }, seededRng(1));
    expect(picked.every((q) => q.difficulty === 'hard')).toBe(true);
  });
});

describe('scoring', () => {
  it('a wrong answer scores zero by default', () => {
    expect(computePoints({ correct: false, difficulty: 'hard', timeMs: 1000, timeLimitMs: 20000, isFirstCorrect: false })).toBe(0);
  });
  it('an instant correct answer scores base + full speed bonus', () => {
    const pts = computePoints({ correct: true, difficulty: 'easy', timeMs: 0, timeLimitMs: 20000, isFirstCorrect: false });
    expect(pts).toBe(200); // 100 base + 100 max speed bonus
  });
  it('a correct answer at the very last moment scores ~base only', () => {
    const pts = computePoints({ correct: true, difficulty: 'easy', timeMs: 20000, timeLimitMs: 20000, isFirstCorrect: false });
    expect(pts).toBe(100);
  });
  it('first-correct adds a flat bonus on top', () => {
    const normal = computePoints({ correct: true, difficulty: 'medium', timeMs: 5000, timeLimitMs: 20000, isFirstCorrect: false });
    const first = computePoints({ correct: true, difficulty: 'medium', timeMs: 5000, timeLimitMs: 20000, isFirstCorrect: true });
    expect(first - normal).toBe(30);
  });
  it('a slow-but-correct expert answer still beats a fast-but-correct easy answer (knowledge > speed)', () => {
    const slowExpert = computePoints({ correct: true, difficulty: 'expert', timeMs: 19000, timeLimitMs: 20000, isFirstCorrect: false });
    const fastEasy = computePoints({ correct: true, difficulty: 'easy', timeMs: 0, timeLimitMs: 20000, isFirstCorrect: false });
    expect(slowExpert).toBeGreaterThan(fastEasy);
  });
  it('untimed play (timeLimitMs: null) skips the speed bonus entirely — correctness + difficulty only', () => {
    const instant = computePoints({ correct: true, difficulty: 'medium', timeMs: 0, timeLimitMs: null, isFirstCorrect: false });
    const slow = computePoints({ correct: true, difficulty: 'medium', timeMs: 999_999, timeLimitMs: null, isFirstCorrect: false });
    expect(instant).toBe(150); // base only, no speed bonus
    expect(instant).toBe(slow); // elapsed time has zero effect when untimed
  });
  it('first-correct bonus still applies when untimed', () => {
    const first = computePoints({ correct: true, difficulty: 'easy', timeMs: 5000, timeLimitMs: null, isFirstCorrect: true });
    expect(first).toBe(130); // 100 base + 30 first-correct, no speed component
  });
});

describe('ranking / tie-breaking', () => {
  it('ranks by score first', () => {
    const r = rankPlayers([
      { key: 'a', score: 100, correctCount: 1, totalTimeMs: 5000 },
      { key: 'b', score: 200, correctCount: 1, totalTimeMs: 5000 },
    ]);
    expect(r.map((x) => x.key)).toEqual(['b', 'a']);
  });
  it('ties on score are broken by more correct answers, then faster total time, then key', () => {
    const r = rankPlayers([
      { key: 'z', score: 100, correctCount: 2, totalTimeMs: 9000 },
      { key: 'a', score: 100, correctCount: 2, totalTimeMs: 5000 },
      { key: 'm', score: 100, correctCount: 1, totalTimeMs: 1000 },
    ]);
    expect(r.map((x) => x.key)).toEqual(['a', 'z', 'm']);
  });
  it('is fully deterministic given the same input (re-running produces the same order)', () => {
    const rows = [
      { key: 'p3', score: 50, correctCount: 1, totalTimeMs: 2000 },
      { key: 'p1', score: 50, correctCount: 1, totalTimeMs: 2000 },
    ];
    expect(rankPlayers(rows).map((x) => x.key)).toEqual(rankPlayers(rows).map((x) => x.key));
    expect(rankPlayers(rows).map((x) => x.key)).toEqual(['p1', 'p3']); // key as final tiebreak
  });
});

describe('question bank content integrity', () => {
  it('has unique ids', () => {
    const ids = QUESTION_BANK.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('every MCQ correctIndex points at a real option', () => {
    for (const q of QUESTION_BANK) {
      if (q.type === 'mcq_general' || q.type === 'mcq_proverb' || q.type === 'mcq_connection') {
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.options.length);
        expect(new Set(q.options).size).toBe(q.options.length); // no duplicate options
      }
    }
  });
  it('every text question has a non-empty answer and at least one clue', () => {
    for (const q of QUESTION_BANK) {
      if (q.type === 'scramble' || q.type === 'hidden_word' || q.type === 'riddle') {
        expect(q.answer.trim().length).toBeGreaterThan(0);
        expect(q.clues.length).toBeGreaterThan(0);
      }
    }
  });
  it('every scramble answer is pure Arabic letters (no spaces/digits) so letter-tiles work cleanly', () => {
    for (const q of QUESTION_BANK) {
      if (q.type === 'scramble') {
        expect(/^[؀-ۿ]+$/.test((q as TextQuestion).answer)).toBe(true);
      }
    }
  });
  it('covers every challenge type with a reasonable number of questions', () => {
    const counts: Record<string, number> = {};
    for (const q of QUESTION_BANK) counts[q.type] = (counts[q.type] ?? 0) + 1;
    for (const type of ['mcq_general', 'mcq_proverb', 'mcq_connection', 'scramble', 'hidden_word', 'riddle']) {
      expect(counts[type] ?? 0).toBeGreaterThanOrEqual(8);
    }
  });
});
