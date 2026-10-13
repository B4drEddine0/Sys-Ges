import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Crown, Flag, Trophy, Zap } from 'lucide-react';
import { Button } from '@/components/ui';
import { PLAYER_COLORS, RACE_TIME_CAP_MS } from './wobbleLogic';
import { useWobbleGame, type WobblePlayer } from './useWobbleGame';
import { WobbleCanvas } from './WobbleCanvas';

interface Props {
  channel: any;
  isHost: boolean;
  myKey: string;
  playerKeys: string[];
  playerNames: string[];
  onLeave?: () => void;
}

const purple = '#6d5efc';

function colorOf(p: WobblePlayer) {
  return PLAYER_COLORS[p.color % PLAYER_COLORS.length];
}

function Avatar({ p, me, size = 40 }: { p: WobblePlayer; me?: boolean; size?: number }) {
  const c = colorOf(p);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-white"
      style={{ width: size, height: size, background: c, fontSize: size * 0.42, boxShadow: me ? `0 0 0 3px rgb(var(--card)), 0 0 0 5px ${c}` : undefined, opacity: p.connected ? 1 : 0.45 }}
    >
      {p.name[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

export function WobbleGame({ channel, isHost, myKey, playerKeys, playerNames, onLeave }: Props) {
  const { state, level, getNow, getRemotePositions, getStunUntil, actions } = useWobbleGame({ channel, isHost, myKey, playerKeys, playerNames });

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto w-full max-w-3xl px-1 pb-6 text-foreground">
        {!state ? (
          <div className="flex flex-col items-center gap-4 py-24 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            <p className="font-bold">Connecting to the race…</p>
          </div>
        ) : (
          <>
            {state.phase === 'lobby' && <Lobby state={state} isHost={isHost} myKey={myKey} actions={actions} onLeave={onLeave} />}
            {state.phase === 'countdown' && state.raceStartAt && <Countdown raceStartAt={state.raceStartAt} getNow={getNow} />}
            {state.phase === 'racing' && state.raceStartAt && (
              <Racing state={state} level={level} myKey={myKey} getNow={getNow} getRemotePositions={getRemotePositions} getStunUntil={getStunUntil} actions={actions} />
            )}
            {state.phase === 'results' && <Results state={state} myKey={myKey} isHost={isHost} actions={actions} onLeave={onLeave} />}
          </>
        )}
      </div>
    </MotionConfig>
  );
}

const cardCls = 'rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60';

// ---------------------------------------------------------------- lobby

function Lobby({ state, isHost, myKey, actions, onLeave }: { state: ReturnType<typeof useWobbleGame>['state']; isHost: boolean; myKey: string; actions: ReturnType<typeof useWobbleGame>['actions']; onLeave?: () => void }) {
  if (!state) return null;
  const connected = state.players.filter((p) => p.connected);
  return (
    <div className="space-y-5 pt-4 text-center">
      <div className="space-y-2">
        <motion.div initial={{ scale: 0.4, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.55 }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28%] text-white shadow-lg" style={{ background: purple }}>
          <Zap className="h-10 w-10" />
        </motion.div>
        <h2 className="text-4xl font-black">Wobble Race</h2>
        <p className="text-muted-foreground">Run, jump, dodge the wrecking balls — first across the line wins the round</p>
      </div>

      <div className={`${cardCls} space-y-3`}>
        <p className="text-sm font-bold text-muted-foreground">Racers ({connected.length})</p>
        <div className="flex flex-wrap justify-center gap-4">
          {connected.map((p, i) => (
            <motion.div key={p.key} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.06, type: 'spring' }} className="flex flex-col items-center gap-1">
              <Avatar p={p} me={p.key === myKey} size={56} />
              <span className="max-w-20 truncate text-sm font-bold">{p.key === myKey ? 'You' : p.name}</span>
              {p.key === 'host' && <Crown className="h-3.5 w-3.5 text-amber-500" />}
            </motion.div>
          ))}
        </div>
      </div>

      {isHost ? (
        <Button onClick={actions.start} className="h-14 w-full rounded-2xl text-lg font-black" style={{ background: purple }}>
          Start Race
        </Button>
      ) : (
        <p className="flex items-center justify-center gap-2 py-3 font-bold text-muted-foreground">
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:130ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:260ms]" />
          </span>
          Waiting for the host to start
        </p>
      )}
      <p className="text-xs text-muted-foreground">Move: arrow keys / A·D · Jump: up / W / space — or the on-screen buttons on mobile</p>
      {onLeave && (
        <button onClick={onLeave} className="text-sm font-bold text-muted-foreground underline-offset-4 hover:underline">
          Leave room
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- countdown

function Countdown({ raceStartAt, getNow }: { raceStartAt: number; getNow: () => number }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    const tick = () => setN(Math.max(0, Math.ceil((raceStartAt - getNow()) / 1000)));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [raceStartAt, getNow]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <p className="text-lg font-bold text-muted-foreground">Get ready…</p>
      <div className="flex h-40 w-40 items-center justify-center">
        <AnimatePresence mode="popLayout">
          {n > 0 ? (
            <motion.div key={n} initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.25 }} className="text-8xl font-black tabular-nums" style={{ color: purple }}>
              {n}
            </motion.div>
          ) : (
            <motion.div key="go" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1.2, opacity: 1 }} transition={{ type: 'spring', bounce: 0.6 }} className="text-6xl font-black text-emerald-500">
              GO!
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="text-sm text-muted-foreground">First to the finish flag wins the round</p>
    </div>
  );
}

// ---------------------------------------------------------------- racing

