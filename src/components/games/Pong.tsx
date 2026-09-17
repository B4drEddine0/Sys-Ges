import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';

const ARENA_W = 800;
const ARENA_H = 500;
const PADDLE_W = 12;
const PADDLE_H = 100;
const BALL_SIZE = 14;
const MAX_SCORE = 5;

const playSound = (type: 'hit' | 'wall' | 'score') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    if (type === 'hit') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
    } else if (type === 'wall') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
    } else if (type === 'score') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);
    }
    
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (type === 'score' ? 0.5 : 0.1));
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (type === 'score' ? 0.5 : 0.1));
  } catch(e) {}
};

export function Pong({ local, channel, isHost }: { local: boolean, channel?: any, isHost?: boolean }) {
  const [scores, setScores] = useState({ host: 0, guest: 0 });
  const [winner, setWinner] = useState<'host' | 'guest' | null>(null);
  const [restartRequestedBy, setRestartRequestedBy] = useState<'host' | 'guest' | null>(null);
  const [gameStarted, setGameStarted] = useState(false);

  const reqRef = useRef<number>(0);
  const arenaRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const guestRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);

  const s = useRef({
    ball: { x: ARENA_W / 2, y: ARENA_H / 2, vx: 0, vy: 0, speed: 6 },
    hostY: ARENA_H / 2 - PADDLE_H / 2,
    guestY: ARENA_H / 2 - PADDLE_H / 2,
    playing: false,
  });

  const me = isHost ? 'host' : 'guest';
  const lastPaddleSent = useRef(0);

  const updateDOM = useCallback(() => {
    if (!hostRef.current || !guestRef.current || !ballRef.current) return;
    
    // Use percentages for responsive scaling
    const hY = (s.current.hostY / ARENA_H) * 100;
    const gY = (s.current.guestY / ARENA_H) * 100;
    const bX = (s.current.ball.x / ARENA_W) * 100;
    const bY = (s.current.ball.y / ARENA_H) * 100;

    hostRef.current.style.top = `${hY}%`;
    guestRef.current.style.top = `${gY}%`;
    ballRef.current.style.left = `${bX}%`;
    ballRef.current.style.top = `${bY}%`;
  }, []);

  const launchBall = useCallback(() => {
    const dirX = Math.random() > 0.5 ? 1 : -1;
    const dirY = (Math.random() - 0.5) * 2;
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    
    s.current.ball = {
      x: ARENA_W / 2,
      y: ARENA_H / 2,
      speed: 7,
      vx: (dirX / len) * 7,
      vy: (dirY / len) * 7,
    };
    s.current.playing = true;
    
    if (!local && isHost && channel) {
      channel.send({ type: 'broadcast', event: 'pong_launch', payload: s.current.ball });
    }
  }, [local, isHost, channel]);

  const handleScore = useCallback((player: 'host' | 'guest') => {
    playSound('score');
    s.current.playing = false;
    
    setScores(prev => {
      const newScores = { ...prev, [player]: prev[player] + 1 };
      
      if (newScores[player] >= MAX_SCORE) {
        setWinner(player);
      } else {
        setTimeout(() => {
          // Double check if a restart wasn't triggered in the meantime
          if (!s.current.playing && !winner) launchBall();
        }, 1500);
      }
      
      if (!local && isHost && channel) {
        channel.send({ 
          type: 'broadcast', 
          event: 'pong_score', 
          payload: { scores: newScores, winner: newScores[player] >= MAX_SCORE ? player : null } 
        });
      }
      return newScores;
    });
  }, [local, isHost, channel, launchBall, winner]);

  // Main game loop
  const loop = useCallback(() => {
    if (s.current.playing) {
      let b = s.current.ball;
      b.x += b.vx;
      b.y += b.vy;

      // Wall bounce
      if (b.y <= 0) { b.y = 0; b.vy *= -1; playSound('wall'); }
      if (b.y >= ARENA_H - BALL_SIZE) { b.y = ARENA_H - BALL_SIZE; b.vy *= -1; playSound('wall'); }

      // Host handles physics and scoring
      if (local || isHost) {
        if (b.x <= 0) {
          handleScore('guest');
        } else if (b.x >= ARENA_W - BALL_SIZE) {
          handleScore('host');
        }

        // Host Paddle Collision (Left)
        if (b.vx < 0 && b.x <= 40 + PADDLE_W && b.x + BALL_SIZE >= 40 && b.y + BALL_SIZE >= s.current.hostY && b.y <= s.current.hostY + PADDLE_H) {
          b.x = 40 + PADDLE_W;
          handlePaddleHit(s.current.hostY);
        }
        // Guest Paddle Collision (Right)
        else if (b.vx > 0 && b.x + BALL_SIZE >= ARENA_W - 40 - PADDLE_W && b.x <= ARENA_W - 40 && b.y + BALL_SIZE >= s.current.guestY && b.y <= s.current.guestY + PADDLE_H) {
          b.x = ARENA_W - 40 - PADDLE_W - BALL_SIZE;
          handlePaddleHit(s.current.guestY);
        }
      }
    }
    
    updateDOM();
    reqRef.current = requestAnimationFrame(loop);
  }, [local, isHost, handleScore, updateDOM]);

  const handlePaddleHit = (paddleY: number) => {
    playSound('hit');
    let b = s.current.ball;
    
    b.vx *= -1; // Reflect X
    b.speed = Math.min(b.speed * 1.15, 22); // Increase speed, max out at 22
    
    // Add "english" / spin based on hit position
    let relativeY = (b.y + BALL_SIZE / 2) - (paddleY + PADDLE_H / 2);
    let normalizedRelativeY = relativeY / (PADDLE_H / 2); // -1 to 1
    let bounceAngle = normalizedRelativeY * (Math.PI / 4); // Max 45 degrees
    
    let direction = b.vx > 0 ? 1 : -1;
    b.vx = direction * b.speed * Math.cos(bounceAngle);
    b.vy = b.speed * Math.sin(bounceAngle);
    
    if (!local && isHost && channel) {
      channel.send({ type: 'broadcast', event: 'pong_ball_sync', payload: b });
    }
  };

  useEffect(() => {
    reqRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqRef.current!);
  }, [loop]);

  // Online subs
  useEffect(() => {
    if (local || !channel) return;
    
    const s1 = channel.on('broadcast', { event: 'pong_launch' }, ({ payload }: any) => {
      s.current.ball = payload;
      s.current.playing = true;
      setGameStarted(true);
    });
    const s2 = channel.on('broadcast', { event: 'pong_ball_sync' }, ({ payload }: any) => {
      s.current.ball = payload;
      playSound('hit');
    });
    const s3 = channel.on('broadcast', { event: 'pong_paddle' }, ({ payload }: any) => {
      if (payload.player === 'host' && !isHost) s.current.hostY = payload.y;
      if (payload.player === 'guest' && isHost) s.current.guestY = payload.y;
    });
    const s4 = channel.on('broadcast', { event: 'pong_score' }, ({ payload }: any) => {
      if (!isHost) {
        playSound('score');
        s.current.playing = false;
        setScores(payload.scores);
        setWinner(payload.winner);
      }
    });
    const s5 = channel.on('broadcast', { event: 'pong_req_restart' }, ({ payload }: any) => {
      setRestartRequestedBy(payload.by);
    });
    const s6 = channel.on('broadcast', { event: 'pong_acc_restart' }, () => {
      executeRestart();
    });
    const s7 = channel.on('broadcast', { event: 'pong_dec_restart' }, () => {
      setRestartRequestedBy(null);
    });

    return () => {};
  }, [local, channel, isHost]);

  const broadcastPaddle = useCallback((y: number) => {
    const now = Date.now();
    if (now - lastPaddleSent.current > 50) {
      lastPaddleSent.current = now;
      if (channel) {
        channel.send({ type: 'broadcast', event: 'pong_paddle', payload: { player: isHost ? 'host' : 'guest', y } });
      }
    }
  }, [channel, isHost]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!arenaRef.current || !gameStarted || winner) return;
    
    const rect = arenaRef.current.getBoundingClientRect();
    const scaleY = ARENA_H / rect.height;
    
    let y = (e.clientY - rect.top) * scaleY - PADDLE_H / 2;
    y = Math.max(0, Math.min(y, ARENA_H - PADDLE_H));

    if (local) {
      const isLeft = (e.clientX - rect.left) < rect.width / 2;
      if (isLeft) {
        s.current.hostY = y;
      } else {
        s.current.guestY = y;
      }
    } else {
      if (isHost) {
        s.current.hostY = y;
        broadcastPaddle(y);
      } else {
        s.current.guestY = y;
        broadcastPaddle(y);
      }
    }
  }, [local, isHost, gameStarted, winner, broadcastPaddle]);

  const executeRestart = useCallback(() => {
    setScores({ host: 0, guest: 0 });
    setWinner(null);
    setRestartRequestedBy(null);
    setGameStarted(true);
    s.current.hostY = ARENA_H / 2 - PADDLE_H / 2;
    s.current.guestY = ARENA_H / 2 - PADDLE_H / 2;
    updateDOM();
    if (local || isHost) {
      setTimeout(launchBall, 500);
    }
  }, [local, isHost, launchBall, updateDOM]);

  const requestRestart = () => {
    if (local) {
      executeRestart();
    } else {
      setRestartRequestedBy(me);
      if (channel) channel.send({ type: 'broadcast', event: 'pong_req_restart', payload: { by: me } });
    }
  };

  const acceptRestart = () => {
    executeRestart();
    if (channel) channel.send({ type: 'broadcast', event: 'pong_acc_restart' });
  };

  const declineRestart = () => {
    setRestartRequestedBy(null);
    if (channel) channel.send({ type: 'broadcast', event: 'pong_dec_restart' });
  };

  const handleStartGame = () => {
    setGameStarted(true);
    if (local || isHost) {
      setTimeout(launchBall, 500);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 md:p-8 bg-card rounded-3xl border border-border shadow-md w-full max-w-4xl mx-auto">
      <div className="text-center space-y-1">
        <h3 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-rose-500">
          NEON PONG
        </h3>
        <p className="text-muted-foreground text-sm font-semibold uppercase tracking-widest">First to {MAX_SCORE} Wins</p>
      </div>

      {/* Arena */}
      <div 
        ref={arenaRef}
        onPointerMove={handlePointerMove}
        className="relative bg-zinc-950 border-4 border-zinc-900 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden cursor-crosshair touch-none rounded-xl"
        style={{ width: '100%', aspectRatio: '8/5', maxHeight: '60vh' }}
      >
        {/* Center line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-[4px] -translate-x-1/2 border-l-[4px] border-dashed border-zinc-800 pointer-events-none" />
        
        {/* Background Scores */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05] text-[20vw] md:text-[15rem] font-black font-mono text-white select-none">
          <div className="flex-1 text-center">{scores.host}</div>
          <div className="flex-1 text-center">{scores.guest}</div>
        </div>

        {/* Start Overlay */}
        {!gameStarted && !winner && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-30 text-white">
            <h2 className="text-4xl font-black mb-6 uppercase tracking-widest text-primary drop-shadow-[0_0_15px_rgba(var(--primary),1)]">Ready?</h2>
            {(!local && !isHost) ? (
              <p className="animate-pulse font-semibold tracking-widest uppercase">Waiting for Host to Start...</p>
            ) : (
              <Button size="lg" className="text-lg px-12 py-6 rounded-full font-black tracking-widest hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.2)]" onClick={handleStartGame}>
                START MATCH
              </Button>
            )}
            <p className="mt-8 text-sm font-semibold text-zinc-400 max-w-sm text-center">
              {local ? "Drag on the left or right side to move your paddle." : "Drag anywhere in the arena to move your paddle."}
            </p>
          </div>
        )}

        {/* Paddles & Ball */}
        <div 
          ref={hostRef} 
          className="absolute left-[40px] w-[12px] h-[100px] bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)] rounded-full pointer-events-none" 
          style={{ height: `${(PADDLE_H / ARENA_H) * 100}%`, width: `${(PADDLE_W / ARENA_W) * 100}%`, left: `${(40 / ARENA_W) * 100}%` }}
        />
        <div 
          ref={guestRef} 
          className="absolute right-[40px] w-[12px] h-[100px] bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.8)] rounded-full pointer-events-none" 
          style={{ height: `${(PADDLE_H / ARENA_H) * 100}%`, width: `${(PADDLE_W / ARENA_W) * 100}%`, right: `${(40 / ARENA_W) * 100}%` }}
        />
        <div 
          ref={ballRef} 
          className="absolute w-[14px] h-[14px] bg-white shadow-[0_0_20px_rgba(255,255,255,1)] rounded-full pointer-events-none" 
          style={{ height: `${(BALL_SIZE / ARENA_H) * 100}%`, width: `${(BALL_SIZE / ARENA_W) * 100}%` }}
        />

        {/* Winner Overlay */}
        <AnimatePresence>
          {winner && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 z-40"
            >
              <motion.div 
                initial={{ scale: 0.5, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="text-center space-y-4"
              >
                <div className="text-6xl mb-4">🏆</div>
                <h2 className={`text-5xl font-black uppercase tracking-widest drop-shadow-[0_0_20px_currentColor] ${winner === 'host' ? 'text-blue-500' : 'text-rose-500'}`}>
                  {local ? (winner === 'host' ? 'Blue Wins!' : 'Red Wins!') : (winner === me ? 'You Win!' : 'You Lose!')}
                </h2>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Restart Overlay */}
        {!local && restartRequestedBy && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center z-50">
            {restartRequestedBy === me ? (
              <p className="font-semibold text-lg animate-pulse text-white uppercase tracking-widest">Waiting for opponent...</p>
            ) : (
              <div className="space-y-6">
                <p className="font-bold text-xl text-white uppercase tracking-widest">Opponent wants to play again</p>
                <div className="flex gap-4 justify-center">
                  <Button size="lg" onClick={acceptRestart} className="gap-2 bg-green-500 hover:bg-green-600 text-white font-black"><Check className="h-5 w-5"/> ACCEPT</Button>
                  <Button size="lg" variant="destructive" onClick={declineRestart} className="gap-2 font-black"><X className="h-5 w-5"/> DECLINE</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex w-full items-center justify-between mt-2 max-w-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
          <span className="font-bold uppercase tracking-widest text-sm">{local ? 'Blue' : isHost ? 'You (Blue)' : 'Opponent'}</span>
        </div>
        
        <Button 
          variant="secondary" 
          className="font-black uppercase tracking-widest px-8"
          onClick={requestRestart}
          disabled={!!restartRequestedBy || (!winner && gameStarted)}
        >
          {winner ? "Play Again" : "Reset Match"}
        </Button>
        
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-widest text-sm">{local ? 'Red' : !isHost ? 'You (Red)' : 'Opponent'}</span>
          <div className="w-4 h-4 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]" />
        </div>
      </div>
    </div>
  );
}
