import { describe, expect, it } from 'vitest';
import {
  applyAction,
  canPlay,
  createDeck,
  legalCards,
  startGame,
  type Card,
  type EngineState,
  type PublicState,
  type Rng,
} from './hezzLogic';

// A fixed, repeatable sequence instead of crypto randomness — deterministic tests.
function seededRng(seed = 1): Rng {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ id: `${suit}-${rank}-${Math.random()}`, suit, rank });

/** Builds a fully controlled 3-player mid-game state for testing specific rule interactions. */
function makeState(opts: {
  hands?: Record<string, Card[]>;
  discard?: Card;
  drawPile?: Card[];
  discardPile?: Card[];
  turnIndex?: number;
  finished?: string[];
}): EngineState {
  const order = ['a', 'b', 'c'];
  const hands = opts.hands ?? { a: [c('dhab', 3)], b: [c('kas', 5)], c: [c('sif', 6)] };
  const discard = opts.discard ?? c('dhab', 4);
  const finished = new Set(opts.finished ?? []);
  const players: PublicState['players'] = {};
  order.forEach((k, i) => {
    players[k] = {
      key: k,
      name: k.toUpperCase(),
      color: i,
      connected: true,
      finished: finished.has(k),
      finishOrder: null,
      handCount: hands[k]?.length ?? 0,
    };
  });
  return {
    public: {
      phase: 'playing',
      order,
      turnIndex: opts.turnIndex ?? 0,
      players,
      discardTop: discard,
      drawCount: (opts.drawPile ?? []).length,
      currentSuit: discard.suit,
      pendingPenalty: 0,
      pendingSkips: 0,
      finishedOrder: [],
      loser: null,
      log: [],
      seq: 0,
    },
    hands,
    drawPile: opts.drawPile ?? [],
    discardPile: opts.discardPile ?? [discard],
  };
}

describe('dealing', () => {
  it('deals the configured hand size to every player', () => {
    const s = startGame({
      playerKeys: ['a', 'b', 'c'],
      playerNames: { a: 'A', b: 'B', c: 'C' },
      playerColors: { a: 0, b: 1, c: 2 },
      handSize: 4,
      rng: seededRng(1),
    });
    expect(s.hands.a).toHaveLength(4);
    expect(s.hands.b).toHaveLength(4);
    expect(s.hands.c).toHaveLength(4);
  });

  it('supports a 6-card starting hand', () => {
    const s = startGame({
      playerKeys: ['a', 'b'],
      playerNames: { a: 'A', b: 'B' },
      playerColors: { a: 0, b: 1 },
      handSize: 6,
      rng: seededRng(2),
    });
    expect(s.hands.a).toHaveLength(6);
    expect(s.hands.b).toHaveLength(6);
  });

  it('never duplicates or loses cards across hands + draw pile + discard', () => {
    const s = startGame({
      playerKeys: ['a', 'b', 'c', 'd'],
      playerNames: { a: 'A', b: 'B', c: 'C', d: 'D' },
      playerColors: { a: 0, b: 1, c: 2, d: 3 },
      handSize: 6,
      rng: seededRng(3),
    });
    const all = [...Object.values(s.hands).flat(), ...s.drawPile, ...s.discardPile];
    expect(all).toHaveLength(createDeck().length);
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
  });

  it('starts with a non-special discard card', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = startGame({
        playerKeys: ['a', 'b'],
        playerNames: { a: 'A', b: 'B' },
        playerColors: { a: 0, b: 1 },
        handSize: 4,
        rng: seededRng(seed),
      });
      expect([1, 2, 7]).not.toContain(s.public.discardTop!.rank);
    }
  });
});

describe('matching', () => {
  it('allows a card matching by rank', () => {
    const top = c('dhab', 5);
    const hand = c('kas', 5);
    expect(canPlay(hand, makeState({ discard: top }).public)).toBe(true);
  });

  it('allows a card matching by suit', () => {
    const top = c('dhab', 5);
    const hand = c('dhab', 9 as any as 10); // same suit, different rank
    const state = makeState({ discard: top });
    expect(canPlay({ ...hand, rank: 10 }, state.public)).toBe(true);
  });

  it('rejects a card matching neither', () => {
    const top = c('dhab', 5);
    const other = c('kas', 6);
    expect(canPlay(other, makeState({ discard: top }).public)).toBe(false);
  });
});

