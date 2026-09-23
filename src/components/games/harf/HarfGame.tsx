import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'framer-motion';
import { AlertCircle, Ban, Check, ChevronLeft, Copy, Crown, Lock, MinusCircle, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  CATEGORIES,
  POINTS_DUPLICATE,
  POINTS_UNIQUE,
  startsWithLetter,
  type AnswerStatus,
  type HarfPlayer,
  type HarfState,
} from './harfLogic';
import { useHarfGame } from './useHarfGame';
import { LetterBadge, PlayerAvatar, PlayerStatus, TypingDots, colorOf, useCountUp, useLatest, useTick } from './HarfParts';

interface Props {
  channel: any;
  isHost: boolean;
  myKey: string;
  playerKeys: string[];
  playerNames: string[];
  onLeave?: () => void;
}

type Api = ReturnType<typeof useHarfGame>['actions'];

export function HarfGame({ channel, isHost, myKey, playerKeys, playerNames, onLeave }: Props) {
  const { state, locked, getNow, actions } = useHarfGame({ channel, isHost, myKey, playerKeys, playerNames });

  return (
    <MotionConfig reducedMotion="user">
      <div dir="rtl" lang="ar" className="harf-root mx-auto w-full max-w-3xl px-1 pb-6 text-foreground">
        {!state ? (
          <div className="flex flex-col items-center gap-4 py-24 text-muted-foreground">
            <TypingDots />
            <p className="font-bold">نتصل باللعبة…</p>
          </div>
        ) : (
          <>
            {state.phase !== 'lobby' && <TopBar state={state} />}
              <motion.div
                key={`${state.phase}-${state.phase === 'playing' ? state.round : ''}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
              >
                {state.phase === 'lobby' && <Lobby state={state} isHost={isHost} myKey={myKey} actions={actions} onLeave={onLeave} />}
                {state.phase === 'round_start' && <RoundStart state={state} getNow={getNow} />}
                {state.phase === 'playing' &&
                  (!state.active.includes(myKey) ? (
                    <Spectating state={state} myKey={myKey} getNow={getNow} />
                  ) : locked ? (
                    <Waiting state={state} myKey={myKey} getNow={getNow} />
                  ) : (
                    <Playing key={state.round} state={state} myKey={myKey} getNow={getNow} actions={actions} />
                  ))}
                {state.phase === 'reveal' && <Reveal state={state} myKey={myKey} getNow={getNow} actions={actions} />}
                {state.phase === 'round_results' && <RoundResults state={state} myKey={myKey} isHost={isHost} actions={actions} onLeave={onLeave} />}
              </motion.div>

          </>
        )}
      </div>
    </MotionConfig>
  );
}

// ---------------------------------------------------------------- shared

function TopBar({ state }: { state: HarfState }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 px-1">
      <span className="rounded-full bg-muted px-3 py-1 text-sm font-extrabold">
        الجولة <span className="tabular-nums">{state.round}</span>
      </span>
      {state.letter && state.phase !== 'round_start' && (
        <span className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          الحرف
          <span className="flex h-8 w-8 items-center justify-center rounded-xl text-lg font-black text-white" style={{ background: '#6d5efc' }}>
            {state.letter}
          </span>
        </span>
      )}
    </div>
  );
}

function useSecondsLeft(endsAt: number | null, getNow: () => number) {
  useTick(endsAt != null, 200);
  return endsAt == null ? 0 : Math.max(0, Math.ceil((endsAt - getNow()) / 1000));
}

function Timer({ state, getNow }: { state: HarfState; getNow: () => number }) {
  const left = useSecondsLeft(state.phaseEndsAt, getNow);
  const total = state.roundSeconds;
  const pct = Math.min(100, (left / total) * 100);
  const urgent = left <= 10;
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-linear"
          style={{ width: `${pct}%`, background: urgent ? '#f43f5e' : left <= 20 ? '#f59e0b' : '#10b981' }}
        />
      </div>
      <span
        dir="ltr"
        className={`w-12 text-center text-2xl font-black tabular-nums ${urgent ? 'text-rose-500 motion-safe:animate-pulse' : ''}`}
      >
        {left}
      </span>
    </div>
  );
}

const cardCls = 'rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60';

// ---------------------------------------------------------------- lobby

function Lobby({ state, isHost, myKey, actions, onLeave }: { state: HarfState; isHost: boolean; myKey: string; actions: Api; onLeave?: () => void }) {
  const [seconds, setSeconds] = useState(60);
  const connected = state.players.filter((p) => p.connected);
  const Seg = ({ value, set, options, suffix }: { value: number; set: (n: number) => void; options: number[]; suffix: string }) => (
    <div className="grid grid-cols-3 gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => set(o)}
          className={`h-12 rounded-2xl text-base font-extrabold transition-all active:scale-95 ${value === o ? 'bg-[#6d5efc] text-white shadow-md' : 'bg-muted hover:bg-muted/70'}`}
        >
          <span className="tabular-nums">{o}</span> {suffix}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-5 text-center">
      <div className="space-y-2 pt-4">
        <motion.div initial={{ scale: 0.4, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.55 }} className="inline-block">
          <LetterBadge letter="ح" size="lg" />
        </motion.div>
        <h2 className="text-4xl font-black">حرف</h2>
        <p className="text-muted-foreground">اكتب أسرع، وابتكر إجابة ما فكّر فيها غيرك</p>
      </div>

      <div className={`${cardCls} space-y-3`}>
        <p className="text-sm font-bold text-muted-foreground">اللاعبون ({connected.length})</p>
        <div className="flex flex-wrap justify-center gap-4">
          {connected.map((p, i) => (
            <motion.div key={p.key} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.06, type: 'spring' }} className="flex flex-col items-center gap-1">
              <PlayerAvatar player={p} size={56} ring={p.key === myKey} />
              <span className="max-w-20 truncate text-sm font-bold">{p.key === myKey ? 'أنت' : p.name}</span>
              {p.key === 'host' && <Crown className="h-3.5 w-3.5 text-amber-500" />}
            </motion.div>
          ))}
        </div>
      </div>

      {isHost ? (
        <div className={`${cardCls} space-y-4 text-start`}>
          <div className="space-y-2">
            <p className="text-sm font-bold text-muted-foreground">وقت الجولة</p>
            <Seg value={seconds} set={setSeconds} options={[45, 60, 90]} suffix="ثانية" />
          </div>
          <Button onClick={() => actions.start({ roundSeconds: seconds })} className="h-14 w-full rounded-2xl text-lg font-black" style={{ background: '#6d5efc' }}>
            يلّا نبدأ!
          </Button>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-2 py-3 font-bold text-muted-foreground">
          <TypingDots /> صاحب الغرفة يجهّز اللعبة
        </p>
      )}
      {onLeave && (
        <button onClick={onLeave} className="text-sm font-bold text-muted-foreground underline-offset-4 hover:underline">
          خروج من الغرفة
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- round start

function RoundStart({ state, getNow }: { state: HarfState; getNow: () => number }) {
  const left = useSecondsLeft(state.phaseEndsAt, getNow);
  const n = Math.min(3, Math.max(0, left));
  return (
    <div className="space-y-6 py-4 text-center">
      <p className="text-lg font-bold text-muted-foreground">
        الجولة <span className="tabular-nums">{state.round}</span> · الحرف هو
      </p>
      <div className="relative mx-auto flex h-48 w-48 items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-[30%]"
          style={{ background: '#6d5efc22' }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1.15, opacity: 1 }}
          transition={{ duration: 0.6 }}
        />
        <motion.div initial={{ scale: 0, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 12 }}>
          <LetterBadge letter={state.letter} size="xl" />
        </motion.div>
      </div>
      <div className="h-16">
        <AnimatePresence mode="popLayout">
          {n > 0 && (
            <motion.div
              key={n}
              dir="ltr"
              initial={{ scale: 1.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="text-5xl font-black tabular-nums"
            >
              {n}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((c, i) => (
          <motion.span
            key={c}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.07 }}
            className="rounded-full bg-muted px-4 py-1.5 text-sm font-bold"
          >
            {c}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- playing (my turn)

function Playing({ state, myKey, getNow, actions }: { state: HarfState; myKey: string; getNow: () => number; actions: Api }) {
  const [answers, setAnswers] = useState<string[]>(() => CATEGORIES.map(() => ''));
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const left = useSecondsLeft(state.phaseEndsAt, getNow);
  const latest = useLatest(answers);
  const sent = useRef(false);

  const filled = answers.filter((a) => a.trim()).length;

  const submit = () => {
    if (sent.current) return;
    sent.current = true;
    actions.submit(latest.current);
  };

  // Time's up: send whatever is written so it still counts.
  useEffect(() => {
    if (left <= 0) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  useEffect(() => {
    const t = setTimeout(() => actions.reportProgress(filled), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled]);

  useEffect(() => {
    refs.current[0]?.focus({ preventScroll: true });
  }, []);

  const others = useMemo(() => ({ ...state, players: state.players.filter((p) => p.key !== myKey) }), [state, myKey]);

  return (
    <div className="space-y-4">
      <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} className={`${cardCls} sticky top-2 z-10 space-y-3`}>
        <div className="flex items-center gap-4">
          <LetterBadge letter={state.letter} size="md" />
          <div className="flex-1">
            <p className="text-xl font-black">دورك! اكتب بسرعة ✍️</p>
            <p className="text-sm text-muted-foreground">
              <span className="tabular-nums">{filled}</span> من <span className="tabular-nums">{CATEGORIES.length}</span> جاهزة
            </p>
          </div>
        </div>
        <Timer state={state} getNow={getNow} />
      </motion.div>

      <div className="grid gap-3 md:grid-cols-2">
        {CATEGORIES.map((cat, i) => {
          const v = answers[i];
          const has = !!v.trim();
          const ok = has && startsWithLetter(v, state.letter);
          return (
            <motion.label
              key={cat}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex flex-col gap-1 rounded-2xl p-3 ring-2 transition-colors ${
                ok ? 'bg-emerald-500/10 ring-emerald-500/50' : has ? 'bg-amber-500/10 ring-amber-500/50' : 'bg-card ring-transparent focus-within:ring-[#6d5efc]/60'
              } shadow-soft`}
            >
              <span className="flex items-center justify-between text-sm font-extrabold text-muted-foreground">
                {cat}
                <AnimatePresence>
                  {ok && (
                    <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 16 }} className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="h-4 w-4" />
                    </motion.span>
                  )}
                  {has && !ok && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3.5 w-3.5" /> لازم يبدأ بحرف {state.letter}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <input
                ref={(el) => {
                  refs.current[i] = el;
                }}
                dir="rtl"
                lang="ar"
                value={v}
                maxLength={40}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={i === CATEGORIES.length - 1 ? 'done' : 'next'}
                placeholder={`${state.letter}…`}
                onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  if (i < CATEGORIES.length - 1) refs.current[i + 1]?.focus();
                  else (e.target as HTMLInputElement).blur();
                }}
                className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground/40"
              />
            </motion.label>
          );
        })}
      </div>

      <div className="sticky bottom-3 z-10">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl text-2xl font-black text-white shadow-xl"
          style={{ background: filled === CATEGORIES.length ? '#10b981' : '#6d5efc' }}
        >
          خلّصت! <Check className="h-7 w-7" />
        </motion.button>
      </div>

      {others.players.length > 0 && (
        <div className="pt-2">
          <PlayerStatus state={others} myKey={myKey} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- waiting (submitted) / spectating

function Waiting({ state, myKey, getNow }: { state: HarfState; myKey: string; getNow: () => number }) {
  const pending = state.active.filter((k) => !state.submitted[k] && state.players.find((p) => p.key === k)?.connected).length;
  return (
    <div className="space-y-5 text-center">
      <div className="space-y-3 pt-2">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
          <Check className="h-14 w-14" strokeWidth={3} />
        </motion.div>
        <h2 className="text-3xl font-black">خلّصت! 🎉</h2>
        <p className="flex items-center justify-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" /> إجاباتك مقفلة ومخفية عن الباقين
        </p>
      </div>
      <div className={`${cardCls} space-y-4 text-start`}>
        <Timer state={state} getNow={getNow} />
        <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          {pending > 0 ? (
            <>
              <TypingDots /> بانتظار <span className="tabular-nums">{pending}</span> {pending === 1 ? 'لاعب' : 'لاعبين'}
            </>
          ) : (
            <>الكل خلّص — نكشف الإجابات…</>
          )}
        </p>
        <PlayerStatus state={state} myKey={myKey} />
      </div>
    </div>
  );
}

function Spectating({ state, myKey, getNow }: { state: HarfState; myKey: string; getNow: () => number }) {
  return (
    <div className="space-y-5 py-4 text-center">
      <LetterBadge letter={state.letter} size="lg" />
      <h2 className="text-2xl font-black">الجولة جارية</h2>
      <p className="text-muted-foreground">تنضم مع الجميع في الجولة القادمة</p>
      <div className={`${cardCls} space-y-4 text-start`}>
        <Timer state={state} getNow={getNow} />
        <PlayerStatus state={state} myKey={myKey} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- reveal

const STATUS_UI: Record<AnswerStatus, { label: string; icon: typeof Sparkles; cls: string }> = {
  unique: { label: 'إجابة مميزة', icon: Sparkles, cls: 'text-emerald-600 dark:text-emerald-400' },
  duplicate: { label: 'مكرّرة', icon: Copy, cls: 'text-amber-600 dark:text-amber-400' },
  invalid: { label: 'ما تبدأ بالحرف', icon: Ban, cls: 'text-rose-500' },
  empty: { label: 'ما كتب', icon: MinusCircle, cls: 'text-muted-foreground' },
};

function orderedActive(state: HarfState, myKey: string): HarfPlayer[] {
  const list = state.active.map((k) => state.players.find((p) => p.key === k)).filter(Boolean) as HarfPlayer[];
  return [...list.filter((p) => p.key === myKey), ...list.filter((p) => p.key !== myKey)];
}

function Reveal({ state, myKey, getNow, actions }: { state: HarfState; myKey: string; getNow: () => number; actions: Api }) {
  const idx = state.revealIndex;
  const cat = CATEGORIES[idx];
  const players = orderedActive(state, myKey);
  const total = state.phaseEndsAt ? Math.max(1, state.phaseEndsAt - state.now) : 1;
  const left = useSecondsLeft(state.phaseEndsAt, getNow);
  void left;
  const remainMs = state.phaseEndsAt ? Math.max(0, state.phaseEndsAt - getNow()) : 0;

  return (
    <div className="space-y-4">
      {idx === 0 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 1.6, times: [0, 0.15, 0.8, 1] }} className="text-center text-lg font-extrabold">
          خلّينا نشوف شو كتب الكل 👀
        </motion.p>
      )}

      <div className="flex justify-center gap-1.5" aria-hidden>
        {CATEGORIES.map((c, i) => (
          <span key={c} className={`h-1.5 w-8 rounded-full transition-colors ${i < idx ? 'bg-[#6d5efc]' : i === idx ? 'bg-[#6d5efc]/60' : 'bg-muted'}`} />
        ))}
      </div>

      <>
        <motion.div key={idx} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="space-y-3">
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-black">{cat}</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl text-xl font-black text-white" style={{ background: '#6d5efc' }}>
              {state.letter}
            </span>
          </div>

          <div className="space-y-3">
            {players.map((p, i) => {
              const cell = state.results?.[p.key]?.[idx];
              if (!cell) return null;
              const ui = STATUS_UI[cell.status];
              const Icon = ui.icon;
              const mine = p.key === myKey;
              const c = colorOf(p);
              const dim = cell.status === 'empty' || cell.status === 'invalid';
              const delay = 0.2 + i * 0.45;
              return (
                <motion.div
                  key={p.key}
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay, type: 'spring', stiffness: 260, damping: 20 }}
                  className={`flex items-center gap-3 rounded-3xl p-3 pe-4 shadow-soft ${dim ? 'bg-muted/50' : 'bg-card'} ${dim ? '' : 'ring-2'}`}
                  style={dim ? { boxShadow: `inset 0 0 0 2px ${mine ? c : 'transparent'}` } : { ['--tw-ring-color' as string]: mine ? c : `${c}55` }}
                >
                  <PlayerAvatar player={p} size={48} ring={mine} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold" style={{ color: c }}>
                      {mine ? 'أنت' : p.name}
                    </p>
                    <motion.p
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: delay + 0.15, type: 'spring', stiffness: 300, damping: 15 }}
                      className={`truncate text-2xl font-black ${dim ? 'text-muted-foreground/60' : ''} ${cell.status === 'empty' ? 'text-base font-bold' : ''}`}
                    >
                      {cell.status === 'empty' ? '— ما كتب —' : cell.text}
                    </motion.p>
                    <p className={`flex items-center gap-1 text-xs font-bold ${ui.cls}`}>
                      <Icon className="h-3.5 w-3.5" /> {ui.label}
                    </p>
                  </div>
                  {cell.points > 0 && (
                    <motion.span
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: delay + 0.35, type: 'spring', stiffness: 400, damping: 12 }}
                      className={`rounded-2xl px-3 py-1.5 text-lg font-black tabular-nums text-white ${cell.status === 'unique' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    >
                      +{cell.points}
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </>

      <div className="flex items-center gap-3 pt-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <motion.div key={`${idx}`} className="h-full origin-right rounded-full" style={{ background: '#6d5efc' }} initial={{ scaleX: remainMs / total }} animate={{ scaleX: 0 }} transition={{ duration: remainMs / 1000, ease: 'linear' }} />
        </div>
        <Button onClick={actions.next} variant="secondary" className="h-11 gap-1 rounded-2xl px-5 font-extrabold">
          {idx + 1 < CATEGORIES.length ? 'التالي' : 'النتائج'} <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {POINTS_UNIQUE} نقاط للإجابة المميزة · {POINTS_DUPLICATE} للمكرّرة
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- round results

function ScoreRow({ p, state, rank, mine }: { p: HarfPlayer; state: HarfState; rank: number; mine: boolean }) {
  const gained = state.roundPoints[p.key] ?? 0;
  const prev = state.prevScores[p.key] ?? 0;
  const total = state.scores[p.key] ?? 0;
  const shown = useCountUp(prev, total, 1000, 500);
  const pts = useCountUp(0, gained, 800, 200);
  const c = colorOf(p);
  return (
    <motion.div layout transition={{ type: 'spring', stiffness: 300, damping: 28 }} className={`flex items-center gap-3 rounded-2xl p-3 ${mine ? 'ring-2' : ''} bg-card shadow-soft`} style={mine ? ({ ['--tw-ring-color' as string]: c } as React.CSSProperties) : undefined}>
      <span className="w-6 text-center text-lg font-black text-muted-foreground tabular-nums">{rank}</span>
      <PlayerAvatar player={p} size={40} />
      <span className="flex-1 truncate font-extrabold">{mine ? 'أنت' : p.name}</span>
      {gained > 0 && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 400, damping: 12 }} className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-sm font-black text-emerald-600 tabular-nums dark:text-emerald-400">
          +{pts}
        </motion.span>
      )}
      <span className="w-14 text-end text-2xl font-black tabular-nums">{shown}</span>
    </motion.div>
  );
}

function RoundResults({ state, myKey, isHost, actions, onLeave }: { state: HarfState; myKey: string; isHost: boolean; actions: Api; onLeave?: () => void }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 1500);
    return () => clearTimeout(t);
  }, []);
  const sorted = useMemo(() => {
    const src = settled ? state.scores : state.prevScores;
    return [...state.players].filter((p) => p.key in state.scores || state.active.includes(p.key)).sort((a, b) => (src[b.key] ?? 0) - (src[a.key] ?? 0));
  }, [settled, state]);

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.6 }} className="text-5xl">
          🏆
        </motion.div>
        <h2 className="text-3xl font-black">لوحة النتائج</h2>
      </div>
      <LayoutGroup>
        <div className="space-y-2">
          {sorted.map((p, i) => (
            <ScoreRow key={p.key} p={p} state={state} rank={i + 1} mine={p.key === myKey} />
          ))}
        </div>
      </LayoutGroup>
      {isHost ? (
        <Button onClick={actions.playAgain} className="h-14 w-full rounded-2xl text-lg font-black" style={{ background: '#6d5efc' }}>
          جولة جديدة
        </Button>
      ) : (
        <p className="flex items-center justify-center gap-2 py-2 text-sm font-bold text-muted-foreground">
          <TypingDots /> بانتظار صاحب الغرفة لبدء جولة جديدة
        </p>
      )}
      {onLeave && (
        <Button variant="secondary" onClick={onLeave} className="h-12 w-full rounded-2xl font-extrabold">
          العودة إلى الألعاب
        </Button>
      )}
    </div>
  );
}
