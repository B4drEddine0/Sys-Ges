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

export interface LevelTheme {
  name: string;
  icon: string;
  skyTop: string;
  skyBottom: string;
  platformStatic: [string, string];
  platformMoving: [string, string];
  hazardBall: [string, string];
  spinnerBar: string;
}

export interface Level {
  name: string;
  theme: LevelTheme;
  obstacles: Obstacle[];
  checkpoints: Checkpoint[];
  spawn: { x: number; y: number };
}

// All three courses share the exact same stepping-gap sizes, floor spans and bridge-tile
// layout (already proven completable — see the physics sanity checks run while building
// this), so swapping which hazard type sits in which zone is always safe: it can't ever
// create an un-crossable gap, only a differently-flavoured one. The one zone that MUST
// stay "things you can stand on" is the stretch over the pit (no floor underneath), so
// that's always moving platforms in every course — only their count/pattern varies.
const CHECKPOINTS: Checkpoint[] = [
  { x: 40, y: 470 },
  { x: 900, y: 470 },
  { x: 1820, y: 470 },
  { x: 2860, y: 470 },
  { x: 3620, y: 470 },
];
const SPAWN = { x: 70, y: 470 };
const START_PAD: Obstacle = { id: 'start', type: 'static', x: 0, y: 520, w: 320, h: 120 };
const STEP_GAPS: Obstacle[] = [
  { id: 's1', type: 'static', x: 400, y: 520, w: 140, h: 40 },
  { id: 's2', type: 'static', x: 620, y: 470, w: 140, h: 40 },
  { id: 's3', type: 'static', x: 840, y: 520, w: 160, h: 40 },
];
const LANDING: Obstacle = { id: 'land1', type: 'static', x: 1760, y: 520, w: 220, h: 40 };
const MID_FLOOR: Obstacle = { id: 'floor-c', type: 'static', x: 2000, y: 520, w: 900, h: 40 };
const BRIDGE_TILES: Obstacle[] = [
  { id: 'b1', type: 'static', x: 2960, y: 520, w: 160, h: 40 },
  { id: 'b2', type: 'static', x: 3190, y: 520, w: 160, h: 40 },
  { id: 'b3', type: 'static', x: 3420, y: 520, w: 160, h: 40 },
];
const FINISH_FLOOR: Obstacle = { id: 'finish-floor', type: 'static', x: 3650, y: 520, w: 550, h: 40 };