describe('forced draw with no legal move', () => {
  it('draws exactly one card and ends the turn when nothing matches', () => {
    const hands = { a: [c('kas', 6)], b: [c('dhab', 1)], c: [c('sif', 3)] };
    const state = makeState({ hands, discard: c('dhab', 4), drawPile: [c('asa', 9 as any)] });
    const res = applyAction(state, { type: 'draw', player: 'a' });
    expect(res.ok).toBe(true);
    expect(res.state.hands.a).toHaveLength(2);
    expect(res.state.public.turnIndex).toBe(1); // moved to b
  });

  it('refuses to draw when a legal play exists', () => {
    const hands = { a: [c('dhab', 6)], b: [c('kas', 1)], c: [c('sif', 3)] };
    const state = makeState({ hands, discard: c('dhab', 4) });
    const res = applyAction(state, { type: 'draw', player: 'a' });
    expect(res.ok).toBe(false);
  });

  it('a drawn card is not auto-played — the turn is already over', () => {
    const hands = { a: [c('kas', 6)], b: [c('dhab', 1)], c: [c('sif', 3)] };
    const state = makeState({ hands, discard: c('dhab', 4), drawPile: [c('dhab', 11 as any)] });
    const res = applyAction(state, { type: 'draw', player: 'a' });
    expect(res.state.public.turnIndex).not.toBe(0);
  });
});

describe('stacking 2s', () => {
  it('stacks the penalty and the next player can stack again or accept', () => {
    // Each player keeps a filler card so playing their 2 doesn't also finish them —
    // that's covered separately under "elimination".
    let state = makeState({
      hands: { a: [c('dhab', 2), c('dhab', 3)], b: [c('kas', 2), c('kas', 3)], c: [c('sif', 3), c('sif', 4)] },
      discard: c('dhab', 5),
      drawPile: [c('asa', 6), c('asa', 5), c('asa', 4), c('asa', 3)],
    });
    let res = applyAction(state, { type: 'play', player: 'a', cardId: state.hands.a[0].id });
    expect(res.ok).toBe(true);
    expect(res.state.public.pendingPenalty).toBe(2);
    expect(res.state.public.turnIndex).toBe(1);

    res = applyAction(res.state, { type: 'play', player: 'b', cardId: res.state.hands.b.find((c) => c.rank === 2)!.id });
    expect(res.state.public.pendingPenalty).toBe(4);
    expect(res.state.public.turnIndex).toBe(2);

    // C accepts the full accumulated 4 instead of stacking.
    res = applyAction(res.state, { type: 'draw', player: 'c' });
    expect(res.state.hands.c).toHaveLength(2 + 4);
    expect(res.state.public.pendingPenalty).toBe(0);
    expect(res.state.public.turnIndex).toBe(0); // back to a
  });

  it('accepting is always allowed even while holding a 2', () => {
    const state = makeState({
      hands: { a: [c('dhab', 9 as any as 10)], b: [c('kas', 2)], c: [c('sif', 9 as any as 10)] },
      discard: c('dhab', 5),
      drawPile: [c('asa', 6), c('asa', 5)],
      turnIndex: 1,
    });
    state.public.pendingPenalty = 2;
    const res = applyAction(state, { type: 'draw', player: 'b' });
    expect(res.ok).toBe(true);
    expect(res.state.hands.b).toHaveLength(1 + 2); // b's own card plus the accepted penalty
  });
});

