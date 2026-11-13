import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Crown, Trophy, Users, WifiOff, Zap } from 'lucide-react';
import { Button } from '@/components/ui';
import { QTYPE_LABEL, isMcqQuestion, rankPlayers, type QType, type Difficulty } from './battleLogic';
import { useBrainBattleGame, type BattlePublicState, type BattleSettings } from './useBrainBattleGame';
import { Avatar, AnswerPanel, ResultBadge, TypeBadge, colorFor, BRAND } from './BrainBattleParts';

interface Props {
  channel: any;
  isHost: boolean;
  myKey: string;
  playerKeys: string[];
  playerNames: string[];
  hostConnected: boolean;
  onLeave?: () => void;
}

export function BrainBattleGame({ channel, isHost, myKey, playerKeys, playerNames, hostConnected, onLeave }: Props) {
  const { state, actions, getNow, hostMissing } = useBrainBattleGame({ channel, isHost, myKey, playerKeys, playerNames, hostConnected });

  return (
    <MotionConfig reducedMotion="user">
      <div dir="rtl" className="mx-auto w-full max-w-3xl px-1 pb-6 text-foreground">
        {hostMissing ? (
          <HostMissing onLeave={onLeave} />
        ) : !state ? (
          <div className="flex flex-col items-center gap-4 py-24 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            <p className="font-bold">جارٍ الاتصال بالتحدّي…</p>
          </div>
        ) : (
          <>
            {state.phase === 'lobby' && <Lobby state={state} isHost={isHost} myKey={myKey} actions={actions} onLeave={onLeave} />}
            {(state.phase === 'round_start' || state.phase === 'answering') && <RoundView state={state} myKey={myKey} isHost={isHost} actions={actions} getNow={getNow} />}
            {state.phase === 'reveal' && <RevealView state={state} myKey={myKey} isHost={isHost} actions={actions} />}
            {state.phase === 'round_results' && <RoundResultsView state={state} myKey={myKey} isHost={isHost} actions={actions} />}
            {state.phase === 'final' && <FinalView state={state} myKey={myKey} isHost={isHost} actions={actions} onLeave={onLeave} />}
          </>
        )}
      </div>
    </MotionConfig>
  );
}

const cardCls = 'rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60';

