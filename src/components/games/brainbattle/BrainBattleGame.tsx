import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Crown, Trophy, Users, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui';
import { QTYPE_LABEL, rankPlayers, type QType, type Difficulty } from './battleLogic';
import { useBrainBattleGame, type BattlePublicState, type BattleSettings, type FinalAnswerCell } from './useBrainBattleGame';
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
  const { state, lastAck, actions, hostMissing } = useBrainBattleGame({ channel, isHost, myKey, playerKeys, playerNames, hostConnected });

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
            {state.phase === 'playing' && <PlayingView state={state} myKey={myKey} isHost={isHost} lastAck={lastAck} actions={actions} />}
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
  const [count, setCount] = useState(15);
  const [types, setTypes] = useState<QType[]>(ALL_TYPES);
  const [difficulties, setDifficulties] = useState<Difficulty[]>(ALL_DIFFICULTIES);
  const players = Object.values(state.players).filter((p) => p.connected);

  const toggle = <T,>(list: T[], setList: (v: T[]) => void, v: T) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const startGame = () => {
    const settings: BattleSettings = {
      totalQuestions: count,
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
        <p className="text-muted-foreground">ثقافة عامة، ألغاز، كلمات مبعثرة وأمثال — من يملك أذكى عقل؟</p>
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
          <p className="flex items-center justify-center gap-1.5 rounded-2xl bg-muted/60 px-3 py-2 text-xs font-bold text-muted-foreground">
            ⏱️ بدون وقت محدد — كل لاعب يجاوب براحته ويتابع للسؤال التالي فورًا، وبعد أن ينهي الجميع كل الأسئلة نكشف إجابة الجميع معًا في جدول واحد
          </p>
          <div className="space-y-2">
            <p className="text-sm font-bold text-muted-foreground">عدد الأسئلة</p>
            <div className="grid grid-cols-3 gap-2">
              {[10, 15, 20, 25, 30, 40].map((n) => (
                <button key={n} onClick={() => setCount(n)} className={`h-11 rounded-2xl text-sm font-extrabold transition-all active:scale-95 ${count === n ? 'text-white shadow-md' : 'bg-muted hover:bg-muted/70'}`} style={count === n ? { background: BRAND } : undefined}>
                  {n}
                </button>
              ))}
            </div>
          </div>
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
            {(difficulties.includes('hard') || difficulties.includes('expert')) && (
              <p className="text-xs text-muted-foreground">صعب وخبير تلميحاتهما أقل — أسئلة حقيقية صعبة، مو بس شكليًا.</p>
            )}
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

// ---------------------------------------------------------------- playing (self-paced)

function PlayingView({
  state,
  myKey,
  isHost,
  lastAck,
  actions,
}: {
  state: BattlePublicState;
  myKey: string;
  isHost: boolean;
  lastAck: { questionIndex: number; correct: boolean; points: number } | null;
  actions: ReturnType<typeof useBrainBattleGame>['actions'];
}) {
  const [busy, setBusy] = useState(false);
  const myIndex = state.progress[myKey] ?? 0;
  const amFinished = state.finished.includes(myKey);
  const question = !amFinished ? state.questions[myIndex] : null;

  useEffect(() => setBusy(false), [myIndex]);

  const submitMcq = (i: number) => {
    setBusy(true);
    actions.submitMcq(myIndex, i);
  };
  const submitText = (t: string) => {
    setBusy(true);
    actions.submitText(myIndex, t);
  };

  const others = state.active.filter((k) => k !== myKey);
  const othersWaitingOn = others.filter((k) => !state.finished.includes(k) && state.players[k]?.connected);

  if (amFinished || !question) {
    return (
      <div className="space-y-5 py-8 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.6 }} className="text-5xl">
          🏁
        </motion.div>
        <h2 className="text-2xl font-black">أنهيت كل الأسئلة!</h2>
        <p className="text-muted-foreground">بانتظار بقية اللاعبين لإنهاء التحدّي، وبعدها نكشف إجابة الجميع معًا</p>
        <div className={`${cardCls} space-y-2 text-start`}>
          {state.active.map((k) => {
            const p = state.players[k];
            if (!p) return null;
            const done = state.finished.includes(k);
            const prog = state.progress[k] ?? 0;
            return (
              <div key={k} className="flex items-center gap-3">
                <Avatar name={p.name} color={p.color} me={k === myKey} size={28} dim={!p.connected} />
                <span className="flex-1 truncate text-sm font-bold">{k === myKey ? 'أنت' : p.name}</span>
                {done ? (
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">تم ✓</span>
                ) : (
                  <span className="text-xs font-bold tabular-nums text-muted-foreground">
                    {prog}/{state.totalQuestions} {!p.connected && '⚠️'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {isHost && othersWaitingOn.length > 0 && (
          <button onClick={actions.forceFinishGame} className="text-xs font-bold text-muted-foreground underline-offset-4 hover:underline">
            لاعب عالق أو غير متصل؟ أنهِ التحدّي الآن بدونه
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-bold text-muted-foreground">
          السؤال <span className="tabular-nums">{myIndex + 1}</span> / <span className="tabular-nums">{state.totalQuestions}</span>
        </p>
        <TypeBadge type={question.type} difficulty={question.difficulty} />
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div className="h-full rounded-full" style={{ background: BRAND }} animate={{ width: `${(myIndex / state.totalQuestions) * 100}%` }} transition={{ ease: 'easeOut' }} />
      </div>

      <div className={`${cardCls} relative`}>
        <AnimatePresence>
          {lastAck && lastAck.questionIndex === myIndex - 1 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-sm font-black text-white shadow-lg ${lastAck.correct ? 'bg-emerald-500' : 'bg-rose-500'}`}
            >
              {lastAck.correct ? `✅ +${lastAck.points}` : '❌ إجابة خاطئة'}
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mb-4 text-center text-2xl font-black leading-relaxed">{question.prompt}</p>
        <AnswerPanel question={question} elapsedMs={0} disabled={busy} onSubmitMcq={submitMcq} onSubmitText={submitText} />
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {others.map((k) => {
          const p = state.players[k];
          if (!p) return null;
          const prog = state.progress[k] ?? 0;
          const done = state.finished.includes(k);
          return (
            <span key={k} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${done ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
              <Avatar name={p.name} color={p.color} size={18} dim={!p.connected} />
              {p.name} {done ? '🏁' : `${prog}/${state.totalQuestions}`}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- final (podium + the fun reveal table)

function FinalView({ state, myKey, isHost, actions, onLeave }: { state: BattlePublicState; myKey: string; isHost: boolean; actions: ReturnType<typeof useBrainBattleGame>['actions']; onLeave?: () => void }) {
  const rows = useMemo(
    () =>
      rankPlayers(
        state.active.map((k) => ({
          key: k,
          score: state.scores[k] ?? 0,
          correctCount: (state.revealTable?.[k] ?? []).filter((c) => c.correct).length,
          totalTimeMs: 0,
        })),
      ),
    [state],
  );
  const podium = [rows[1], rows[0], rows[2]].filter(Boolean);
  const heights: Record<number, string> = { 0: 'h-28', 1: 'h-36', 2: 'h-20' };
  const medalRank = (r: (typeof rows)[number]) => rows.indexOf(r);

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
              {r.key === state.firstFinisherKey && <span className="text-[10px] font-bold text-muted-foreground">⚡ أول من أنهى</span>}
              <Avatar name={p.name} color={p.color} me={r.key === myKey} size={rank === 0 ? 60 : 48} />
              <span className="max-w-full truncate text-sm font-extrabold">{r.key === myKey ? 'أنت' : p.name}</span>
              <div className={`${heights[rank]} flex w-full items-start justify-center rounded-t-2xl pt-2 text-xl font-black text-white`} style={{ background: colorFor(p.color) }}>
                {r.score}
              </div>
            </motion.div>
          );
        })}
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
              <span className="text-xs font-bold text-muted-foreground">
                {r.correctCount}/{state.totalQuestions} صحيحة
              </span>
              <span className="w-12 text-end text-lg font-black tabular-nums">{r.score}</span>
            </div>
          );
        })}
      </div>

      <RevealTable state={state} rows={rows.map((r) => r.key)} myKey={myKey} />

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

/** The "make fun of each other" moment: every player's answer to every question, side by side. */
function RevealTable({ state, rows, myKey }: { state: BattlePublicState; rows: string[]; myKey: string }) {
  const table = state.revealTable;
  if (!table) return null;
  const cellLabel = (c: FinalAnswerCell | undefined) => {
    if (!c || !c.answered) return '—';
    return c.display || '—';
  };

  return (
    <div className={`${cardCls} space-y-3 text-start`}>
      <p className="text-center text-sm font-bold text-muted-foreground">جدول الإجابات — وقت الفضايح 😄</p>
      <div className="overflow-auto rounded-2xl border border-border" style={{ maxHeight: 420 }}>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 min-w-28 border-b border-border bg-card p-2 text-start font-bold text-muted-foreground">السؤال</th>
              {rows.map((k) => {
                const p = state.players[k];
                if (!p) return null;
                return (
                  <th key={k} className="sticky top-0 z-10 min-w-24 border-b border-s border-border bg-card p-2 font-bold">
                    <div className="flex flex-col items-center gap-1">
                      <Avatar name={p.name} color={p.color} me={k === myKey} size={22} />
                      <span className="max-w-20 truncate">{k === myKey ? 'أنت' : p.name}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: state.totalQuestions }).map((_, qi) => {
              const q = state.questions[qi];
              const correctText = state.correctAnswers?.[qi];
              return (
                <tr key={qi} className="even:bg-muted/30">
                  <td className="sticky right-0 z-[1] max-w-36 border-b border-border bg-card p-2 font-bold text-muted-foreground" title={q?.prompt}>
                    <div className="flex items-center gap-1">
                      <span className="tabular-nums">{qi + 1}.</span>
                      <span>{QTYPE_LABEL[q?.type ?? 'riddle'].icon}</span>
                    </div>
                    {correctText && <div className="mt-0.5 truncate text-emerald-600 dark:text-emerald-400">✓ {correctText}</div>}
                  </td>
                  {rows.map((k) => {
                    const cell = table[k]?.[qi];
                    return (
                      <td key={k} className={`border-b border-s border-border p-2 text-center font-bold ${cell?.answered ? (cell.correct ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400') : 'text-muted-foreground'}`}>
                        {cellLabel(cell)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