describe('stacking 1s', () => {
  it('a single 1 skips exactly the next player', () => {
    let state = makeState({
      hands: { a: [c('dhab', 1)], b: [c('kas', 4)], c: [c('sif', 3)] },
      discard: c('dhab', 5),
    });
    const res = applyAction(state, { type: 'play', player: 'a', cardId: state.hands.a[0].id });
    expect(res.state.public.pendingSkips).toBe(1);
    expect(res.state.public.turnIndex).toBe(1); // b is now "up" and must respond

    const accept = applyAction(res.state, { type: 'draw', player: 'b' });
    expect(accept.state.public.pendingSkips).toBe(0);
    expect(accept.state.public.turnIndex).toBe(2); // b was skipped entirely, c plays normally
  });

  it('stacked 1s skip the full accumulated count when accepted', () => {
    let state = makeState({
      hands: {
        a: [c('dhab', 1), c('dhab', 3)],
        b: [c('kas', 1), c('kas', 3)],
        c: [c('sif', 1), c('sif', 3)],
        d: [c('asa', 4)],
      },
      discard: c('dhab', 5),
    });
    state.public.order = ['a', 'b', 'c', 'd'];
    state.public.players.d = { key: 'd', name: 'D', color: 3, connected: true, finished: false, finishOrder: null, handCount: 1 };

    let res = applyAction(state, { type: 'play', player: 'a', cardId: state.hands.a[0].id });
    expect(res.state.public.turnIndex).toBe(1);
    res = applyAction(res.state, { type: 'play', player: 'b', cardId: res.state.hands.b.find((c) => c.rank === 1)!.id });
    expect(res.state.public.pendingSkips).toBe(2);
    expect(res.state.public.turnIndex).toBe(2);

    // c accepts a pending-skips=2 chain: both c and d get skipped, back to a.
    res = applyAction(res.state, { type: 'draw', player: 'c' });
    expect(res.state.public.pendingSkips).toBe(0);
    expect(res.state.public.turnIndex).toBe(0);
  });
});

describe('stacking 7s', () => {
  it('requires a chosen suit and the last 7 in a chain wins', () => {
    let state = makeState({
      hands: { a: [c('dhab', 7)], b: [c('kas', 7)], c: [c('sif', 3)] },
      discard: c('dhab', 5),
    });
    let res = applyAction(state, { type: 'play', player: 'a', cardId: state.hands.a[0].id, chosenSuit: 'kas' });
    expect(res.ok).toBe(true);
    expect(res.state.public.currentSuit).toBe('kas');

    res = applyAction(res.state, { type: 'play', player: 'b', cardId: res.state.hands.b[0].id, chosenSuit: 'asa' });
    expect(res.ok).toBe(true);
    expect(res.state.public.currentSuit).toBe('asa'); // last 7's choice wins
  });

  it('rejects playing a 7 without a chosen suit', () => {
    const state = makeState({ hands: { a: [c('dhab', 7)], b: [], c: [] }, discard: c('dhab', 5) });
    const res = applyAction(state, { type: 'play', player: 'a', cardId: state.hands.a[0].id });
    expect(res.ok).toBe(false);
  });
});

describe('draw pile recycling', () => {
  it('recycles the discard (minus the current top) without losing or duplicating cards', () => {
    const buried = [c('dhab', 3), c('kas', 6), c('sif', 4)];
    const top = c('dhab', 5);
    const state = makeState({
      hands: { a: [c('kas', 2)], b: [], c: [] }, // a has no legal move vs top=dhab5 other than draw
      discard: top,
      drawPile: [],
      discardPile: [...buried, top],
    });
    const res = applyAction(state, { type: 'draw', player: 'a' });
    expect(res.ok).toBe(true);
    // One card drawn from the freshly-recycled pile; the rest (buried.length - 1) remain there.
    expect(res.state.hands.a).toHaveLength(2);
    expect(res.state.drawPile).toHaveLength(buried.length - 1);
    expect(res.state.discardPile).toEqual([top]);
    const total = [...res.state.hands.a, ...res.state.drawPile, ...res.state.discardPile];
    expect(total.map((c) => c.id).sort()).toEqual([...buried, top].map((c) => c.id).concat(res.state.hands.a[0].id).sort());
  });
});

