import { useEffect, useState } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { ArrowLeft, Target, Trophy } from 'lucide-react';
import { Button } from '@/components/ui';
import { QTYPE_LABEL, isMcqQuestion, type Difficulty, type QType } from './battleLogic';
import { useSoloBattle, type SoloSettings } from './useSoloBattle';
import { AnswerPanel, CountdownBar, ResultBadge, TypeBadge, BRAND } from './BrainBattleParts';

const ALL_TYPES = Object.keys(QTYPE_LABEL) as QType[];
const ALL_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
const cardCls = 'rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60';

export function SoloBattleGame({ onLeave }: { onLeave?: () => void }) {
  const { phase, round, settings, publicQuestion, lastResult, history, totalScore, correctCount, startedAt, actions } = useSoloBattle();

  return (
    <MotionConfig reducedMotion="user">
      <div dir="rtl" className="mx-auto w-full max-w-3xl px-1 pb-6 text-foreground">
        {phase === 'setup' && <Setup onStart={actions.start} onLeave={onLeave} />}
        {phase === 'question' && publicQuestion && (
          <QuestionPhase publicQuestion={publicQuestion} round={round} totalRounds={settings.rounds} timeLimitMs={settings.timeLimitMs} startedAt={startedAt} onSubmitMcq={(i) => actions.submit({ chosenIndex: i })} onSubmitText={(t) => actions.submit({ text: t })} />
        )}
        {phase === 'reveal' && lastResult && <RevealPhase result={lastResult} onNext={actions.continueNext} />}
        {phase === 'summary' && <Summary history={history} totalScore={totalScore} correctCount={correctCount} onRestart={actions.restart} onLeave={onLeave} />}
      </div>
    </MotionConfig>
  );
}

