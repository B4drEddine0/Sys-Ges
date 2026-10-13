// Pure game logic for Wobble Race: level geometry, physics step, and the little bits of
// math each obstacle type needs. No React, no networking — kept testable in isolation,
// same split as src/components/games/harf/harfLogic.ts.

export const WORLD_W = 4200;
export const WORLD_H = 640;
export const FINISH_X = 4120;
export const PIT_Y = WORLD_H + 160;

export const PLAYER_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899'];
export const PLAYER_W = 34;
export const PLAYER_H = 46;
export const PLAYER_RADIUS = 18;

const GRAVITY = 2000;
const MOVE_MAX = 300;
const GROUND_ACCEL = 2600;
const AIR_ACCEL = 1500;
const FRICTION = 2400;
const JUMP_VELOCITY = 700;
const MAX_FALL = 1150;
const KNOCKBACK_SPEED = 420;
const HIT_COOLDOWN_S = 0.6;

export const RACE_TIME_CAP_MS = 90_000;
export const COUNTDOWN_MS = 3400;
export const POINTS_BY_RANK = [8, 5, 3, 2, 1, 1];

// Shove power-up: a short-range tag on the nearest racer ahead of you that briefly
// locks their controls. It's a status effect on their in-game character only (like a
// shell in a kart game) — nothing about it touches another player's browser/tab.
export const THROW_RANGE = 260;
export const THROW_VERTICAL_TOLERANCE = 90;
export const THROW_COOLDOWN_MS = 4000;
export const STUN_MS = 1700;

export type Obstacle =
  | { id: string; type: 'static'; x: number; y: number; w: number; h: number }
  | { id: string; type: 'moving'; x: number; y: number; w: number; h: number; axis: 'x' | 'y'; range: number; speed: number; phase: number }
  | { id: string; type: 'pendulum'; pivotX: number; pivotY: number; length: number; ballRadius: number; amplitude: number; speed: number; phase: number }
  | { id: string; type: 'spinner'; cx: number; cy: number; length: number; thickness: number; speed: number; phase: number };

export interface Checkpoint {
  x: number;
  y: number;
}

export interface Level {
  obstacles: Obstacle[];
  checkpoints: Checkpoint[];
  spawn: { x: number; y: number };
}

// One hand-built course: start pad -> stepping gaps -> moving platforms over a pit ->
// a pendulum gauntlet -> a spinner bridge -> finish stretch. Static geometry stays
// fixed between races; only the moving/pendulum/spinner phases get reshuffled per race
// (see randomizedLevel) so it doesn't feel identical every replay.
export const BASE_LEVEL: Level = {
  spawn: { x: 70, y: 470 },
  checkpoints: [
    { x: 40, y: 470 },
    { x: 900, y: 470 },
    { x: 1820, y: 470 },
    { x: 2860, y: 470 },
    { x: 3620, y: 470 },
  ],
  obstacles: [
    { id: 'start', type: 'static', x: 0, y: 520, w: 320, h: 120 },
    { id: 's1', type: 'static', x: 400, y: 520, w: 140, h: 40 },
    { id: 's2', type: 'static', x: 620, y: 470, w: 140, h: 40 },
    { id: 's3', type: 'static', x: 840, y: 520, w: 160, h: 40 },

    { id: 'm1', type: 'moving', x: 1100, y: 460, w: 120, h: 24, axis: 'x', range: 90, speed: 1.4, phase: 0 },
    { id: 'm2', type: 'moving', x: 1350, y: 380, w: 120, h: 24, axis: 'y', range: 70, speed: 1.6, phase: 1.8 },
    { id: 'm3', type: 'moving', x: 1600, y: 460, w: 120, h: 24, axis: 'x', range: 90, speed: 1.3, phase: 3.1 },
    { id: 'land1', type: 'static', x: 1760, y: 520, w: 220, h: 40 },

    { id: 'floor-c', type: 'static', x: 2000, y: 520, w: 900, h: 40 },
    { id: 'p1', type: 'pendulum', pivotX: 2260, pivotY: 260, length: 260, ballRadius: 34, amplitude: 0.9, speed: 1.1, phase: 0 },
    { id: 'p2', type: 'pendulum', pivotX: 2560, pivotY: 260, length: 260, ballRadius: 34, amplitude: 0.9, speed: 1.0, phase: 2.4 },
    { id: 'p3', type: 'pendulum', pivotX: 2830, pivotY: 260, length: 260, ballRadius: 34, amplitude: 0.9, speed: 1.2, phase: 1.1 },

    { id: 'b1', type: 'static', x: 2960, y: 520, w: 160, h: 40 },
    { id: 'b2', type: 'static', x: 3190, y: 520, w: 160, h: 40 },
    { id: 'b3', type: 'static', x: 3420, y: 520, w: 160, h: 40 },
    { id: 'sp1', type: 'spinner', cx: 3080, cy: 500, length: 170, thickness: 18, speed: 1.6, phase: 0 },
    { id: 'sp2', type: 'spinner', cx: 3460, cy: 500, length: 170, thickness: 18, speed: 1.8, phase: 2.0 },

    { id: 'finish-floor', type: 'static', x: 3650, y: 520, w: 550, h: 40 },
  ],
};

