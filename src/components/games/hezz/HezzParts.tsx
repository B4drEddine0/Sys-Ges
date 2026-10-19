import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PartyPopper } from 'lucide-react';
import { RANK_LABEL, SUIT_LABEL, type Card, type Suit } from './hezzLogic';

export const SEAT_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308'];
export const colorFor = (i: number) => SEAT_COLORS[i % SEAT_COLORS.length];

const SUIT_COLOR: Record<Suit, string> = { dhab: '#b45309', kas: '#be123c', sif: '#334155', asa: '#166534' };

export function HezzCard({
  card,
  size = 'md',
  faceDown = false,
  disabled = false,
  selected = false,
  onClick,
}: {
  card?: Card;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const dims = size === 'lg' ? 'h-32 w-22 md:h-36 md:w-24' : size === 'sm' ? 'h-14 w-10' : 'h-20 w-14';
  if (faceDown || !card) {
    return (
      <div
        className={`${dims} shrink-0 rounded-lg border-2 border-amber-300/40 shadow-md`}
        style={{
          background: 'repeating-linear-gradient(45deg, #0f4c3a, #0f4c3a 6px, #136b4f 6px, #136b4f 12px)',
        }}
      />
    );
  }
  const color = SUIT_COLOR[card.suit];
  const label = SUIT_LABEL[card.suit];
  return (
    <button
      type="button"
      disabled={!onClick || disabled}
      onClick={onClick}
      className={`${dims} relative shrink-0 rounded-lg border-2 bg-[#fdf6e3] font-black shadow-md transition-all ${
        onClick && !disabled ? 'cursor-pointer hover:-translate-y-2 hover:shadow-xl active:translate-y-0' : onClick ? 'cursor-not-allowed opacity-40 grayscale' : ''
      } ${selected ? '-translate-y-3 ring-4 ring-offset-1' : ''}`}
      style={{ borderColor: `${color}55`, ...(selected ? ({ ['--tw-ring-color' as string]: color } as React.CSSProperties) : {}) }}
    >
      <span className="absolute left-1 top-0.5 flex flex-col items-center leading-none" style={{ color }}>
        <span className={size === 'lg' ? 'text-lg' : 'text-xs'}>{RANK_LABEL[card.rank]}</span>
        <span className={size === 'lg' ? 'text-sm' : 'text-[9px]'}>{label.icon}</span>
      </span>
      <span className={`flex h-full items-center justify-center ${size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-lg' : 'text-2xl'}`} style={{ color }}>
        {label.icon}
      </span>
      <span className="absolute bottom-0.5 right-1 rotate-180 flex flex-col items-center leading-none" style={{ color }}>
        <span className={size === 'lg' ? 'text-lg' : 'text-xs'}>{RANK_LABEL[card.rank]}</span>
        <span className={size === 'lg' ? 'text-sm' : 'text-[9px]'}>{label.icon}</span>
      </span>
    </button>
  );
}

export function Seat({ name, color, me, finished, finishOrder, connected, active, handCount }: {
  name: string;
  color: number;
  me?: boolean;
  finished?: boolean;
  finishOrder?: number | null;
  connected: boolean;
  active?: boolean;
  handCount: number;
}) {
  const c = colorFor(color);
  return (
    <motion.div
      layout
      animate={{ opacity: finished ? 0.55 : 1, scale: active ? 1.05 : 1, saturate: finished ? 0.6 : 1 } as any}
      className="flex flex-col items-center gap-1"
    >
      <div className="relative">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full font-extrabold text-white shadow-md"
          style={{ background: c, boxShadow: active ? `0 0 0 3px rgb(var(--card)), 0 0 0 5px ${c}` : undefined, filter: finished ? 'grayscale(0.5)' : undefined }}
        >
          {name[0]?.toUpperCase() ?? '?'}
        </span>
        {finished && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-amber-950 shadow">
            #{finishOrder}
          </span>
        )}
        {!connected && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-muted-foreground ring-2 ring-background" />}
      </div>
      <span className="max-w-16 truncate text-xs font-bold">{me ? 'You' : name}</span>
      {!finished && <span className="text-[10px] font-bold text-muted-foreground">{handCount} card{handCount === 1 ? '' : 's'}</span>}
      {finished && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Finished</span>}
    </motion.div>
  );
}

// ---------------------------------------------------------------- celebration

let audioCtx: AudioContext | null = null;
function playClap() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    // A few short filtered noise bursts, staggered — reads as a little round of applause
    // without needing an audio asset file.
    for (let i = 0; i < 5; i++) {
      const t = now + i * 0.07 + Math.random() * 0.02;
      const bufferSize = ctx.sampleRate * 0.06;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / bufferSize);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800 + Math.random() * 800;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.1);
    }
  } catch {
    // Audio is a nice-to-have; never let it break the game.
  }
}

const SOUND_KEY = 'hezz_sound_muted';

export function useSoundMuted(): [boolean, (v: boolean) => void] {
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SOUND_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [muted]);
  return [muted, setMuted];
}

interface CelebrationItem {
  id: string;
  name: string;
  color: number;
}

/** Queues finish celebrations so simultaneous finishes animate one at a time instead of overlapping into noise. */
export function useFinishCelebrations(muted: boolean) {
  const [current, setCurrent] = useState<CelebrationItem | null>(null);
  const queueRef = useRef<CelebrationItem[]>([]);
  const reduceMotion = useReducedMotion();

  const push = (item: CelebrationItem) => {
    queueRef.current.push(item);
    pump();
  };

  const pump = () => {
    setCurrent((cur) => {
      if (cur) return cur;
      const next = queueRef.current.shift();
      if (!next) return null;
      if (!muted) playClap();
      const duration = reduceMotion ? 1200 : 2200;
      setTimeout(() => {
        setCurrent(null);
        setTimeout(pump, 50);
      }, duration);
      return next;
    });
  };

  return { current, push };
}

export function CelebrationOverlay({ item }: { item: CelebrationItem | null }) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key={item.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-black/30" />
          {!reduceMotion &&
            Array.from({ length: 28 }).map((_, i) => {
              const angle = (i / 28) * Math.PI * 2;
              const dist = 120 + Math.random() * 140;
              const colors = ['#fbbf24', '#f43f5e', '#10b981', '#0ea5e9', '#f8fafc'];
              return (
                <motion.span
                  key={i}
                  className="absolute h-2 w-3 rounded-sm"
                  style={{ background: colors[i % colors.length] }}
                  initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                  animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 40, opacity: 0, rotate: 360 }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                />
              );
            })}
          <motion.div
            initial={{ scale: 0.4, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', bounce: 0.55 }}
            className="relative flex flex-col items-center gap-2 rounded-3xl p-6 text-white shadow-2xl"
            style={{ background: colorFor(item.color) }}
          >
            <motion.div animate={reduceMotion ? {} : { rotate: [0, -15, 15, -10, 10, 0] }} transition={{ duration: 0.8, repeat: 1 }}>
              <PartyPopper className="h-10 w-10" />
            </motion.div>
            <p className="text-xl font-black">{item.name.toUpperCase()} HAS FINISHED!</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
