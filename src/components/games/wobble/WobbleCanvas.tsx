import { useEffect, useRef, useState } from 'react';
import { Bomb, Maximize2, Minimize2 } from 'lucide-react';
import {
  FINISH_X,
  PIT_Y,
  PLAYER_COLORS,
  PLAYER_H,
  PLAYER_RADIUS,
  THROW_COOLDOWN_MS,
  THROW_RANGE,
  THROW_VERTICAL_TOLERANCE,
  WORLD_W,
  freshPlayer,
  pendulumBallAt,
  platformRectAt,
  spinnerSegmentAt,
  stepPlayer,
  type Level,
  type PlayerPhys,
} from './wobbleLogic';
import type { RemoteSnap, WobblePlayer } from './useWobbleGame';

interface Props {
  level: Level;
  myKey: string;
  myColor: number;
  myName: string;
  players: WobblePlayer[];
  active: string[];
  raceStartAt: number;
  getNow: () => number;
  getRemotePositions: () => Record<string, { x: number; y: number; facing: 1 | -1; anim: RemoteSnap['anim'] }>;
  getStunUntil: () => number;
  drainThrows: () => Array<{ from: string; x: number; y: number; facing: 1 | -1; hit: boolean }>;
  sendPos: (x: number, y: number, facing: 1 | -1, anim: RemoteSnap['anim']) => void;
  sendHit: (targetKey: string) => void;
  sendThrow: (x: number, y: number, facing: 1 | -1, hit: boolean) => void;
  onFinish: (timeMs: number) => void;
  onHud: (info: { progress: number; rank: number; elapsedMs: number }) => void;
}

// How many world units are visible vertically — bigger in fullscreen so the extra
// screen real estate actually shows more of the course instead of just zooming in.
const VIEW_H_NORMAL = 460;
const VIEW_H_FULL = 620;

const THROW_FX_MS = 420;

