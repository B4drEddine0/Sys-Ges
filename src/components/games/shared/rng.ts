// Small shared RNG helpers used wherever multiple clients need to derive the exact same
// "random" outcome from one small seed number broadcast by the host (e.g. a scrambled
// word's letter order) — see Wobble Race's level seeding for the original version this
// was lifted from.

export function randomSeed(): number {
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return r[0];
}

/** Deterministic PRNG (mulberry32) — same seed always produces the same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWithRng<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
