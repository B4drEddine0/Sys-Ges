import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, WifiOff } from 'lucide-react';
import { PLAYER_COLORS, type HarfPlayer, type HarfState } from './harfLogic';

export const colorOf = (p: HarfPlayer | undefined) => PLAYER_COLORS[(p?.color ?? 0) % PLAYER_COLORS.length];

export function PlayerAvatar({ player, size = 40, ring = false }: { player: HarfPlayer; size?: number; ring?: boolean }) {
  const c = colorOf(player);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-white select-none"
      style={{
        width: size,
        height: size,
        background: c,
        fontSize: size * 0.45,
        boxShadow: ring ? `0 0 0 3px rgb(var(--card)), 0 0 0 5px ${c}` : undefined,
        opacity: player.connected ? 1 : 0.45,
      }}
    >
      {[...player.name][0] ?? '؟'}
    </span>
  );
}

/** Ticks while `active`, so countdowns re-render without each screen owning an interval. */
export function useTick(active = true, ms = 200) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [active, ms]);
}

export function useCountUp(from: number, to: number, ms = 900, delay = 0) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : from);
  useEffect(() => {
    if (reduce || from === to) {
      setV(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now() + delay;
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / ms));
      setV(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, ms, delay, reduce]);
  return v;
}

export function TypingDots({ color }: { color?: string }) {
  return (
    <span className="inline-flex items-end gap-0.5 h-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full motion-safe:animate-bounce"
          style={{ background: color ?? 'currentColor', animationDelay: `${i * 130}ms` }}
        />
      ))}
    </span>
  );
}

/** Compact "who's done / who's still writing" strip driven by the shared room state. */
export function PlayerStatus({ state, myKey }: { state: HarfState; myKey: string }) {
  const playing = state.phase === 'playing';
  return (
    <div className="flex flex-wrap gap-2">
      {state.players.map((p) => {
        const inRound = state.active.includes(p.key);
        const done = !!state.submitted[p.key];
        const count = state.progress[p.key] ?? 0;
        const c = colorOf(p);
        let label = '';
        let tone = 'text-muted-foreground';
        if (!p.connected) label = 'غير متصل';
        else if (playing && !inRound) label = 'ينتظر الجولة القادمة';
        else if (playing && done) {
          label = 'خلّص';
          tone = 'text-emerald-600 dark:text-emerald-400';
        } else if (playing) {
          label = count > 0 ? `يكتب… ${count}/7` : 'يكتب…';
          tone = 'text-amber-600 dark:text-amber-400';
        }
        return (
          <motion.div
            key={p.key}
            layout
            className="flex items-center gap-2 rounded-full bg-muted/70 py-1 ps-1 pe-3"
            style={done && playing ? { background: `${c}22` } : undefined}
          >
            <PlayerAvatar player={p} size={30} ring={p.key === myKey} />
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-bold">{p.key === myKey ? 'أنت' : p.name}</span>
              {label && (
                <span className={`flex items-center gap-1 text-[11px] font-semibold ${tone}`}>
                  {!p.connected ? (
                    <WifiOff className="h-3 w-3" />
                  ) : done ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
                      <Check className="h-3 w-3" />
                    </motion.span>
                  ) : playing && inRound ? (
                    <TypingDots />
                  ) : null}
                  {label}
                </span>
              )}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

export function LetterBadge({ letter, size = 'md' }: { letter: string; size?: 'md' | 'lg' | 'xl' }) {
  const cls = size === 'xl' ? 'h-40 w-40 text-9xl' : size === 'lg' ? 'h-24 w-24 text-6xl' : 'h-16 w-16 text-4xl';
  return (
    <div className={`${cls} flex items-center justify-center rounded-[28%] font-black text-white shadow-lg`} style={{ background: '#6d5efc' }}>
      <span className="-mt-[6%]">{letter}</span>
    </div>
  );
}

export function useLatest<T>(v: T) {
  const r = useRef(v);
  r.current = v;
  return r;
}