function Racing({
  state,
  level,
  myKey,
  getNow,
  getRemotePositions,
  getStunUntil,
  actions,
}: {
  state: NonNullable<ReturnType<typeof useWobbleGame>['state']>;
  level: ReturnType<typeof useWobbleGame>['level'];
  myKey: string;
  getNow: () => number;
  getRemotePositions: ReturnType<typeof useWobbleGame>['getRemotePositions'];
  getStunUntil: ReturnType<typeof useWobbleGame>['getStunUntil'];
  actions: ReturnType<typeof useWobbleGame>['actions'];
}) {
  const [hud, setHud] = useState({ progress: 0, rank: 1, elapsedMs: 0 });
  const [done, setDone] = useState(false);
  const me = state.players.find((p) => p.key === myKey);
  const total = state.active.length;
  const secondsLeft = Math.max(0, Math.ceil((RACE_TIME_CAP_MS - hud.elapsedMs) / 1000));

  return (
    <div className="space-y-3">
      <div className={`${cardCls} flex items-center gap-4 py-3`}>
        <div className="flex-1">
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <motion.div className="h-full rounded-full" style={{ background: me ? colorOf(me) : purple }} animate={{ width: `${hud.progress * 100}%` }} transition={{ ease: 'linear', duration: 0.15 }} />
          </div>
        </div>
        <span className="shrink-0 text-sm font-black tabular-nums text-muted-foreground">
          #{hud.rank}/{total}
        </span>
        <span className={`shrink-0 text-sm font-black tabular-nums ${secondsLeft <= 10 ? 'text-rose-500' : 'text-muted-foreground'}`}>{secondsLeft}s</span>
      </div>

      <WobbleCanvas
        level={level}
        myKey={myKey}
        myColor={me?.color ?? 0}
        myName={me?.key === myKey ? 'You' : me?.name ?? 'You'}
        players={state.players}
        active={state.active}
        raceStartAt={state.raceStartAt!}
        getNow={getNow}
        getRemotePositions={getRemotePositions}
        getStunUntil={getStunUntil}
        sendPos={actions.sendPos}
        sendHit={actions.sendHit}
        onFinish={(ms) => {
          if (done) return;
          setDone(true);
          actions.reportFinish(ms);
        }}
        onHud={setHud}
      />

      {done && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${cardCls} flex items-center gap-3 text-center justify-center`}>
          <Flag className="h-5 w-5 text-emerald-500" />
          <p className="font-bold">
            Finished! Waiting for {state.active.length - Object.keys(state.finishes).length} more racer{state.active.length - Object.keys(state.finishes).length === 1 ? '' : 's'}…
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- results

function Results({
  state,
  myKey,
  isHost,
  actions,
  onLeave,
}: {
  state: NonNullable<ReturnType<typeof useWobbleGame>['state']>;
  myKey: string;
  isHost: boolean;
  actions: ReturnType<typeof useWobbleGame>['actions'];
  onLeave?: () => void;
}) {
  const ranked = useMemo(() => {
    const finishers = state.active
      .filter((k) => state.finishes[k])
      .sort((a, b) => state.finishes[a].rank - state.finishes[b].rank)
      .map((k) => state.players.find((p) => p.key === k)!)
      .filter(Boolean);
    const dnf = state.active
      .filter((k) => !state.finishes[k])
      .map((k) => state.players.find((p) => p.key === k)!)
      .filter(Boolean);
    return [...finishers, ...dnf];
  }, [state]);

  const totalRanked = useMemo(() => [...state.players].sort((a, b) => (state.scores[b.key] ?? 0) - (state.scores[a.key] ?? 0)), [state]);

  return (
    <div className="space-y-5 pt-2">
      <div className="space-y-1 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.6 }}>
          <Trophy className="mx-auto h-12 w-12 text-amber-500" />
        </motion.div>
        <h2 className="text-3xl font-black">Race {state.raceNum} Results</h2>
      </div>

      <div className={`${cardCls} space-y-2`}>
        {ranked.map((p, i) => {
          const finish = state.finishes[p.key];
          return (
            <motion.div key={p.key} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className={`flex items-center gap-3 rounded-2xl p-2.5 ${p.key === myKey ? 'bg-muted/60' : ''}`}>
              <span className="w-6 text-center text-lg font-black tabular-nums text-muted-foreground">{finish ? i + 1 : '—'}</span>
              <Avatar p={p} me={p.key === myKey} size={36} />
              <span className="flex-1 truncate font-extrabold">{p.key === myKey ? 'You' : p.name}</span>
              <span className="text-xs font-bold text-muted-foreground">{finish ? `${(finish.timeMs / 1000).toFixed(1)}s` : 'DNF'}</span>
            </motion.div>
          );
        })}
      </div>

      <div className={`${cardCls} space-y-2`}>
        <p className="text-sm font-bold text-muted-foreground">Overall score</p>
        {totalRanked.map((p, i) => (
          <div key={p.key} className="flex items-center gap-3">
            <span className="w-5 text-center text-sm font-black tabular-nums text-muted-foreground">{i + 1}</span>
            <Avatar p={p} me={p.key === myKey} size={28} />
            <span className="flex-1 truncate font-bold">{p.key === myKey ? 'You' : p.name}</span>
            <span className="text-lg font-black tabular-nums">{state.scores[p.key] ?? 0}</span>
          </div>
        ))}
      </div>

      {isHost ? (
        <Button onClick={actions.playAgain} className="h-14 w-full rounded-2xl text-lg font-black" style={{ background: purple }}>
          Race Again
        </Button>
      ) : (
        <p className="flex items-center justify-center gap-2 py-2 text-sm font-bold text-muted-foreground">Waiting for the host to start the next race</p>
      )}
      {onLeave && (
        <Button variant="secondary" onClick={onLeave} className="h-12 w-full rounded-2xl font-extrabold">
          Back to Games
        </Button>
      )}
    </div>
  );
}