export function WobbleCanvas({ level, myKey, myColor, myName, players, active, raceStartAt, getNow, getRemotePositions, getStunUntil, drainThrows, sendPos, sendHit, sendThrow, onFinish, onHud }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef({ left: false, right: false, jump: false });
  const playerRef = useRef<PlayerPhys>(freshPlayer(level));
  const finishedRef = useRef(false);
  const shakeRef = useRef(0);
  const lastSendRef = useRef(0);
  const lastHudRef = useRef(0);
  const prevCooldownRef = useRef(0);
  const wasStunnedRef = useRef(false);
  const lastFacingRef = useRef<1 | -1>(1);
  const throwCooldownUntilRef = useRef(0);
  // Visible "something flew" effects — both my own throws (shown instantly, no network
  // round-trip) and other players' (arrive via drainThrows()). Canvas-drawn, not React
  // state, since they need per-frame position updates.
  const fxRef = useRef<Array<{ x: number; y: number; facing: 1 | -1; start: number; isMine: boolean; hit: boolean }>>([]);
  const dprRef = useRef(1);
  const sizeRef = useRef({ w: 960, h: VIEW_H_NORMAL });
  const camRef = useRef({ x: level.spawn.x, y: level.spawn.y - PLAYER_H });
  const isFullscreenRef = useRef(false);
  const viewHWorldRef = useRef(VIEW_H_NORMAL);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [throwReady, setThrowReady] = useState(true);
  const [justThrew, setJustThrew] = useState(false);
  const [hitMsg, setHitMsg] = useState<string | null>(null);
  const hitMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kept live via refs (not closed over) so a mid-race roster update (reconnect, late
  // presence sync) shows up without having to tear down and restart the physics loop.
  const playersRef = useRef(players);
  playersRef.current = players;
  const activeRef = useRef(active);
  activeRef.current = active;

  const nameOf = (key: string) => (key === myKey ? myName : playersRef.current.find((p) => p.key === key)?.name ?? '?');
  const colorOf = (key: string, fallback = 0) => {
    const p = playersRef.current.find((p) => p.key === key);
    return PLAYER_COLORS[(key === myKey ? myColor : p?.color ?? fallback) % PLAYER_COLORS.length];
  };

  const tryThrow = () => {
    const now = performance.now();
    if (now < throwCooldownUntilRef.current) return; // still on cooldown — silently ignored, button already shows this
    if (finishedRef.current) return;
    const p = playerRef.current;
    const facing = lastFacingRef.current;

    throwCooldownUntilRef.current = now + THROW_COOLDOWN_MS;
    setThrowReady(false);
    setTimeout(() => setThrowReady(true), THROW_COOLDOWN_MS);

    // Always-visible feedback the moment you press, whether or not it connects — this is
    // what was missing before: pressing F looked identical to pressing nothing.
    setJustThrew(true);
    setTimeout(() => setJustThrew(false), 220);

    if (now < getStunUntil()) {
      if (hitMsgTimer.current) clearTimeout(hitMsgTimer.current);
      setHitMsg("😵 Can't shove while dazed!");
      hitMsgTimer.current = setTimeout(() => setHitMsg(null), 1400);
      return;
    }

    const remote = getRemotePositions();
    let bestKey: string | null = null;
    let bestDist = Infinity;
    for (const key of activeRef.current) {
      if (key === myKey) continue;
      const r = remote[key];
      if (!r) continue;
      const dx = (r.x - p.x) * facing;
      if (dx < 0 || dx > THROW_RANGE) continue;
      if (Math.abs(r.y - p.y) > THROW_VERTICAL_TOLERANCE) continue;
      if (dx < bestDist) {
        bestDist = dx;
        bestKey = key;
      }
    }

    fxRef.current.push({ x: p.x, y: p.y, facing, start: now, isMine: true, hit: !!bestKey });
    sendThrow(p.x, p.y, facing, !!bestKey);

    if (hitMsgTimer.current) clearTimeout(hitMsgTimer.current);
    if (bestKey) {
      sendHit(bestKey);
      setHitMsg(`💥 Tripped ${nameOf(bestKey)}!`);
    } else {
      setHitMsg('💨 Missed — no one in range');
    }
    hitMsgTimer.current = setTimeout(() => setHitMsg(null), 1600);
  };

  // Keyboard controls.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD', 'ArrowUp', 'KeyW', 'Space', 'KeyF'].includes(e.code)) e.preventDefault();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') inputRef.current.jump = true;
      if (e.code === 'KeyF' && !e.repeat) tryThrow();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') inputRef.current.jump = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fullscreen toggle — same requestFullscreen/exitFullscreen pattern as Pong.
  useEffect(() => {
    const onChange = () => {
      const full = document.fullscreenElement === wrapRef.current;
      isFullscreenRef.current = full;
      setIsFullscreen(full);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => {
    if (!wrapRef.current) return;
    if (!document.fullscreenElement) wrapRef.current.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  };

  // Canvas sizing (devicePixelRatio aware, resizes with its wrapper and with fullscreen).
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      dprRef.current = dpr;
      sizeRef.current = { w, h };
      viewHWorldRef.current = isFullscreenRef.current ? VIEW_H_FULL : VIEW_H_NORMAL;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    document.addEventListener('fullscreenchange', resize);
    return () => {
      ro.disconnect();
      document.removeEventListener('fullscreenchange', resize);
    };
  }, []);

  // Main loop: local physics + camera + render + throttled network sync.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const elapsedMs = Math.max(0, getNow() - raceStartAt);
      const t = elapsedMs / 1000;
      const stunned = now < getStunUntil();

      if (stunned && !wasStunnedRef.current) {
        // A shove just landed — a little comedic stumble, on top of the control lock.
        const p = playerRef.current;
        p.vx = (Math.random() < 0.5 ? -1 : 1) * 150;
        p.vy = Math.min(p.vy, -220);
        p.grounded = false;
        p.rideId = null;
      }
      wasStunnedRef.current = stunned;

      if (!finishedRef.current) {
        const effectiveInput = stunned ? { left: false, right: false, jump: false } : inputRef.current;
        const next = stepPlayer(playerRef.current, effectiveInput, dt, t, level);
        playerRef.current = next;
        if (Math.abs(next.vx) > 20) lastFacingRef.current = next.vx > 0 ? 1 : -1;
        if (next.hitCooldownUntil > prevCooldownRef.current + 0.01) shakeRef.current = 0.22;
        prevCooldownRef.current = next.hitCooldownUntil;
        if (next.finished) {
          finishedRef.current = true;
          onFinish(elapsedMs);
        }
      }

      const p2 = playerRef.current;
      if (now - lastSendRef.current > 75) {
        lastSendRef.current = now;
        const anim: RemoteSnap['anim'] = finishedRef.current
          ? 'finished'
          : stunned
            ? 'stunned'
            : !p2.grounded
              ? p2.hitCooldownUntil > t ? 'hit' : 'air'
              : Math.abs(p2.vx) > 20
                ? 'run'
                : 'idle';
        sendPos(p2.x, p2.y, lastFacingRef.current, anim);
      }

      if (now - lastHudRef.current > 180) {
        lastHudRef.current = now;
        const remote = getRemotePositions();
        const xs = activeRef.current.map((k) => (k === myKey ? p2.x : remote[k]?.x ?? 0));
        const rank = 1 + xs.filter((x) => x > p2.x).length;
        onHud({ progress: Math.max(0, Math.min(1, p2.x / FINISH_X)), rank, elapsedMs });
      }

      // Smoothly follow the local player — this is what actually fixes the camera only
      // ever showing world-y 0..420 while the course lives around y 460-560+.
      const viewHWorld = viewHWorldRef.current;
      const { w, h } = sizeRef.current;
      const viewWWorld = h > 0 ? viewHWorld * (w / h) : viewHWorld;
      const targetX = Math.max(0, Math.min(Math.max(0, WORLD_W - viewWWorld), p2.x - viewWWorld / 2));
      const targetY = Math.max(0, Math.min(Math.max(0, PIT_Y + 100 - viewHWorld), p2.y - PLAYER_H / 2 - viewHWorld * 0.58));
      const follow = Math.min(1, dt * 6);
      camRef.current.x += (targetX - camRef.current.x) * follow;
      camRef.current.y += (targetY - camRef.current.y) * follow;

      let camX = camRef.current.x;
      let camY = camRef.current.y;
      if (shakeRef.current > 0) {
        camX += (Math.random() - 0.5) * 10 * shakeRef.current;
        camY += (Math.random() - 0.5) * 6 * shakeRef.current;
      }

      for (const incoming of drainThrows()) fxRef.current.push({ ...incoming, start: now, isMine: false, hit: false });
      fxRef.current = fxRef.current.filter((fx) => now - fx.start < THROW_FX_MS);

      render(ctx, level, p2, finishedRef.current, stunned, t, activeRef.current, myKey, getRemotePositions(), nameOf, colorOf, myColor, sizeRef.current, dprRef.current, camX, camY, viewWWorld, viewHWorld, fxRef.current, now);
      if (shakeRef.current > 0) shakeRef.current = Math.max(0, shakeRef.current - dt);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, raceStartAt]);

  // Touch controls for mobile — same input ref as the keyboard handlers.
  const bind = (key: 'left' | 'right' | 'jump') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      inputRef.current[key] = true;
    },
    onPointerUp: () => {
      inputRef.current[key] = false;
    },
    onPointerLeave: () => {
      inputRef.current[key] = false;
    },
    onPointerCancel: () => {
      inputRef.current[key] = false;
    },
  });

  return (
    <div
      ref={wrapRef}
      className="relative w-full select-none touch-none overflow-hidden rounded-3xl bg-black shadow-soft"
      style={{ height: isFullscreen ? '100vh' : VIEW_H_NORMAL }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />

      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        className="absolute right-3 top-3 z-40 rounded-xl bg-black/35 p-2 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/55 hover:text-white"
      >
        {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
      </button>

      {hitMsg && (
        <div
          key={hitMsg}
          className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-150 rounded-full bg-black/60 px-4 py-2 text-base font-extrabold text-white shadow-lg backdrop-blur-sm"
        >
          {hitMsg}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-end justify-between px-3">
        <div className="pointer-events-auto flex gap-2 md:hidden">
          <button {...bind('left')} aria-label="Left" className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/35 text-3xl font-black text-white backdrop-blur active:bg-black/55">
            ‹
          </button>
          <button {...bind('right')} aria-label="Right" className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/35 text-3xl font-black text-white backdrop-blur active:bg-black/55">
            ›
          </button>
        </div>
        <div className="pointer-events-auto relative">
          {justThrew && <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-rose-500/70" />}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              tryThrow();
            }}
            disabled={!throwReady}
            aria-label="Shove"
            title="Shove the nearest racer ahead of you (F)"
            className={`flex h-14 w-14 items-center justify-center rounded-full text-white backdrop-blur transition-all disabled:opacity-35 ${justThrew ? 'scale-90' : 'scale-100'}`}
            style={{ background: throwReady ? 'rgba(244,63,94,0.85)' : 'rgba(0,0,0,0.35)' }}
          >
            <Bomb className="h-6 w-6" />
          </button>
        </div>
        <button {...bind('jump')} aria-label="Jump" className="pointer-events-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/25 text-base font-black uppercase text-white backdrop-blur active:bg-white/40 md:hidden">
          Jump
        </button>
      </div>
    </div>
  );
}

function render(
  ctx: CanvasRenderingContext2D,
  level: Level,
  me: PlayerPhys,
  meFinished: boolean,
  meStunned: boolean,
  t: number,
  active: string[],
  myKey: string,
  remote: Record<string, { x: number; y: number; facing: 1 | -1; anim: RemoteSnap['anim'] }>,
  nameOf: (key: string) => string,
  colorOf: (key: string, fallback?: number) => string,
  myColor: number,
  size: { w: number; h: number },
  dpr: number,
  camX: number,
  camY: number,
  viewW: number,
  viewH: number,
  fx: Array<{ x: number; y: number; facing: 1 | -1; start: number; isMine: boolean; hit: boolean }>,
  now: number,
) {
  const { w, h } = size;
  if (w === 0 || h === 0) return;
  ctx.save();
  ctx.scale(dpr, dpr);

  const scale = h / viewH;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-camX, -camY);

  // Sky — themed per course.
  const theme = level.theme;
  const sky = ctx.createLinearGradient(0, 0, 0, PIT_Y);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(camX, camY, viewW, viewH);

  // Distant stars/dots for depth.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  for (let i = 0; i < 60; i++) {
    const x = (i * 211) % WORLD_W;
    const y = (i * 97) % 420;
    ctx.fillRect(x, y, 2, 2);
  }

  // Pit void.
  const pit = ctx.createLinearGradient(0, PIT_Y - 120, 0, PIT_Y + 40);
  pit.addColorStop(0, 'rgba(0,0,0,0)');
  pit.addColorStop(1, '#09061a');
  ctx.fillStyle = pit;
  ctx.fillRect(camX, PIT_Y - 120, viewW, 200);

  // Obstacles.
  for (const o of level.obstacles) {
    if (o.type === 'static' || o.type === 'moving') {
      const rect = platformRectAt(o, t)!;
      if (rect.x + rect.w < camX - 40 || rect.x > camX + viewW + 40) continue;
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
      const grad = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
      const [c0, c1] = o.type === 'moving' ? theme.platformMoving : theme.platformStatic;
      grad.addColorStop(0, c0);
      grad.addColorStop(1, c1);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (o.type === 'pendulum') {
      const ball = pendulumBallAt(o, t);
      if (ball.x < camX - 100 || ball.x > camX + viewW + 100) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(o.pivotX, o.pivotY);
      ctx.lineTo(ball.x, ball.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(o.pivotX, o.pivotY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
      const g = ctx.createRadialGradient(ball.x - 10, ball.y - 10, 4, ball.x, ball.y, o.ballRadius);
      g.addColorStop(0, theme.hazardBall[0]);
      g.addColorStop(1, theme.hazardBall[1]);
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, o.ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    } else if (o.type === 'spinner') {
      if (o.cx < camX - 150 || o.cx > camX + viewW + 150) continue;
      const seg = spinnerSegmentAt(o, t);
      ctx.strokeStyle = theme.spinnerBar;
      ctx.lineCap = 'round';
      ctx.lineWidth = o.thickness;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(o.cx, o.cy, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#92400e';
      ctx.fill();
    }
  }

  // Finish line.
  if (FINISH_X < camX + viewW + 60) {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#f8fafc' : '#1e293b';
      ctx.fillRect(FINISH_X, 120 + i * 28, 14, 28);
    }
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(FINISH_X + 6, 60, 4, 560);
  }

  // Remote players.
  for (const key of active) {
    if (key === myKey) continue;
    const r = remote[key];
    if (!r) continue;
    drawPlayer(ctx, r.x, r.y, colorOf(key), nameOf(key), r.facing, r.anim, false);
  }

  // Local player on top.
  const myAnim: RemoteSnap['anim'] = meFinished ? 'finished' : meStunned ? 'stunned' : !me.grounded ? (me.hitCooldownUntil > t ? 'hit' : 'air') : Math.abs(me.vx) > 20 ? 'run' : 'idle';
  drawPlayer(ctx, me.x, me.y, colorOf(myKey, myColor), nameOf(myKey), me.vx < 0 ? -1 : 1, myAnim, true);

  // Thrown shoves — a little bomb arcing from the thrower, with a burst where it lands.
  for (const f of fx) {
    const k = Math.min(1, (now - f.start) / THROW_FX_MS);
    const arcX = f.x + f.facing * THROW_RANGE * k;
    const arcY = f.y - PLAYER_H / 2 - Math.sin(k * Math.PI) * 60;
    ctx.save();
    ctx.translate(arcX, arcY);
    ctx.rotate(k * 10);
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#1f2937';
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    if (k > 0.85) {
      const burst = (k - 0.85) / 0.15;
      ctx.beginPath();
      ctx.arc(arcX, arcY, 10 + burst * 26, 0, Math.PI * 2);
      ctx.strokeStyle = f.hit ? `rgba(244,63,94,${1 - burst})` : `rgba(148,163,184,${1 - burst})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  ctx.restore();
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  name: string,
  facing: 1 | -1,
  anim: RemoteSnap['anim'],
  isMe: boolean,
) {
  const squash = anim === 'air' ? 0.9 : anim === 'hit' || anim === 'stunned' ? 1.15 : 1;
  const bob = anim === 'run' ? Math.sin(performance.now() / 70) * 3 : anim === 'stunned' ? Math.sin(performance.now() / 45) * 4 : 0;
  const cy = y - PLAYER_RADIUS - bob;

  if (isMe) {
    ctx.beginPath();
    ctx.arc(x, cy, PLAYER_RADIUS + 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  if (anim === 'hit') {
    ctx.beginPath();
    ctx.arc(x, cy, PLAYER_RADIUS + 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(244,63,94,0.6)';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(x, cy);
  ctx.scale(1 / squash, squash);
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = anim === 'finished' ? '#facc15' : color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (anim === 'stunned') {
    // Dazed stars circling the head instead of normal eyes.
    for (let i = 0; i < 3; i++) {
      const a = performance.now() / 180 + (i * Math.PI * 2) / 3;
      const sx = Math.cos(a) * (PLAYER_RADIUS * 0.75);
      const sy = -PLAYER_RADIUS * 0.6 + Math.sin(a) * (PLAYER_RADIUS * 0.3);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a);
      ctx.font = '12px serif';
      ctx.fillStyle = '#fde68a';
      ctx.fillText('★', -5, 4);
      ctx.restore();
    }
  } else {
    // Eyes, offset toward facing direction.
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(facing * 6, -4, 3, 0, Math.PI * 2);
    ctx.arc(facing * 11, -4, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.font = '700 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(name, x, cy - PLAYER_RADIUS - 10 + 1);
  ctx.fillStyle = '#fff';
  ctx.fillText(name, x, cy - PLAYER_RADIUS - 10);
}