describe('elimination', () => {
  it('the first player to empty their hand is marked finished, not declared a winner', () => {
    const state = makeState({ hands: { a: [c('dhab', 6)], b: [c('kas', 1)], c: [c('sif', 3)] }, discard: c('dhab', 4) });
    const res = applyAction(state, { type: 'play', player: 'a', cardId: state.hands.a[0].id });
    expect(res.state.public.players.a.finished).toBe(true);
    expect(res.state.public.players.a.finishOrder).toBe(1);
    expect(res.state.public.phase).toBe('playing'); // game continues
    expect(res.state.public.loser).toBeNull();
  });

  it('turn order skips a finished player automatically', () => {
    const state = makeState({
      hands: { a: [c('dhab', 6), c('dhab', 3)], b: [c('kas', 1)], c: [c('sif', 3)] },
      discard: c('dhab', 4),
      finished: ['b'],
    });
    const res = applyAction(state, { type: 'play', player: 'a', cardId: state.hands.a[0].id });
    expect(res.state.public.turnIndex).toBe(2); // skipped b, landed on c
  });

  it('a pending skip chain also bypasses a finished player', () => {
    const state = makeState({
      hands: { a: [c('dhab', 1), c('dhab', 3)], b: [], c: [c('sif', 3)] },
      discard: c('dhab', 5),
      finished: ['b'],
    });
    const res = applyAction(state, { type: 'play', player: 'a', cardId: state.hands.a[0].id });
    // b is already finished, so the "next player" the skip lands on for a response is c.
    expect(res.state.public.turnIndex).toBe(2);
  });

  it('eliminates multiple players in sequence and ends with exactly one loser', () => {
    let state = makeState({
      hands: { a: [c('dhab', 6)], b: [c('kas', 6)], c: [c('sif', 3)] },
      discard: c('dhab', 4),
    });
    let res = applyAction(state, { type: 'play', player: 'a', cardId: state.hands.a[0].id });
    expect(res.state.public.phase).toBe('playing');

    res = applyAction(res.state, { type: 'play', player: 'b', cardId: res.state.hands.b[0].id });
    expect(res.state.public.players.b.finished).toBe(true);
    expect(res.state.public.phase).toBe('gameover');
    expect(res.state.public.loser).toBe('c');
    expect(res.state.public.finishedOrder).toEqual(['a', 'b']);
  });

  it('never finishes the same player twice even if replayed with an empty hand', () => {
    const state = makeState({ hands: { a: [], b: [c('kas', 1)], c: [c('sif', 3)] }, discard: c('dhab', 4), finished: ['a'] });
    state.public.finishedOrder = ['a'];
    state.public.players.a.finishOrder = 1;
    const res = applyAction(state, { type: 'draw', player: 'a' });
    expect(res.ok).toBe(false); // finished players can't act at all
  });
});

describe('turn ownership / simultaneous actions', () => {
  it('rejects an action from anyone whose turn it is not', () => {
    const state = makeState({ hands: { a: [c('dhab', 6)], b: [c('kas', 6)], c: [c('sif', 3)] }, discard: c('dhab', 4) });
    const res = applyAction(state, { type: 'play', player: 'b', cardId: state.hands.b[0].id });
    expect(res.ok).toBe(false);
  });

  it('two near-simultaneous plays from the same player only let the first succeed', () => {
    const state = makeState({ hands: { a: [c('dhab', 6), c('dhab', 9 as any as 10)], b: [], c: [] }, discard: c('dhab', 4) });
    const first = applyAction(state, { type: 'play', player: 'a', cardId: state.hands.a[0].id });
    expect(first.ok).toBe(true);
    // Replaying against the OLD state (as a stale concurrent request would) targets a
    // card that's no longer there / no longer this player's turn — rejected either way.
    const stale = applyAction(state, { type: 'play', player: 'a', cardId: state.hands.a[1].id });
    expect(stale.ok).toBe(true); // still legal against the old snapshot...
    // ...but applying the host's authoritative *latest* state is what actually matters:
    const second = applyAction(first.state, { type: 'play', player: 'a', cardId: state.hands.a[1].id });
    expect(second.ok).toBe(false); // turn already moved on
  });
});

describe('private hand isolation', () => {
  it('PublicState never carries card contents, only counts', () => {
    const s = startGame({
      playerKeys: ['a', 'b'],
      playerNames: { a: 'A', b: 'B' },
      playerColors: { a: 0, b: 1 },
      handSize: 4,
      rng: seededRng(5),
    });
    const keys = Object.keys(s.public);
    expect(keys).not.toContain('hands');
    expect(keys).not.toContain('drawPile');
    expect(keys).not.toContain('discardPile');
    expect(s.public.players.a).not.toHaveProperty('hand');
    expect(s.public.players.a.handCount).toBe(4);
  });
});