export function randomSeed(): number {
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return r[0];
}

// Deterministic PRNG (mulberry32) so every player can derive the exact same obstacle
// phases from one small seed number the host broadcasts — this has to be identical
// across clients, or everyone sees the moving platforms/pendulums/spinners in different
// places, which breaks both fairness and the shared sense of "same course".
function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh obstacle-phase shuffle so repeat races feel different without redesigning the course. */
export function levelForSeed(seed: number): Level {
  const rnd = mulberry32(seed);
  return {
    ...BASE_LEVEL,
    obstacles: BASE_LEVEL.obstacles.map((o) => (o.type === 'static' ? o : { ...o, phase: rnd() * Math.PI * 2 })),
  };
}

// ---------------------------------------------------------------- obstacle positions

export function platformRectAt(o: Obstacle, t: number): { x: number; y: number; w: number; h: number } | null {
  if (o.type === 'static') return { x: o.x, y: o.y, w: o.w, h: o.h };
  if (o.type === 'moving') {
    const d = Math.sin(t * o.speed + o.phase) * o.range;
    return o.axis === 'x' ? { x: o.x + d, y: o.y, w: o.w, h: o.h } : { x: o.x, y: o.y + d, w: o.w, h: o.h };
  }
  return null;
}

export function pendulumBallAt(o: Extract<Obstacle, { type: 'pendulum' }>, t: number) {
  const angle = o.amplitude * Math.sin(t * o.speed + o.phase);
  return { x: o.pivotX + Math.sin(angle) * o.length, y: o.pivotY + Math.cos(angle) * o.length };
}

export function spinnerSegmentAt(o: Extract<Obstacle, { type: 'spinner' }>, t: number) {
  const angle = t * o.speed + o.phase;
  const dx = (Math.cos(angle) * o.length) / 2;
  const dy = (Math.sin(angle) * o.length) / 2;
  return { x1: o.cx - dx, y1: o.cy - dy, x2: o.cx + dx, y2: o.cy + dy };
}

function closestPointOnSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return { x: x1 + dx * t, y: y1 + dy * t };
}

// ---------------------------------------------------------------- player physics

export interface PlayerPhys {
  x: number;
  y: number; // feet position (ground contact point)
  vx: number;
  vy: number;
  grounded: boolean;
  rideId: string | null;
  hitCooldownUntil: number;
  checkpoint: { x: number; y: number };
  finished: boolean;
}

export function freshPlayer(level: Level): PlayerPhys {
  return {
    x: level.spawn.x,
    y: level.spawn.y,
    vx: 0,
    vy: 0,
    grounded: false,
    rideId: null,
    hitCooldownUntil: 0,
    checkpoint: { ...level.checkpoints[0] },
    finished: false,
  };
}

export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean;
}

function box(p: PlayerPhys) {
  return { left: p.x - PLAYER_W / 2, right: p.x + PLAYER_W / 2, top: p.y - PLAYER_H, bottom: p.y };
}