function Setup({ onStart, onLeave }: { onStart: (s: SoloSettings) => void; onLeave?: () => void }) {
  const [rounds, setRounds] = useState(10);
  const [seconds, setSeconds] = useState(25);
  const [types, setTypes] = useState<QType[]>(ALL_TYPES);
  const [difficulties, setDifficulties] = useState<Difficulty[]>(ALL_DIFFICULTIES);
  const toggle = <T,>(list: T[], setList: (v: T[]) => void, v: T) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="space-y-5 pt-4 text-center">
      {onLeave && (
        <button onClick={onLeave} className="flex items-center gap-1 text-sm font-bold text-muted-foreground hover:underline">
          <ArrowLeft className="h-4 w-4" /> رجوع
        </button>
      )}
      <div className="space-y-2">
        <motion.div initial={{ scale: 0.4, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.55 }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28%] text-3xl text-white shadow-lg" style={{ background: BRAND }}>
          🧠
        </motion.div>
        <h2 className="text-4xl font-black">تحدّي العقول — فردي</h2>
        <p className="text-muted-foreground">تدرّب على راحتك، ولا تخف من التكرار — نتجنّب الأسئلة التي سبق أن أجبت عنها</p>
      </div>

      <div className={`${cardCls} space-y-4 text-start`}>
        <div className="space-y-2">
          <p className="text-sm font-bold text-muted-foreground">عدد الأسئلة</p>
          <div className="grid grid-cols-3 gap-2">
            {[10, 15, 20, 25, 30, 40].map((n) => (
              <button key={n} onClick={() => setRounds(n)} className={`h-11 rounded-2xl text-sm font-extrabold transition-all active:scale-95 ${rounds === n ? 'text-white shadow-md' : 'bg-muted hover:bg-muted/70'}`} style={rounds === n ? { background: BRAND } : undefined}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-bold text-muted-foreground">الوقت لكل سؤال</p>
          <div className="grid grid-cols-3 gap-2">
            {[20, 25, 35].map((n) => (
              <button key={n} onClick={() => setSeconds(n)} className={`h-11 rounded-2xl text-sm font-extrabold transition-all active:scale-95 ${seconds === n ? 'text-white shadow-md' : 'bg-muted hover:bg-muted/70'}`} style={seconds === n ? { background: BRAND } : undefined}>
                {n} ثانية
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
        </div>
        <Button
          onClick={() => onStart({ rounds, timeLimitMs: seconds * 1000, types: types.length ? types : ALL_TYPES, difficulties: difficulties.length ? difficulties : ALL_DIFFICULTIES })}
          className="h-14 w-full rounded-2xl text-lg font-black text-white hover:opacity-90"
          style={{ background: BRAND }}
        >
          ابدأ
        </Button>
      </div>
    </div>
  );
}

function useTick(ms = 200) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

function QuestionPhase({
  publicQuestion,
  round,
  totalRounds,
  timeLimitMs,
  startedAt,
  onSubmitMcq,
  onSubmitText,
}: {
  publicQuestion: NonNullable<ReturnType<typeof useSoloBattle>['publicQuestion']>;
  round: number;
  totalRounds: number;
  timeLimitMs: number;
  startedAt: number | null;
  onSubmitMcq: (i: number) => void;
  onSubmitText: (t: string) => void;
}) {
  useTick(200);
  const now = Date.now();
  const elapsed = startedAt ? now - startedAt : 0;
  const endsAt = (startedAt ?? now) + timeLimitMs;

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-bold text-muted-foreground">
          السؤال {round} / {totalRounds}
        </p>
        <TypeBadge type={publicQuestion.type} difficulty={publicQuestion.difficulty} />
      </div>
      <CountdownBar now={now} endsAt={endsAt} totalMs={timeLimitMs} />
      <div className={cardCls}>
        <p className="mb-4 text-center text-2xl font-black leading-relaxed">{publicQuestion.prompt}</p>
        <AnswerPanel question={publicQuestion} elapsedMs={elapsed} disabled={false} onSubmitMcq={onSubmitMcq} onSubmitText={onSubmitText} />
      </div>
    </div>
  );
}

function RevealPhase({ result, onNext }: { result: NonNullable<ReturnType<typeof useSoloBattle>['lastResult']>; onNext: () => void }) {
  const q = result.question;
  const correctText = isMcqQuestion(q) ? q.options[q.correctIndex] : q.answer;
  return (
    <div className="space-y-5 pt-6 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.6 }}>
        <ResultBadge correct={result.correct} />
      </motion.div>
      <p className="text-2xl font-black">{result.correct ? 'إجابة صحيحة! 🎉' : 'للأسف، إجابة خاطئة'}</p>
      <div className={`${cardCls} space-y-2`}>
        <p className="text-sm text-muted-foreground">{q.prompt}</p>
        <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{correctText}</p>
        {q.explanation && <p className="text-sm text-muted-foreground">{q.explanation}</p>}
        {!result.correct && result.display && <p className="text-xs text-muted-foreground">إجابتك: {result.display}</p>}
        <p className="pt-2 text-lg font-black" style={{ color: result.points > 0 ? '#10b981' : undefined }}>
          {result.points > 0 ? `+${result.points} نقطة` : '0 نقطة'}
        </p>
      </div>
      <Button onClick={onNext} className="h-13 w-full rounded-2xl text-lg font-black text-white" style={{ background: BRAND }}>
        التالي
      </Button>
    </div>
  );
}

function Summary({
  history,
  totalScore,
  correctCount,
  onRestart,
  onLeave,
}: {
  history: ReturnType<typeof useSoloBattle>['history'];
  totalScore: number;
  correctCount: number;
  onRestart: () => void;
  onLeave?: () => void;
}) {
  const accuracy = history.length ? Math.round((correctCount / history.length) * 100) : 0;
  return (
    <div className="space-y-6 pt-10 text-center">
      <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.6 }}>
        <Trophy className="mx-auto h-14 w-14 text-amber-500" />
      </motion.div>
      <h2 className="text-3xl font-black">انتهت الجلسة!</h2>
      <div className="grid grid-cols-3 gap-2">
        <div className={`${cardCls} py-4`}>
          <p className="text-2xl font-black">{totalScore}</p>
          <p className="text-xs text-muted-foreground">النقاط</p>
        </div>
        <div className={`${cardCls} py-4`}>
          <p className="text-2xl font-black">
            {correctCount}/{history.length}
          </p>
          <p className="text-xs text-muted-foreground">إجابات صحيحة</p>
        </div>
        <div className={`${cardCls} flex flex-col items-center py-4`}>
          <Target className="mb-1 h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-black">{accuracy}%</p>
          <p className="text-xs text-muted-foreground">الدقة</p>
        </div>
      </div>
      <div className="grid gap-2">
        <Button onClick={onRestart} className="h-14 rounded-2xl text-lg font-black text-white" style={{ background: BRAND }}>
          تحدٍ جديد
        </Button>
        {onLeave && (
          <Button variant="secondary" onClick={onLeave} className="h-12 rounded-2xl font-extrabold">
            العودة إلى الألعاب
          </Button>
        )}
      </div>
    </div>
  );
}