function HostMissing({ onLeave }: { onLeave?: () => void }) {
  return (
    <div className="space-y-5 py-20 text-center">
      <WifiOff className="mx-auto h-12 w-12 text-muted-foreground" />
      <h2 className="text-2xl font-black">صاحب الغرفة غادر</h2>
      <p className="text-muted-foreground">لا يمكن إكمال التحدّي بدونه — جرّب إنشاء غرفة جديدة.</p>
      {onLeave && (
        <Button variant="secondary" onClick={onLeave} className="rounded-2xl">
          العودة إلى الألعاب
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- lobby

const ALL_TYPES = Object.keys(QTYPE_LABEL) as QType[];
const ALL_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

function Lobby({ state, isHost, myKey, actions, onLeave }: { state: BattlePublicState; isHost: boolean; myKey: string; actions: ReturnType<typeof useBrainBattleGame>['actions']; onLeave?: () => void }) {
  const [rounds, setRounds] = useState(8);
  const [types, setTypes] = useState<QType[]>(ALL_TYPES);
  const [difficulties, setDifficulties] = useState<Difficulty[]>(ALL_DIFFICULTIES);
  const players = Object.values(state.players).filter((p) => p.connected);

  const toggle = <T,>(list: T[], setList: (v: T[]) => void, v: T) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const startGame = () => {
    const settings: BattleSettings = {
      totalRounds: rounds,
      types: types.length ? types : ALL_TYPES,
      difficulties: difficulties.length ? difficulties : ALL_DIFFICULTIES,
    };
    actions.start(settings);
  };

  return (
    <div className="space-y-5 pt-4 text-center">
      <div className="space-y-2">
        <motion.div initial={{ scale: 0.4, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.55 }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28%] text-3xl text-white shadow-lg" style={{ background: BRAND }}>
          🧠
        </motion.div>
        <h2 className="text-4xl font-black">تحدّي العقول</h2>
        <p className="text-muted-foreground">ثقافة عامة، ألغاز، كلمات مبعثرة وأمثال — من يملك أسرع عقل؟</p>
      </div>

      <div className={`${cardCls} space-y-3`}>
        <p className="text-sm font-bold text-muted-foreground">اللاعبون ({players.length})</p>
        <div className="flex flex-wrap justify-center gap-4">
          {players.map((p, i) => (
            <motion.div key={p.key} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.05, type: 'spring' }} className="flex flex-col items-center gap-1">
              <Avatar name={p.name} color={p.color} me={p.key === myKey} size={56} />
              <span className="max-w-20 truncate text-sm font-bold">{p.key === myKey ? 'أنت' : p.name}</span>
              {p.key === 'host' && <Crown className="h-3.5 w-3.5 text-amber-500" />}
            </motion.div>
          ))}
        </div>
      </div>

      {isHost ? (
        <div className={`${cardCls} space-y-4 text-start`}>
          <div className="space-y-2">
            <p className="text-sm font-bold text-muted-foreground">عدد الجولات</p>
            <div className="grid grid-cols-4 gap-2">
              {[5, 8, 12, 15].map((n) => (
                <button key={n} onClick={() => setRounds(n)} className={`h-11 rounded-2xl text-sm font-extrabold transition-all active:scale-95 ${rounds === n ? 'text-white shadow-md' : 'bg-muted hover:bg-muted/70'}`} style={rounds === n ? { background: BRAND } : undefined}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <p className="flex items-center justify-center gap-1.5 rounded-2xl bg-muted/60 px-3 py-2 text-xs font-bold text-muted-foreground">
            ⏱️ بدون وقت محدد — كل لاعب يجاوب براحته، وتنتقل الجولة بمجرد أن يجاوب الجميع
          </p>
          <div className="space-y-2">
            <p className="text-sm font-bold text-muted-foreground">أنواع التحدّي</p>
            <div className="flex flex-wrap gap-2">
              {ALL_TYPES.map((t) => (
                <button key={t} onClick={() => toggle(types, setTypes, t)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${types.includes(t) ? 'text-white' : 'bg-muted text-muted-foreground'}`} style={types.includes(t) ? { background: BRAND } : undefined}>
                  {QTYPE_LABEL[t].icon} {QTYPE_LABEL[t].ar}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-bold text-muted-foreground">مستوى الصعوبة</p>
            <div className="flex flex-wrap gap-2">
              {ALL_DIFFICULTIES.map((d) => (
                <button key={d} onClick={() => toggle(difficulties, setDifficulties, d)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${difficulties.includes(d) ? 'text-white' : 'bg-muted text-muted-foreground'}`} style={difficulties.includes(d) ? { background: BRAND } : undefined}>
                  {d === 'easy' ? 'سهل' : d === 'medium' ? 'متوسط' : d === 'hard' ? 'صعب' : 'خبير'}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={startGame} disabled={players.length < 1} className="h-14 w-full rounded-2xl text-lg font-black text-white hover:opacity-90" style={{ background: BRAND }}>
            ابدأ التحدّي
          </Button>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-2 py-3 font-bold text-muted-foreground">
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:130ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:260ms]" />
          </span>
          بانتظار صاحب الغرفة
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

// ---------------------------------------------------------------- round (start + answering)

function useTick(ms = 200) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

function RoundView({ state, myKey, isHost, actions, getNow }: { state: BattlePublicState; myKey: string; isHost: boolean; actions: ReturnType<typeof useBrainBattleGame>['actions']; getNow: () => number }) {
  useTick(300);
  const now = getNow();
  const me = state.players[myKey];
  const isActive = state.active.includes(myKey);
  const submitted = state.submittedKeys.includes(myKey);
  const others = state.active.filter((k) => k !== myKey);
  const submittedOthers = others.filter((k) => state.submittedKeys.includes(k));
  const stillWaitingOn = others.filter((k) => !state.submittedKeys.includes(k) && state.players[k]);

  if (state.phase === 'round_start') {
    const n = state.phaseEndsAt ? Math.max(0, Math.ceil((state.phaseEndsAt - now) / 1000)) : 0;
    return (
      <div className="space-y-6 py-10 text-center">
        <p className="text-sm font-bold text-muted-foreground">
          الجولة {state.round} / {state.totalRounds}
        </p>
        {state.question && <div className="flex justify-center">{<TypeBadge type={state.question.type} difficulty={state.question.difficulty} />}</div>}
        <AnimatePresence mode="popLayout">
          <motion.div key={n} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="text-7xl font-black tabular-nums" style={{ color: BRAND }}>
            {n > 0 ? n : 'ابدأ!'}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  if (!isActive || !me) {
    return (
      <div className="space-y-5 py-10 text-center">
        <p className="text-muted-foreground">ستنضم في الجولة القادمة</p>
        <p className="text-xs text-muted-foreground">بدون وقت محدد — اللعبة تنتظر الجميع</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-bold text-muted-foreground">
          الجولة {state.round} / {state.totalRounds}
        </p>
        {state.question && <TypeBadge type={state.question.type} difficulty={state.question.difficulty} />}
      </div>

      <div className={cardCls}>
        <p className="mb-4 text-center text-2xl font-black leading-relaxed">{state.question?.prompt}</p>
        {submitted ? (
          <div className="py-10 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.6 }} className="mb-2 text-4xl">
              ✅
            </motion.div>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">أُرسلت إجابتك</p>
            <p className="mt-1 text-sm text-muted-foreground">خذ وقتك في مشاهدة الباقين وهم يجاوبون — لا يوجد وقت محدد</p>
          </div>
        ) : state.question ? (
          <AnswerPanel
            question={state.question}
            elapsedMs={state.roundStartAt ? now - state.roundStartAt : 0}
            disabled={submitted}
            onSubmitMcq={(i) => actions.submitMcq(i)}
            onSubmitText={(t) => actions.submitText(t)}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {others.map((k) => {
          const p = state.players[k];
          if (!p) return null;
          const done = state.submittedKeys.includes(k);
          return (
            <span key={k} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${done ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
              <Avatar name={p.name} color={p.color} size={18} dim={!p.connected} />
              {p.name} {done ? '✓' : p.connected ? '…' : '⚠️'}
            </span>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {submittedOthers.length} / {others.length} من الآخرين أجابوا — تنتقل الجولة تلقائيًا عندما يجاوب الجميع
      </p>

      {isHost && stillWaitingOn.length > 0 && (
        <button onClick={actions.forceFinish} className="mx-auto block text-xs font-bold text-muted-foreground underline-offset-4 hover:underline">
          لاعب عالق أو غير متصل؟ أنهِ الجولة الآن بدونه
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- reveal

function RevealView({ state, myKey, isHost, actions }: { state: BattlePublicState; myKey: string; isHost: boolean; actions: ReturnType<typeof useBrainBattleGame>['actions'] }) {
  const q = state.revealQuestion;
  const results = state.results ?? {};
  const sorted = useMemo(() => state.active.map((k) => results[k]).filter(Boolean).sort((a, b) => b.points - a.points), [state.active, results]);
  let correctText = '';
  if (q) {
    if (isMcqQuestion(q)) correctText = q.options[q.correctIndex];
    else correctText = q.answer;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-center">
        <p className="text-sm font-bold text-muted-foreground">
          الجولة {state.round} / {state.totalRounds}
        </p>
        <p className="text-lg font-bold">{q?.prompt}</p>
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', bounce: 0.5 }} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/15 px-5 py-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">
          {correctText}
        </motion.div>
        {q?.explanation && <p className="mx-auto max-w-md text-sm text-muted-foreground">{q.explanation}</p>}
      </div>

      <div className={`${cardCls} space-y-2`}>
        {sorted.map((r, i) => {
          const p = state.players[r.key];
          if (!p) return null;
          return (
            <motion.div key={r.key} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className={`flex items-center gap-3 rounded-2xl p-2.5 ${r.key === myKey ? 'bg-muted/60' : ''}`}>
              <Avatar name={p.name} color={p.color} me={r.key === myKey} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{r.key === myKey ? 'أنت' : p.name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.answered ? r.display || '—' : 'لم يُجب'}</p>
              </div>
              {r.isFirstCorrect && <Zap className="h-4 w-4 text-amber-500" />}
              <ResultBadge correct={r.correct} />
              <span className={`w-14 text-end text-lg font-black tabular-nums ${r.points > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{r.points > 0 ? `+${r.points}` : r.points}</span>
            </motion.div>
          );
        })}
      </div>

      {isHost && (
        <Button onClick={actions.skipAhead} variant="secondary" className="h-11 w-full rounded-2xl font-extrabold">
          التالي
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- round results (leaderboard)

function RoundResultsView({ state, myKey, isHost, actions }: { state: BattlePublicState; myKey: string; isHost: boolean; actions: ReturnType<typeof useBrainBattleGame>['actions'] }) {
  const rows = useMemo(
    () =>
      rankPlayers(
        state.active.map((k) => ({
          key: k,
          score: state.scores[k] ?? 0,
          correctCount: (state.history[k] ?? []).filter((p) => p > 0).length,
          totalTimeMs: 0,
        })),
      ),
    [state],
  );
  const isLast = state.round >= state.totalRounds;

  return (
    <div className="space-y-5 pt-2 text-center">
      <Trophy className="mx-auto h-10 w-10 text-amber-500" />
      <h2 className="text-2xl font-black">الترتيب العام</h2>
      <div className={`${cardCls} space-y-2 text-start`}>
        {rows.map((r, i) => {
          const p = state.players[r.key];
          if (!p) return null;
          const prev = state.prevScores[r.key] ?? 0;
          const gained = r.score - prev;
          return (
            <motion.div key={r.key} layout className={`flex items-center gap-3 rounded-2xl p-2.5 ${r.key === myKey ? 'bg-muted/60' : ''}`}>
              <span className="w-5 text-center text-sm font-black tabular-nums text-muted-foreground">{i + 1}</span>
              <Avatar name={p.name} color={p.color} me={r.key === myKey} size={32} />
              <span className="flex-1 truncate font-bold">{r.key === myKey ? 'أنت' : p.name}</span>
              {gained > 0 && <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">+{gained}</span>}
              <span className="text-lg font-black tabular-nums">{r.score}</span>
            </motion.div>
          );
        })}
      </div>
      {isHost ? (
        <Button onClick={actions.skipAhead} className="h-13 w-full rounded-2xl text-lg font-black text-white" style={{ background: BRAND }}>
          {isLast ? 'عرض النتيجة النهائية' : 'الجولة التالية'}
        </Button>
      ) : (
        <p className="text-sm font-bold text-muted-foreground">بانتظار صاحب الغرفة</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- final podium

function FinalView({ state, myKey, isHost, actions, onLeave }: { state: BattlePublicState; myKey: string; isHost: boolean; actions: ReturnType<typeof useBrainBattleGame>['actions']; onLeave?: () => void }) {
  const rows = useMemo(
    () =>
      rankPlayers(
        state.active.map((k) => ({
          key: k,
          score: state.scores[k] ?? 0,
          correctCount: (state.history[k] ?? []).filter((p) => p > 0).length,
          totalTimeMs: (state.timeHistory[k] ?? []).reduce((a, b) => a + b, 0),
        })),
      ),
    [state],
  );
  const podium = [rows[1], rows[0], rows[2]].filter(Boolean);
  const heights: Record<number, string> = { 0: 'h-28', 1: 'h-36', 2: 'h-20' };
  const medalRank = (r: (typeof rows)[number]) => rows.indexOf(r);

  // Genuinely "fastest" — average time-to-correct-answer, not a proxy off points (points
  // no longer carry a speed component in untimed friends mode, see computePoints).
  const fastest = useMemo(() => {
    const candidates = rows
      .map((r) => {
        const times = state.timeHistory[r.key] ?? [];
        return times.length ? { key: r.key, avg: times.reduce((a, b) => a + b, 0) / times.length } : null;
      })
      .filter((x): x is { key: string; avg: number } => x !== null);
    // Lower average time = faster.
    return candidates.reduce<{ key: string; avg: number } | null>((best, c) => (!best || c.avg < best.avg ? c : best), null);
  }, [rows, state.timeHistory]);

  const mostAccurate = useMemo(() => {
    const candidates = rows
      .map((r) => {
        const hist = state.history[r.key] ?? [];
        return hist.length ? { key: r.key, rate: hist.filter((p) => p > 0).length / hist.length } : null;
      })
      .filter((x): x is { key: string; rate: number } => x !== null);
    return candidates.reduce<{ key: string; rate: number } | null>((best, c) => (!best || c.rate > best.rate ? c : best), null);
  }, [rows, state.history]);

  return (
    <div className="space-y-6 pt-2 text-center">
      <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.6 }}>
        <Trophy className="mx-auto h-14 w-14 text-amber-500" />
      </motion.div>
      <h2 className="text-3xl font-black">{rows[0]?.key === myKey ? 'لقد فزت! 🎉' : rows[0] ? `${state.players[rows[0].key]?.name} يفوز بالتحدّي!` : 'انتهى التحدّي'}</h2>

      <div className="flex items-end justify-center gap-3">
        {podium.map((r) => {
          const p = state.players[r.key];
          if (!p) return null;
          const rank = medalRank(r);
          return (
            <motion.div key={r.key} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + (2 - rank) * 0.25, type: 'spring', damping: 18 }} className="flex w-24 flex-col items-center gap-1">
              {rank === 0 && <Crown className="h-6 w-6 text-amber-500" />}
              <Avatar name={p.name} color={p.color} me={r.key === myKey} size={rank === 0 ? 60 : 48} />
              <span className="max-w-full truncate text-sm font-extrabold">{r.key === myKey ? 'أنت' : p.name}</span>
              <div className={`${heights[rank]} flex w-full items-start justify-center rounded-t-2xl pt-2 text-xl font-black text-white`} style={{ background: colorFor(p.color) }}>
                {r.score}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {fastest && (
          <div className={`${cardCls} py-3`}>
            <p className="text-xs font-bold text-muted-foreground">⚡ الأسرع</p>
            <p className="font-extrabold">{fastest.key === myKey ? 'أنت' : state.players[fastest.key]?.name}</p>
          </div>
        )}
        {mostAccurate && (
          <div className={`${cardCls} py-3`}>
            <p className="text-xs font-bold text-muted-foreground">🎯 الأدق</p>
            <p className="font-extrabold">{mostAccurate.key === myKey ? 'أنت' : state.players[mostAccurate.key]?.name}</p>
          </div>
        )}
      </div>

      <div className={`${cardCls} space-y-2`}>
        <p className="text-sm font-bold text-muted-foreground">الترتيب الكامل</p>
        {rows.map((r, i) => {
          const p = state.players[r.key];
          if (!p) return null;
          return (
            <div key={r.key} className="flex items-center gap-3">
              <span className="w-5 text-center text-sm font-black tabular-nums text-muted-foreground">{i + 1}</span>
              <Avatar name={p.name} color={p.color} size={28} />
              <span className="flex-1 truncate text-start font-bold">{r.key === myKey ? 'أنت' : p.name}</span>
              <span className="text-lg font-black tabular-nums">{r.score}</span>
            </div>
          );
        })}
      </div>

      <div className="grid gap-2">
        {isHost ? (
          <Button onClick={() => actions.restart()} className="h-14 rounded-2xl text-lg font-black text-white" style={{ background: BRAND }}>
            تحدٍ جديد
          </Button>
        ) : (
          <p className="flex items-center justify-center gap-2 py-2 text-sm font-bold text-muted-foreground">
            <Users className="h-4 w-4" /> بانتظار صاحب الغرفة
          </p>
        )}
        {onLeave && (
          <Button variant="secondary" onClick={onLeave} className="h-12 rounded-2xl font-extrabold">
            العودة إلى الألعاب
          </Button>
        )}
      </div>
    </div>
  );
}
