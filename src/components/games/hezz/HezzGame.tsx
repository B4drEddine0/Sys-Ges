import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Crown, Layers, Trophy, Volume2, VolumeX } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { legalCards, SUIT_LABEL, SUITS, type Card, type PublicState, type Suit } from './hezzLogic';
import { useHezzGame } from './useHezzGame';
import { CelebrationOverlay, HezzCard, Seat, colorFor, useFinishCelebrations, useSoundMuted } from './HezzParts';

interface Props {
  channel: any;
  isHost: boolean;
  myKey: string;
  playerKeys: string[];
  playerNames: string[];
  onLeave?: () => void;
}

const felt = 'linear-gradient(160deg, #0f4c3a 0%, #0a3528 100%)';

export function HezzGame({ channel, isHost, myKey, playerKeys, playerNames, onLeave }: Props) {
  const { state, myHand, actions } = useHezzGame({ channel, isHost, myKey, playerKeys, playerNames });
  const [muted, setMuted] = useSoundMuted();
  const { current, push } = useFinishCelebrations(muted);
  const seenFinished = useRef<Set<string>>(new Set());

  // Detect the "has cards -> zero cards" transition purely from synced public state, so
  // every client (not just the host) celebrates at the same moment, and a late joiner /
  // reconnect never replays celebrations for players who already finished earlier.
  useEffect(() => {
    if (!state) return;
    state.finishedOrder.forEach((key) => {
      if (seenFinished.current.has(key)) return;
      seenFinished.current.add(key);
      const p = state.players[key];
      if (p) push({ id: `${key}-${p.finishOrder}`, name: p.name, color: p.color });
    });
  }, [state?.finishedOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  // A fresh game (host restarts) clears the "already celebrated" memory so finishes in
  // the new game celebrate again.
  useEffect(() => {
    if (state?.phase === 'playing' && state.finishedOrder.length === 0) seenFinished.current.clear();
  }, [state?.phase, state?.finishedOrder.length]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto w-full max-w-3xl px-1 pb-6 text-foreground">
        <CelebrationOverlay item={current} />
        {!state ? (
          <div className="flex flex-col items-center gap-4 py-24 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            <p className="font-bold">Connecting to the table…</p>
          </div>
        ) : (
          <>
            {state.phase === 'lobby' && <Lobby state={state} isHost={isHost} myKey={myKey} actions={actions} onLeave={onLeave} />}
            {state.phase === 'playing' && (
              <Table state={state} myKey={myKey} myHand={myHand} actions={actions} muted={muted} setMuted={setMuted} />
            )}
            {state.phase === 'gameover' && <GameOver state={state} myKey={myKey} isHost={isHost} actions={actions} onLeave={onLeave} />}
          </>
        )}
      </div>
    </MotionConfig>
  );
}

const cardCls = 'rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60';

// ---------------------------------------------------------------- lobby

function Lobby({ state, isHost, myKey, actions, onLeave }: { state: PublicState; isHost: boolean; myKey: string; actions: ReturnType<typeof useHezzGame>['actions']; onLeave?: () => void }) {
  const [handSize, setHandSize] = useState<4 | 6>(4);
  const players = Object.values(state.players);

  return (
    <div className="space-y-5 pt-4 text-center">
      <div className="space-y-2">
        <motion.div initial={{ scale: 0.4, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.55 }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28%] bg-[#0f4c3a] text-3xl text-white shadow-lg">
          🃏
        </motion.div>
        <h2 className="text-4xl font-black">هز جوج</h2>
        <p className="text-muted-foreground">Hezz Jouj · empty your hand first — just don't be the last one holding cards</p>
      </div>

      <div className={`${cardCls} space-y-3`}>
        <p className="text-sm font-bold text-muted-foreground">Players ({players.length})</p>
        <div className="flex flex-wrap justify-center gap-4">
          {players.map((p, i) => (
            <motion.div key={p.key} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.06, type: 'spring' }} className="flex flex-col items-center gap-1">
              <span className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-extrabold text-white shadow-md" style={{ background: colorFor(p.color) }}>
                {p.name[0]?.toUpperCase()}
              </span>
              <span className="max-w-20 truncate text-sm font-bold">{p.key === myKey ? 'You' : p.name}</span>
              {p.key === 'host' && <Crown className="h-3.5 w-3.5 text-amber-500" />}
            </motion.div>
          ))}
        </div>
      </div>

      {isHost ? (
        <div className={`${cardCls} space-y-4 text-start`}>
          <div className="space-y-2">
            <p className="text-sm font-bold text-muted-foreground">Starting hand</p>
            <div className="grid grid-cols-2 gap-2">
              {[4, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setHandSize(n as 4 | 6)}
                  className={`h-12 rounded-2xl text-base font-extrabold transition-all active:scale-95 ${handSize === n ? 'bg-[#0f4c3a] text-white shadow-md' : 'bg-muted hover:bg-muted/70'}`}
                >
                  {n} cards
                </button>
              ))}
            </div>
          </div>
          <Button onClick={() => actions.start(handSize)} disabled={players.length < 2} className="h-14 w-full rounded-2xl bg-[#0f4c3a] text-lg font-black hover:bg-[#0c3c2e]">
            {players.length < 2 ? 'Need at least 2 players' : 'Deal & Start'}
          </Button>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-2 py-3 font-bold text-muted-foreground">
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:130ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:260ms]" />
          </span>
          Waiting for the host to deal
        </p>
      )}
      {onLeave && (
        <button onClick={onLeave} className="text-sm font-bold text-muted-foreground underline-offset-4 hover:underline">
          Leave room
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- table

function Table({
  state,
  myKey,
  myHand,
  actions,
  muted,
  setMuted,
}: {
  state: PublicState;
  myKey: string;
  myHand: Card[];
  actions: ReturnType<typeof useHezzGame>['actions'];
  muted: boolean;
  setMuted: (v: boolean) => void;
}) {
  const [suitPicker, setSuitPicker] = useState<string | null>(null); // cardId awaiting a suit choice
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const lastSeq = useRef(state.seq);

  useEffect(() => {
    if (state.seq !== lastSeq.current) {
      lastSeq.current = state.seq;
      setBusy(false);
    }
  }, [state.seq]);

  const me = state.players[myKey];
  const myTurn = state.order[state.turnIndex] === myKey && !me?.finished;
  const legal = useMemo(() => (myTurn ? legalCards(myHand, state) : []), [myTurn, myHand, state]);
  const canAct = myTurn && !busy;
  const hasPending = state.pendingPenalty > 0 || state.pendingSkips > 0;

  const others = state.order.filter((k) => k !== myKey).map((k) => state.players[k]).filter(Boolean);

  const act = (fn: () => void) => {
    if (!canAct) return;
    setBusy(true);
    fn();
    // Safety valve: if a reply never arrives (dropped message, host hiccup), don't leave
    // the UI stuck locked forever.
    setTimeout(() => setBusy(false), 4000);
  };

  const handleCardClick = (card: Card) => {
    if (!canAct || !legal.some((c) => c.id === card.id)) return;
    if (card.rank === 7) {
      setSuitPicker(card.id);
      return;
    }
    act(() => actions.play(card.id));
  };

  const pickSuit = (suit: Suit) => {
    if (!suitPicker) return;
    const cardId = suitPicker;
    setSuitPicker(null);
    act(() => actions.play(cardId, suit));
  };

  // The accept/draw button must stay visible during a pending chain even if the player
  // *could* stack instead — "may choose to accept... even when they have one available"
  // is explicit in the rules, so this can't be collapsed into "only show when stuck."
  const bottomLabel = !myTurn
    ? null
    : hasPending
      ? state.pendingPenalty > 0
        ? `Accept +${state.pendingPenalty} (or play a 2 to stack)`
        : `Accept skip ×${state.pendingSkips} (or play a 1 to stack)`
      : legal.length > 0
        ? null
        : 'Draw a card';

  // Drawing is never *required* to be the only way forward — a player holding a legal
  // card may still choose to pass and draw instead (keep that card hidden, wait for a
  // better one, etc). This is the same `draw()` action, just offered even when it isn't
  // the only option, via the draw pile itself and a small secondary link under the hand.
  const canVoluntaryDraw = myTurn && !hasPending && legal.length > 0 && !me?.finished;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {state.currentSuit && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#0f4c3a] px-3 py-1 text-sm font-bold text-white">
              {SUIT_LABEL[state.currentSuit].icon} {SUIT_LABEL[state.currentSuit].en}
            </span>
          )}
          {hasPending && (
            <motion.span initial={{ scale: 0.8 }} animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="rounded-full bg-rose-500 px-3 py-1 text-sm font-black text-white">
              {state.pendingPenalty > 0 ? `+${state.pendingPenalty} pending` : `${state.pendingSkips}× skip pending`}
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowLog((s) => !s)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" title="Game log">
            <Layers className="h-4 w-4" />
          </button>
          <button onClick={() => setMuted(!muted)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showLog && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-2xl bg-muted/60 px-3 text-xs text-muted-foreground">
            <div className="max-h-28 space-y-0.5 overflow-y-auto py-2">
              {[...state.log].reverse().map((l) => (
                <p key={l.id}>{l.text}</p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-[28px] p-4 shadow-xl" style={{ background: felt }}>
        <div className="mb-4 flex flex-wrap justify-center gap-4">
          {others.map((p) => (
            <Seat key={p.key} name={p.name} color={p.color} finished={p.finished} finishOrder={p.finishOrder} connected={p.connected} active={state.order[state.turnIndex] === p.key} handCount={p.handCount} />
          ))}
        </div>

        <div className="flex items-center justify-center gap-6 py-4">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              disabled={!canAct}
              onClick={() => act(() => actions.draw())}
              title={canAct ? 'Draw a card' : undefined}
              className={`rounded-lg transition-transform ${canAct ? 'cursor-pointer hover:-translate-y-1 active:translate-y-0' : 'cursor-default'}`}
            >
              <HezzCard faceDown size="md" />
            </button>
            <span className="text-xs font-bold text-white/70">{state.drawCount} left</span>
          </div>
          <AnimatePresence mode="popLayout">
            <motion.div key={state.discardTop?.id} initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
              <HezzCard card={state.discardTop ?? undefined} size="lg" />
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="pb-1 text-center text-sm font-bold text-white/80">
          {myTurn ? "Your turn!" : `${state.players[state.order[state.turnIndex]]?.name ?? '…'}'s turn`}
        </p>
      </div>

      <div className={`${cardCls} space-y-3`}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-muted-foreground">Your hand ({myHand.length})</p>
          {me?.finished && <span className="text-xs font-bold text-amber-600 dark:text-amber-400">You're finished — watching the rest of the table</span>}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {myHand.map((card) => (
            <HezzCard key={card.id} card={card} size="md" onClick={() => handleCardClick(card)} disabled={!canAct || !legal.some((c) => c.id === card.id)} />
          ))}
          {myHand.length === 0 && !me?.finished && <p className="py-6 text-sm text-muted-foreground">No cards yet…</p>}
        </div>
        {bottomLabel && (
          <Button onClick={() => act(() => actions.draw())} className="h-12 w-full rounded-2xl bg-[#0f4c3a] font-black text-white hover:bg-[#0c3c2e]">
            {bottomLabel}
          </Button>
        )}
        {canVoluntaryDraw && (
          <button onClick={() => act(() => actions.draw())} className="block w-full text-center text-xs font-bold text-muted-foreground underline-offset-4 hover:underline">
            Don't want to play any of these? Draw a card instead
          </button>
        )}
        {!myTurn && !me?.finished && (
          <p className="text-center text-xs font-bold text-muted-foreground">Waiting for {state.players[state.order[state.turnIndex]]?.name}…</p>
        )}
      </div>

      <Modal open={!!suitPicker} title="Choose a suit" description="The next play must match this suit." onClose={() => setSuitPicker(null)}>
        <div className="grid grid-cols-2 gap-3">
          {SUITS.map((s) => (
            <Button key={s} variant="secondary" className="h-16 gap-2 rounded-2xl text-lg" onClick={() => pickSuit(s)}>
              <span className="text-2xl">{SUIT_LABEL[s].icon}</span> {SUIT_LABEL[s].en}
            </Button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------- game over

function GameOver({ state, myKey, isHost, actions, onLeave }: { state: PublicState; myKey: string; isHost: boolean; actions: ReturnType<typeof useHezzGame>['actions']; onLeave?: () => void }) {
  const loser = state.loser ? state.players[state.loser] : null;
  const order = [...state.finishedOrder, ...(state.loser ? [state.loser] : [])];

  return (
    <div className="space-y-6 pt-4 text-center">
      <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.6 }}>
        <Trophy className="mx-auto h-14 w-14 text-amber-500" />
      </motion.div>
      <div className="space-y-1">
        <h2 className="text-3xl font-black">Game Over</h2>
        <p className="text-lg font-bold text-rose-500">
          {loser?.key === myKey ? "You're holding the cards — you lose! 😅" : `${loser?.name ?? '?'} is left holding the cards!`}
        </p>
      </div>

      <div className={`${cardCls} space-y-2`}>
        <p className="text-sm font-bold text-muted-foreground">Finishing order</p>
        {order.map((key, i) => {
          const p = state.players[key];
          const isLoser = key === state.loser;
          return (
            <motion.div key={key} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className={`flex items-center gap-3 rounded-2xl p-2.5 ${key === myKey ? 'bg-muted/60' : ''}`}>
              <span className={`w-7 text-center text-sm font-black tabular-nums ${isLoser ? 'text-rose-500' : 'text-muted-foreground'}`}>{isLoser ? '😅' : `#${i + 1}`}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white" style={{ background: colorFor(p.color) }}>
                {p.name[0]?.toUpperCase()}
              </span>
              <span className="flex-1 truncate font-extrabold">{key === myKey ? 'You' : p.name}</span>
              {!isLoser && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Finished</span>}
              {isLoser && <span className="text-xs font-bold text-rose-500">Loser</span>}
            </motion.div>
          );
        })}
      </div>

      <div className="grid gap-2">
        {isHost ? (
          <Button onClick={() => actions.playAgain(4)} className="h-14 rounded-2xl bg-[#0f4c3a] text-lg font-black text-white hover:bg-[#0c3c2e]">
            Deal a New Game
          </Button>
        ) : (
          <p className="flex items-center justify-center gap-2 py-2 text-sm font-bold text-muted-foreground">Waiting for the host</p>
        )}
        {onLeave && (
          <Button variant="secondary" onClick={onLeave} className="h-12 rounded-2xl font-extrabold">
            Back to Games
          </Button>
        )}
      </div>
    </div>
  );
}
