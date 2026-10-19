// Hezz Jouj / Jbben Grre3 — pure game engine.
//
// No React, no networking, no randomness without an injected RNG — everything here is a
// plain function of its inputs, so it's fully unit-testable in isolation (see
// hezzLogic.test.ts) and reusable by whichever layer ends up being authoritative (today:
// the room host's browser tab, same trust model every other online game in this app
// uses — see useHezzGame.ts for the privacy split).
//
// -------------------------------------------------------------------------------------
// Deck: a traditional 40-card Moroccan Ronda deck — four suits, ranks 1–7 plus three
// face cards (10/11/12), no 8s or 9s. Kept as plain data (RANKS/SUITS) rather than
// hard-coded elsewhere, so the deck/rules stay easy to adjust later as the brief asks.

export const SUITS = ['dhab', 'kas', 'sif', 'asa'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;
export type Rank = (typeof RANKS)[number];

export const SUIT_LABEL: Record<Suit, { ar: string; en: string; icon: string }> = {
  dhab: { ar: 'دهب', en: 'Gold', icon: '🪙' },
  kas: { ar: 'كاس', en: 'Cups', icon: '🏆' },
  sif: { ar: 'سيف', en: 'Swords', icon: '⚔️' },
  asa: { ar: 'عصا', en: 'Clubs', icon: '🪵' },
};

export const RANK_LABEL: Record<Rank, string> = {
  1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 10: 'J', 11: 'C', 12: 'R',
};

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

// Special ranks, kept as named constants (not magic numbers) so the rules below read
// clearly and stay easy to retune.
const PENALTY_RANK: Rank = 2;
const SKIP_RANK: Rank = 1;
const WILD_RANK: Rank = 7;
const PENALTY_AMOUNT = 2;

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${suit}-${rank}`, suit, rank });
    }
  }
  return deck;
}

export type Rng = () => number; // [0, 1)

export function defaultRng(): Rng {
  const buf = new Uint32Array(1);
  return () => {
    crypto.getRandomValues(buf);
    return buf[0] / 0xffffffff;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------- state

export type Phase = 'lobby' | 'playing' | 'gameover';

export interface PlayerMeta {
  key: string;
  name: string;
  color: number;
  connected: boolean;
  finished: boolean;
  finishOrder: number | null; // 1-based, null until finished
  handCount: number;
}

export interface LogEntry {
  id: string;
  text: string;
}

/** Everything that's safe to broadcast to every player — no card contents, only counts. */
export interface PublicState {
  phase: Phase;
  order: string[]; // fixed seat order for the whole game
  turnIndex: number; // index into `order`
  players: Record<string, PlayerMeta>;
  discardTop: Card | null;
  drawCount: number;
  currentSuit: Suit | null;
  pendingPenalty: number; // accumulated draw-two chain
  pendingSkips: number; // accumulated skip-one chain
  finishedOrder: string[];
  loser: string | null;
  log: LogEntry[];
  seq: number; // bumped on every change — lets clients dedupe/ignore stale snapshots
}

/** Host-only: the full state including private hands and the real draw pile contents. */
export interface EngineState {
  public: PublicState;
  hands: Record<string, Card[]>;
  drawPile: Card[];
  discardPile: Card[]; // full discard history, top = last
}

/** The table before anyone has dealt a game — no engine/hands exist yet, just the room. */
export function emptyLobbyState(): PublicState {
  return {
    phase: 'lobby',
    order: [],
    turnIndex: 0,
    players: {},
    discardTop: null,
    drawCount: 0,
    currentSuit: null,
    pendingPenalty: 0,
    pendingSkips: 0,
    finishedOrder: [],
    loser: null,
    log: [],
    seq: 0,
  };
}

const LOG_LIMIT = 30;
function pushLog(state: PublicState, text: string) {
  state.log = [...state.log, { id: `${state.seq}-${Math.random().toString(36).slice(2, 7)}`, text }].slice(-LOG_LIMIT);
}

// ---------------------------------------------------------------- setup

export interface StartOptions {
  playerKeys: string[]; // seat order
  playerNames: Record<string, string>;
  playerColors: Record<string, number>;
  handSize: 4 | 6;
  rng?: Rng;
}

/**
 * Deals a fresh game. The starting discard card is guaranteed non-special (not a 1, 2 or
 * 7) per the brief — the shuffled deck is scanned for the first such card after dealing
 * hands, which is pulled out as the starter; everything else becomes the draw pile.
 */
export function startGame({ playerKeys, playerNames, playerColors, handSize, rng = defaultRng() }: StartOptions): EngineState {
  if (playerKeys.length < 2) throw new Error('Hezz Jouj needs at least 2 players.');
  const deck = shuffle(createDeck(), rng);

  const hands: Record<string, Card[]> = {};
  let cursor = 0;
  playerKeys.forEach((key) => {
    hands[key] = deck.slice(cursor, cursor + handSize);
    cursor += handSize;
  });

  const rest = deck.slice(cursor);
  const starterIdx = rest.findIndex((c) => c.rank !== PENALTY_RANK && c.rank !== SKIP_RANK && c.rank !== WILD_RANK);
  // Every rank group has a non-special card in a 40-card deck, so this should always be
  // found — the fallback just avoids a hard crash in a hypothetically trimmed deck.
  const starter = starterIdx >= 0 ? rest[starterIdx] : rest[0];
  const drawPile = rest.filter((c) => c.id !== starter.id);

  const players: Record<string, PlayerMeta> = {};
  playerKeys.forEach((key, i) => {
    players[key] = {
      key,
      name: playerNames[key] ?? `Player ${i + 1}`,
      color: playerColors[key] ?? i,
      connected: true,
      finished: false,
      finishOrder: null,
      handCount: hands[key].length,
    };
  });

  const pub: PublicState = {
    phase: 'playing',
    order: [...playerKeys],
    turnIndex: 0,
    players,
    discardTop: starter,
    drawCount: drawPile.length,
    currentSuit: starter.suit,
    pendingPenalty: 0,
    pendingSkips: 0,
    finishedOrder: [],
    loser: null,
    log: [],
    seq: 0,
  };
  pushLog(pub, `Game started — ${handSize} cards each.`);

  return { public: pub, hands, drawPile, discardPile: [starter] };
}

// ---------------------------------------------------------------- helpers

function activeCount(pub: PublicState): number {
  return pub.order.filter((k) => !pub.players[k].finished).length;
}

/** Steps the turn pointer forward by `steps` *active* players, wrapping and skipping anyone finished. */
function advanceTurn(pub: PublicState, steps: number) {
  if (activeCount(pub) === 0) return;
  let i = pub.turnIndex;
  let left = steps;
  while (left > 0) {
    i = (i + 1) % pub.order.length;
    if (!pub.players[pub.order[i]].finished) left--;
  }
  pub.turnIndex = i;
}

function currentPlayer(pub: PublicState): string {
  return pub.order[pub.turnIndex];
}

/** Refills the draw pile from the discard history when it runs dry, keeping the current top card on the table. */
function ensureDrawPile(state: EngineState, rng: Rng) {
  if (state.drawPile.length > 0) return;
  if (state.discardPile.length <= 1) return; // nothing to recycle yet
  const top = state.discardPile[state.discardPile.length - 1];
  const rest = state.discardPile.slice(0, -1);
  state.drawPile = shuffle(rest, rng);
  state.discardPile = [top];
  pushLog(state.public, 'Draw pile recycled from the discard.');
}

function drawOne(state: EngineState, rng: Rng): Card | null {
  ensureDrawPile(state, rng);
  const card = state.drawPile.pop();
  state.public.drawCount = state.drawPile.length;
  return card ?? null;
}

function finishIfEmpty(state: EngineState, key: string) {
  if (state.hands[key].length > 0) return;
  const pub = state.public;
  if (pub.players[key].finished) return; // never double-finish
  pub.players[key].finished = true;
  pub.players[key].finishOrder = pub.finishedOrder.length + 1;
  pub.finishedOrder = [...pub.finishedOrder, key];
  pushLog(pub, `${pub.players[key].name} finished! (#${pub.players[key].finishOrder})`);

  if (activeCount(pub) === 1) {
    const loser = pub.order.find((k) => !pub.players[k].finished)!;
    pub.loser = loser;
    pub.phase = 'gameover';
    pushLog(pub, `${pub.players[loser].name} is left holding cards — loser!`);
  }
}

export function canPlay(card: Card, pub: PublicState): boolean {
  if (pub.pendingPenalty > 0) return card.rank === PENALTY_RANK;
  if (pub.pendingSkips > 0) return card.rank === SKIP_RANK;
  if (!pub.discardTop) return true;
  return card.rank === pub.discardTop.rank || card.suit === pub.currentSuit;
}

export function legalCards(hand: Card[], pub: PublicState): Card[] {
  return hand.filter((c) => canPlay(c, pub));
}

// ---------------------------------------------------------------- actions

export type Action =
  | { type: 'play'; player: string; cardId: string; chosenSuit?: Suit }
  | { type: 'draw'; player: string };

export interface ApplyResult {
  state: EngineState;
  ok: boolean;
  error?: string;
}

/**
 * Applies one action and returns a brand-new EngineState (never mutates the input), so
 * callers (and tests) can always compare before/after cleanly. `rng` is injectable for
 * deterministic tests; real play uses the crypto-backed default.
 */
export function applyAction(prev: EngineState, action: Action, rng: Rng = defaultRng()): ApplyResult {
  const state: EngineState = {
    public: { ...prev.public, players: { ...prev.public.players } },
    hands: { ...prev.hands },
    drawPile: [...prev.drawPile],
    discardPile: [...prev.discardPile],
  };
  const pub = state.public;

  if (pub.phase !== 'playing') return { state: prev, ok: false, error: 'Game is not in progress.' };
  if (action.player !== currentPlayer(pub)) return { state: prev, ok: false, error: 'Not your turn.' };
  if (pub.players[action.player]?.finished) return { state: prev, ok: false, error: 'You already finished.' };

  if (action.type === 'draw') {
    return applyDraw(state, action.player, rng);
  }
  return applyPlay(state, action.player, action.cardId, action.chosenSuit, rng);
}

function applyDraw(state: EngineState, player: string, rng: Rng): ApplyResult {
  const pub = state.public;

  if (pub.pendingPenalty > 0) {
    const amount = pub.pendingPenalty;
    const drawn: Card[] = [];
    for (let i = 0; i < amount; i++) {
      const c = drawOne(state, rng);
      if (c) drawn.push(c);
    }
    state.hands[player] = [...state.hands[player], ...drawn];
    pub.players[player].handCount = state.hands[player].length;
    pub.pendingPenalty = 0;
    pushLog(pub, `${pub.players[player].name} accepted and drew ${drawn.length}.`);
    advanceTurn(pub, 1);
    pub.seq++;
    return { state, ok: true };
  }

  if (pub.pendingSkips > 0) {
    const n = pub.pendingSkips;
    pub.pendingSkips = 0;
    pushLog(pub, `${pub.players[player].name} accepted the skip (${n}).`);
    advanceTurn(pub, n);
    pub.seq++;
    return { state, ok: true };
  }

  const hand = state.hands[player];
  if (legalCards(hand, pub).length > 0) {
    return { state: state, ok: false, error: 'You have a legal play — you cannot draw.' };
  }
  const card = drawOne(state, rng);
  if (card) {
    state.hands[player] = [...hand, card];
    pub.players[player].handCount = state.hands[player].length;
  }
  pushLog(pub, `${pub.players[player].name} drew a card.`);
  advanceTurn(pub, 1);
  pub.seq++;
  return { state, ok: true };
}

function applyPlay(state: EngineState, player: string, cardId: string, chosenSuit: Suit | undefined, rng: Rng): ApplyResult {
  const pub = state.public;
  const hand = state.hands[player];
  const card = hand.find((c) => c.id === cardId);
  if (!card) return { state, ok: false, error: 'Card not in hand.' };
  if (!canPlay(card, pub)) return { state, ok: false, error: 'That card is not legal right now.' };
  if (card.rank === WILD_RANK && !chosenSuit) return { state, ok: false, error: 'Choose a suit for the 7.' };

  state.hands[player] = hand.filter((c) => c.id !== cardId);
  pub.players[player].handCount = state.hands[player].length;
  state.discardPile = [...state.discardPile, card];
  pub.discardTop = card;

  if (card.rank === WILD_RANK) {
    pub.currentSuit = chosenSuit!;
    pushLog(pub, `${pub.players[player].name} played 7 and chose ${SUIT_LABEL[chosenSuit!].en}.`);
  } else {
    pub.currentSuit = card.suit;
  }

  if (card.rank === PENALTY_RANK) {
    pub.pendingPenalty += PENALTY_AMOUNT;
    pushLog(pub, `${pub.players[player].name} played a 2 (+${PENALTY_AMOUNT}, total ${pub.pendingPenalty}).`);
  } else if (card.rank === SKIP_RANK) {
    pub.pendingSkips += 1;
    pushLog(pub, `${pub.players[player].name} played a 1 (skip chain: ${pub.pendingSkips}).`);
  } else if (card.rank !== WILD_RANK) {
    pushLog(pub, `${pub.players[player].name} played ${RANK_LABEL[card.rank]} of ${SUIT_LABEL[card.suit].en}.`);
  }

  finishIfEmpty(state, player);
  pub.seq++;

  if (pub.phase === 'playing') advanceTurn(pub, 1);
  return { state, ok: true };
}
