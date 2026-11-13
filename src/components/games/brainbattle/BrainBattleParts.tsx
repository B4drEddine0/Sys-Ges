import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Lightbulb } from 'lucide-react';
import { Input } from '@/components/ui';
import { DIFFICULTY_LABEL, QTYPE_LABEL, type Difficulty, type PublicQuestion, type QType } from './battleLogic';

export const SEAT_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308', '#6366f1', '#f97316'];
export const colorFor = (i: number) => SEAT_COLORS[i % SEAT_COLORS.length];
const brand = '#7c3aed';

export function Avatar({ name, color, me, size = 40, dim = false }: { name: string; color: number; me?: boolean; size?: number; dim?: boolean }) {
  const c = colorFor(color);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-white"
      style={{ width: size, height: size, background: c, fontSize: size * 0.42, boxShadow: me ? `0 0 0 3px rgb(var(--card)), 0 0 0 5px ${c}` : undefined, opacity: dim ? 0.5 : 1 }}
    >
      {name[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

export function TypeBadge({ type, difficulty }: { type: QType; difficulty: Difficulty }) {
  const t = QTYPE_LABEL[type];
  const d = DIFFICULTY_LABEL[difficulty];
  const diffColor = { easy: '#10b981', medium: '#0ea5e9', hard: '#f59e0b', expert: '#f43f5e' }[difficulty];
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-white" style={{ background: brand }}>
        {t.icon} {t.ar}
      </span>
      <span className="rounded-full px-2.5 py-1 text-xs font-black text-white" style={{ background: diffColor }}>
        {d.ar}
      </span>
    </div>
  );
}

export function CountdownBar({ now, endsAt, totalMs }: { now: number; endsAt: number; totalMs: number }) {
  const left = Math.max(0, endsAt - now);
  const pct = Math.max(0, Math.min(100, (left / totalMs) * 100));
  const urgent = left < totalMs * 0.2;
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-[width] duration-200 ease-linear" style={{ width: `${pct}%`, background: urgent ? '#f43f5e' : brand }} />
      </div>
      <span dir="ltr" className={`w-10 text-center text-xl font-black tabular-nums ${urgent ? 'text-rose-500' : ''}`}>
        {Math.ceil(left / 1000)}
      </span>
    </div>
  );
}

/** Reveals clues one at a time, paced across the time limit, for hidden_word/riddle types. */
function useProgressiveClues(clues: string[], elapsedMs: number, timeLimitMs: number) {
  const shown = useMemo(() => {
    if (clues.length === 0) return 0;
    const frac = Math.max(0, Math.min(1, elapsedMs / Math.max(1, timeLimitMs)));
    return Math.min(clues.length, 1 + Math.floor(frac * clues.length));
  }, [clues.length, elapsedMs, timeLimitMs]);
  return clues.slice(0, shown);
}

interface AnswerPanelProps {
  question: PublicQuestion;
  elapsedMs: number;
  timeLimitMs: number;
  disabled: boolean;
  onSubmitMcq: (index: number) => void;
  onSubmitText: (text: string) => void;
}

export function AnswerPanel({ question, elapsedMs, timeLimitMs, disabled, onSubmitMcq, onSubmitText }: AnswerPanelProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [tiles, setTiles] = useState<number[]>([]); // indices into letters[], in the order tapped
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setPicked(null);
    setText('');
    setTiles([]);
    setLocked(false);
  }, [question.id]);

  const lockAnd = (fn: () => void) => {
    if (locked || disabled) return;
    setLocked(true);
    fn();
  };

  // Called unconditionally (Rules of Hooks) — harmless no-op for MCQ questions, which
  // carry no `clues` field.
  const clues = useProgressiveClues('clues' in question ? question.clues : [], elapsedMs, timeLimitMs);

  if (question.type === 'mcq_general' || question.type === 'mcq_proverb' || question.type === 'mcq_connection') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {question.options.map((opt, i) => (
          <button
            key={i}
            disabled={disabled || locked}
            onClick={() => {
              setPicked(i);
              lockAnd(() => onSubmitMcq(i));
            }}
            className={`rounded-2xl border-2 p-4 text-start text-lg font-bold transition-all active:scale-[0.98] ${
              picked === i ? 'border-transparent text-white' : 'border-border bg-card hover:border-[color:var(--brand)]'
            } ${disabled || locked ? 'opacity-70' : ''}`}
            style={picked === i ? { background: brand } : undefined}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === 'scramble') {
    const letters = question.letters ?? [];
    const used = new Set(tiles);
    const current = tiles.map((i) => letters[i]).join('');
    return (
      <div className="space-y-4">
        <div className="flex min-h-14 flex-wrap items-center justify-center gap-2 rounded-2xl bg-muted/60 p-3">
          {tiles.length === 0 && <span className="text-sm text-muted-foreground">اضغط على الحروف لتكوين الكلمة</span>}
          {tiles.map((i, pos) => (
            <button
              key={pos}
              disabled={disabled || locked}
              onClick={() => setTiles((t) => t.filter((_, j) => j !== pos))}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-xl font-black text-white shadow-md"
              style={{ background: brand }}
            >
              {letters[i]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {letters.map((l, i) => (
            <button
              key={i}
              disabled={used.has(i) || disabled || locked}
              onClick={() => setTiles((t) => [...t, i])}
              className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-border bg-card text-xl font-black disabled:opacity-25"
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTiles([])} disabled={disabled || locked} className="h-11 flex-1 rounded-2xl bg-muted font-bold disabled:opacity-40">
            مسح
          </button>
          <button
            onClick={() => lockAnd(() => onSubmitText(current))}
            disabled={disabled || locked || tiles.length !== letters.length}
            className="h-11 flex-[2] rounded-2xl font-black text-white disabled:opacity-40"
            style={{ background: brand }}
          >
            تأكيد الإجابة
          </button>
        </div>
      </div>
    );
  }

  // hidden_word / riddle
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {clues.map((c, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-sm font-bold text-amber-700 dark:text-amber-400">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
              {c}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          lockAnd(() => onSubmitText(text));
        }}
        className="flex gap-2"
      >
        <Input dir="rtl" autoFocus value={text} disabled={disabled || locked} onChange={(e) => setText(e.target.value)} placeholder="اكتب إجابتك هنا…" className="h-12 flex-1 text-lg" />
        <button type="submit" disabled={disabled || locked || !text.trim()} className="h-12 rounded-2xl px-6 font-black text-white disabled:opacity-40" style={{ background: brand }}>
          إرسال
        </button>
      </form>
    </div>
  );
}

export function ResultBadge({ correct }: { correct: boolean }) {
  return correct ? (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
      <Check className="h-4 w-4" />
    </span>
  ) : (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white">
      <X className="h-4 w-4" />
    </span>
  );
}

export const BRAND = brand;