export const COURSES: Level[] = [
  {
    name: 'Sky Ruins',
    theme: {
      name: 'Sky Ruins',
      icon: '🏛️',
      skyTop: '#1e1b4b',
      skyBottom: '#4338ca',
      platformStatic: ['#94a3b8', '#475569'],
      platformMoving: ['#818cf8', '#4f46e5'],
      hazardBall: ['#fca5a5', '#dc2626'],
      spinnerBar: '#fbbf24',
    },
    spawn: SPAWN,
    checkpoints: CHECKPOINTS,
    obstacles: [
      START_PAD,
      ...STEP_GAPS,
      { id: 'm1', type: 'moving', x: 1100, y: 460, w: 120, h: 24, axis: 'x', range: 90, speed: 1.4, phase: 0 },
      { id: 'm2', type: 'moving', x: 1350, y: 380, w: 120, h: 24, axis: 'y', range: 70, speed: 1.6, phase: 1.8 },
      { id: 'm3', type: 'moving', x: 1600, y: 460, w: 120, h: 24, axis: 'x', range: 90, speed: 1.3, phase: 3.1 },
      LANDING,
      MID_FLOOR,
      { id: 'p1', type: 'pendulum', pivotX: 2260, pivotY: 260, length: 260, ballRadius: 34, amplitude: 0.9, speed: 1.1, phase: 0 },
      { id: 'p2', type: 'pendulum', pivotX: 2560, pivotY: 260, length: 260, ballRadius: 34, amplitude: 0.9, speed: 1.0, phase: 2.4 },
      { id: 'p3', type: 'pendulum', pivotX: 2830, pivotY: 260, length: 260, ballRadius: 34, amplitude: 0.9, speed: 1.2, phase: 1.1 },
      ...BRIDGE_TILES,
      { id: 'sp1', type: 'spinner', cx: 3080, cy: 500, length: 170, thickness: 18, speed: 1.6, phase: 0 },
      { id: 'sp2', type: 'spinner', cx: 3460, cy: 500, length: 170, thickness: 18, speed: 1.8, phase: 2.0 },
      FINISH_FLOOR,
    ],
  },
  {
    name: 'Molten Caverns',
    theme: {
      name: 'Molten Caverns',
      icon: '🌋',
      skyTop: '#450a0a',
      skyBottom: '#9a3412',
      platformStatic: ['#57534e', '#292524'],
      platformMoving: ['#fb923c', '#c2410c'],
      hazardBall: ['#fde047', '#ea580c'],
      spinnerBar: '#f87171',
    },
    spawn: SPAWN,
    checkpoints: CHECKPOINTS,
    obstacles: [
      START_PAD,
      ...STEP_GAPS,
      // Four smaller, faster platforms instead of three — a more frantic crossing.
      { id: 'm1', type: 'moving', x: 1080, y: 460, w: 90, h: 24, axis: 'y', range: 55, speed: 1.9, phase: 0 },
      { id: 'm2', type: 'moving', x: 1300, y: 420, w: 90, h: 24, axis: 'x', range: 80, speed: 1.7, phase: 1.4 },
      { id: 'm3', type: 'moving', x: 1480, y: 460, w: 90, h: 24, axis: 'y', range: 55, speed: 1.8, phase: 3.0 },
      { id: 'm4', type: 'moving', x: 1650, y: 420, w: 90, h: 24, axis: 'x', range: 80, speed: 1.6, phase: 4.5 },
      LANDING,
      MID_FLOOR,
      // Floor-level spinning lava blades instead of swinging pendulums.
      { id: 'sp1', type: 'spinner', cx: 2250, cy: 500, length: 190, thickness: 20, speed: 1.7, phase: 0 },
      { id: 'sp2', type: 'spinner', cx: 2500, cy: 500, length: 190, thickness: 20, speed: 1.9, phase: 2.1 },
      { id: 'sp3', type: 'spinner', cx: 2750, cy: 500, length: 190, thickness: 20, speed: 1.6, phase: 4.2 },
      ...BRIDGE_TILES,
      // Swinging lava orbs over the bridge instead of spinners.
      { id: 'p1', type: 'pendulum', pivotX: 3080, pivotY: 250, length: 250, ballRadius: 34, amplitude: 0.9, speed: 1.2, phase: 0 },
      { id: 'p2', type: 'pendulum', pivotX: 3460, pivotY: 250, length: 250, ballRadius: 34, amplitude: 0.9, speed: 1.1, phase: 2.6 },
      FINISH_FLOOR,
    ],
  },
  {
    name: 'Frost Summit',
    theme: {
      name: 'Frost Summit',
      icon: '🏔️',
      skyTop: '#082f49',
      skyBottom: '#7dd3fc',
      platformStatic: ['#e2e8f0', '#94a3b8'],
      platformMoving: ['#67e8f9', '#0891b2'],
      hazardBall: ['#e0f2fe', '#38bdf8'],
      spinnerBar: '#a5f3fc',
    },
    spawn: SPAWN,
    checkpoints: CHECKPOINTS,
    obstacles: [
      START_PAD,
      ...STEP_GAPS,
      // One long slow drifting platform plus two quick ones — a mixed crossing.
      { id: 'm1', type: 'moving', x: 1120, y: 440, w: 150, h: 24, axis: 'x', range: 110, speed: 0.8, phase: 0 },
      { id: 'm2', type: 'moving', x: 1420, y: 400, w: 90, h: 24, axis: 'y', range: 65, speed: 1.9, phase: 2.0 },
      { id: 'm3', type: 'moving', x: 1620, y: 460, w: 90, h: 24, axis: 'x', range: 70, speed: 1.8, phase: 3.6 },
      LANDING,
      MID_FLOOR,
      // Ice boulders and a shard-bar mixed together — the toughest zone of the three.
      { id: 'p1', type: 'pendulum', pivotX: 2240, pivotY: 260, length: 260, ballRadius: 32, amplitude: 0.85, speed: 1.0, phase: 0 },
      { id: 'sp1', type: 'spinner', cx: 2530, cy: 500, length: 180, thickness: 18, speed: 1.5, phase: 1.0 },
      { id: 'p2', type: 'pendulum', pivotX: 2820, pivotY: 260, length: 260, ballRadius: 32, amplitude: 0.85, speed: 1.1, phase: 2.2 },
      ...BRIDGE_TILES,
      { id: 'p3', type: 'pendulum', pivotX: 3080, pivotY: 240, length: 230, ballRadius: 30, amplitude: 0.8, speed: 1.2, phase: 0 },
      { id: 'p4', type: 'pendulum', pivotX: 3460, pivotY: 240, length: 230, ballRadius: 30, amplitude: 0.8, speed: 1.0, phase: 2.8 },
      FINISH_FLOOR,
    ],
  },
];

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

/** A fresh obstacle-phase shuffle on top of `course`, so a repeated course still feels different. */
export function levelForSeed(course: Level, seed: number): Level {
  const rnd = mulberry32(seed);
  return {
    ...course,
    obstacles: course.obstacles.map((o) => (o.type === 'static' ? o : { ...o, phase: rnd() * Math.PI * 2 })),
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
  /** Exact rect of the ridden platform as of the end of last frame — see stepPlayer. */
  rideRect: { x: number; y: number } | null;
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
    rideRect: null,
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

  // Carry the player with whatever moving platform they're standing on, using the exact
  // rect we stored at the end of last frame rather than recomputing "last frame's
  // position" from t - dt: t tracks wall-clock race time, dt tracks the render loop's own
  // frame timing, and those two clocks don't agree to sub-millisecond precision — on a
  // fast-oscillating platform that tiny mismatch read as constant rubber-banding.
  if (p.grounded && p.rideId && p.rideRect) {
    const ride = rects.find((r) => r.o.id === p.rideId);
    if (ride) {
      p.x += ride.rect.x - p.rideRect.x;
      p.y += ride.rect.y - p.rideRect.y;
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

  // Snapshot whatever platform we're riding now (or clear it) so next frame's carry
  // step above has an exact, non-approximated baseline to diff against.
  p.rideRect = p.rideId ? (rects.find((r) => r.o.id === p.rideId)?.rect ?? null) : null;

  return p;
}