/** Advances one player by `dt` seconds. Pure function of its inputs — easy to unit test. */
export function stepPlayer(prev: PlayerPhys, input: Input, dt: number, t: number, level: Level): PlayerPhys {
  if (prev.finished) return prev;
  const p: PlayerPhys = { ...prev };

  const rects = level.obstacles
    .map((o) => ({ o, rect: platformRectAt(o, t) }))
    .filter((r): r is { o: Obstacle; rect: { x: number; y: number; w: number; h: number } } => !!r.rect);

  // Carry the player with whatever moving platform they're standing on.
  if (p.grounded && p.rideId) {
    const ride = rects.find((r) => r.o.id === p.rideId);
    const prevRide = level.obstacles.find((o) => o.id === p.rideId);
    if (ride && prevRide) {
      const prevRect = platformRectAt(prevRide, t - dt);
      if (prevRect) {
        p.x += ride.rect.x - prevRect.x;
        p.y += ride.rect.y - prevRect.y;
      }
    } else {
      p.rideId = null;
    }
  }

  // Horizontal movement.
  const accel = p.grounded ? GROUND_ACCEL : AIR_ACCEL;
  if (input.left && !input.right) p.vx -= accel * dt;
  else if (input.right && !input.left) p.vx += accel * dt;
  else {
    const drop = FRICTION * dt;
    p.vx = Math.abs(p.vx) <= drop ? 0 : p.vx - Math.sign(p.vx) * drop;
  }
  p.vx = Math.max(-MOVE_MAX, Math.min(MOVE_MAX, p.vx));

  p.x += p.vx * dt;
  {
    const b = box(p);
    for (const { rect } of rects) {
      if (b.right > rect.x && b.left < rect.x + rect.w && b.bottom > rect.y && b.top < rect.y + rect.h) {
        if (p.vx > 0) p.x = rect.x - PLAYER_W / 2;
        else if (p.vx < 0) p.x = rect.x + rect.w + PLAYER_W / 2;
        p.vx = 0;
        break;
      }
    }
  }

  // Jump + gravity.
  if (input.jump && p.grounded) {
    p.vy = -JUMP_VELOCITY;
    p.grounded = false;
    p.rideId = null;
  }
  p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);

  const prevBottom = p.y;
  const prevTop = p.y - PLAYER_H;
  p.y += p.vy * dt;
  p.grounded = false;
  {
    const b = box(p);
    for (const { o, rect } of rects) {
      if (b.right > rect.x && b.left < rect.x + rect.w && b.bottom > rect.y && b.top < rect.y + rect.h) {
        if (p.vy >= 0 && prevBottom <= rect.y + 1) {
          p.y = rect.y;
          p.vy = 0;
          p.grounded = true;
          p.rideId = o.type === 'moving' ? o.id : null;
        } else if (p.vy < 0 && prevTop >= rect.y + rect.h - 1) {
          p.y = rect.y + rect.h + PLAYER_H;
          p.vy = 0;
        }
        break;
      }
    }
  }

  // Hazards: pendulum balls and spinner bars knock the player back instead of killing them.
  if (t >= p.hitCooldownUntil) {
    const cx = p.x;
    const cy = p.y - PLAYER_H / 2;
    for (const o of level.obstacles) {
      let hx = 0;
      let hy = 0;
      let hit = false;
      if (o.type === 'pendulum') {
        const ball = pendulumBallAt(o, t);
        const d = Math.hypot(cx - ball.x, cy - ball.y);
        if (d < o.ballRadius + PLAYER_RADIUS) {
          hit = true;
          hx = d === 0 ? 1 : (cx - ball.x) / d;
          hy = d === 0 ? -0.4 : (cy - ball.y) / d;
        }
      } else if (o.type === 'spinner') {
        const seg = spinnerSegmentAt(o, t);
        const cp = closestPointOnSegment(cx, cy, seg.x1, seg.y1, seg.x2, seg.y2);
        const d = Math.hypot(cx - cp.x, cy - cp.y);
        if (d < o.thickness / 2 + PLAYER_RADIUS) {
          hit = true;
          hx = d === 0 ? 1 : (cx - cp.x) / d;
          hy = d === 0 ? -0.4 : (cy - cp.y) / d;
        }
      }
      if (hit) {
        p.vx = hx * KNOCKBACK_SPEED;
        p.vy = Math.min(p.vy, 0) + hy * KNOCKBACK_SPEED * 0.6 - 160;
        p.grounded = false;
        p.rideId = null;
        p.hitCooldownUntil = t + HIT_COOLDOWN_S;
        break;
      }
    }
  }

  // Checkpoints: once grounded past a checkpoint's x, it becomes the new respawn point.
  if (p.grounded) {
    for (const c of level.checkpoints) {
      if (p.x >= c.x) p.checkpoint = c;
    }
  }

  // Fell into a pit — back to the last checkpoint.
  if (p.y > PIT_Y) {
    p.x = p.checkpoint.x;
    p.y = p.checkpoint.y;
    p.vx = 0;
    p.vy = 0;
    p.grounded = false;
    p.rideId = null;
    p.hitCooldownUntil = t + 0.3;
  }

  if (p.x >= FINISH_X) p.finished = true;

  return p;
}
