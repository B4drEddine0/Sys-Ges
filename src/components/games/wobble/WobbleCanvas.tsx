import { useEffect, useRef } from 'react';
import {
  FINISH_X,
  PIT_Y,
  PLAYER_COLORS,
  PLAYER_RADIUS,
  WORLD_H,
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
  sendPos: (x: number, y: number, facing: 1 | -1, anim: RemoteSnap['anim']) => void;
  onFinish: (timeMs: number) => void;
  onHud: (info: { progress: number; rank: number; elapsedMs: number }) => void;
}

const VIEW_H = 420;
const SKY_TOP = '#1e1b4b';
const SKY_BOTTOM = '#4338ca';

export function WobbleCanvas({ level, myKey, myColor, myName, players, active, raceStartAt, getNow, getRemotePositions, sendPos, onFinish, onHud }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef({ left: false, right: false, jump: false });
  const playerRef = useRef<PlayerPhys>(freshPlayer(level));
  const finishedRef = useRef(false);
  const shakeRef = useRef(0);
  const lastSendRef = useRef(0);
  const lastHudRef = useRef(0);
  const prevCooldownRef = useRef(0);
  const dprRef = useRef(1);
  const sizeRef = useRef({ w: 960, h: VIEW_H });

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

  // Keyboard controls.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD', 'ArrowUp', 'KeyW', 'Space'].includes(e.code)) e.preventDefault();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') inputRef.current.jump = true;
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
  }, []);

  // Canvas sizing (devicePixelRatio aware, resizes with its wrapper).
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const resize = () => {
      const w = wrap.clientWidth;
      const h = VIEW_H;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      dprRef.current = dpr;
      sizeRef.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Main loop: local physics + render + throttled network sync.
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
      const p = playerRef.current;

      if (!finishedRef.current) {
        const next = stepPlayer(p, inputRef.current, dt, t, level);
        playerRef.current = next;
        if (next.hitCooldownUntil > prevCooldownRef.current + 0.01) {
          shakeRef.current = 0.22;
        }
        prevCooldownRef.current = next.hitCooldownUntil;
        if (next.finished) {
          finishedRef.current = true;
          onFinish(elapsedMs);
        }
      }

      if (now - lastSendRef.current > 75) {
        lastSendRef.current = now;
        const p2 = playerRef.current;
        const anim: RemoteSnap['anim'] = finishedRef.current
          ? 'finished'
          : !p2.grounded
            ? p2.hitCooldownUntil > t ? 'hit' : 'air'
            : Math.abs(p2.vx) > 20
              ? 'run'
              : 'idle';
        sendPos(p2.x, p2.y, p2.vx < -5 ? -1 : p2.vx > 5 ? 1 : (p.vx < 0 ? -1 : 1), anim);
      }

      if (now - lastHudRef.current > 180) {
        lastHudRef.current = now;
        const remote = getRemotePositions();
        const xs = activeRef.current.map((k) => (k === myKey ? playerRef.current.x : remote[k]?.x ?? 0));
        const myX = playerRef.current.x;
        const rank = 1 + xs.filter((x) => x > myX).length;
        onHud({ progress: Math.max(0, Math.min(1, myX / FINISH_X)), rank, elapsedMs });
      }

      render(ctx, level, playerRef.current, finishedRef.current, t, shakeRef.current, activeRef.current, myKey, getRemotePositions(), nameOf, colorOf, myColor, sizeRef.current, dprRef.current);
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
    <div ref={wrapRef} className="relative w-full select-none touch-none overflow-hidden rounded-3xl shadow-soft" style={{ height: VIEW_H }}>
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-end justify-between px-3 md:hidden">
        <div className="pointer-events-auto flex gap-2">
          <button {...bind('left')} aria-label="Left" className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/35 text-3xl font-black text-white backdrop-blur active:bg-black/55">
            ‹
          </button>
          <button {...bind('right')} aria-label="Right" className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/35 text-3xl font-black text-white backdrop-blur active:bg-black/55">
            ›
          </button>
        </div>
        <button {...bind('jump')} aria-label="Jump" className="pointer-events-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/25 text-base font-black uppercase text-white backdrop-blur active:bg-white/40">
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
  t: number,
  shake: number,
  active: string[],
  myKey: string,
  remote: Record<string, { x: number; y: number; facing: 1 | -1; anim: RemoteSnap['anim'] }>,
  nameOf: (key: string) => string,
  colorOf: (key: string, fallback?: number) => string,
  myColor: number,
  size: { w: number; h: number },
  dpr: number,
) {
  const { w, h } = size;
  ctx.save();
  ctx.scale(dpr, dpr);

  const scale = h / VIEW_H;
  const viewW = w / scale;
  let camX = Math.max(0, Math.min(WORLD_W - viewW, me.x - viewW / 2));
  if (shake > 0) camX += (Math.random() - 0.5) * 10 * shake;
  const camY = shake > 0 ? (Math.random() - 0.5) * 6 * shake : 0;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-camX, -camY);

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = sky;
  ctx.fillRect(camX, 0, viewW, VIEW_H);

  // Distant stars/dots for depth.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 211) % WORLD_W;
    const y = (i * 97) % 220;
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
      if (o.type === 'moving') {
        grad.addColorStop(0, '#818cf8');
        grad.addColorStop(1, '#4f46e5');
      } else {
        grad.addColorStop(0, '#94a3b8');
        grad.addColorStop(1, '#475569');
      }
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
      g.addColorStop(0, '#fca5a5');
      g.addColorStop(1, '#dc2626');
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, o.ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    } else if (o.type === 'spinner') {
      if (o.cx < camX - 150 || o.cx > camX + viewW + 150) continue;
      const seg = spinnerSegmentAt(o, t);
      ctx.strokeStyle = '#fbbf24';
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
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#f8fafc' : '#1e293b';
      ctx.fillRect(FINISH_X, 160 + i * 28, 14, 28);
    }
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(FINISH_X + 6, 60, 4, 460);
  }

  // Remote players.
  for (const key of active) {
    if (key === myKey) continue;
    const r = remote[key];
    if (!r) continue;
    drawPlayer(ctx, r.x, r.y, colorOf(key), nameOf(key), r.facing, r.anim, false);
  }

  // Local player on top.
  const myAnim: RemoteSnap['anim'] = meFinished ? 'finished' : !me.grounded ? (me.hitCooldownUntil > t ? 'hit' : 'air') : Math.abs(me.vx) > 20 ? 'run' : 'idle';
  drawPlayer(ctx, me.x, me.y, colorOf(myKey, myColor), nameOf(myKey), me.vx < 0 ? -1 : 1, myAnim, true);

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
  const squash = anim === 'air' ? 0.9 : anim === 'hit' ? 1.15 : 1;
  const bob = anim === 'run' ? Math.sin(performance.now() / 70) * 3 : 0;
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

  // Eyes, offset toward facing direction.
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(facing * 6, -4, 3, 0, Math.PI * 2);
  ctx.arc(facing * 11, -4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.font = '700 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(name, x, cy - PLAYER_RADIUS - 10 + 1);
  ctx.fillStyle = '#fff';
  ctx.fillText(name, x, cy - PLAYER_RADIUS - 10);
}
