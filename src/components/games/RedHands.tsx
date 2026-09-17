import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Hand } from 'lucide-react';

export function RedHands({ local, channel, isHost }: { local: boolean, channel?: any, isHost?: boolean }) {
  const MAX_SCORE = 5;
  const SLAP_WINDOW_MS = 350;

  type Role = 'host' | 'guest';
  type GameState = 'idle' | 'slapping' | 'dodged' | 'hit' | 'flinched';

  const [scores, setScores] = useState({ host: 0, guest: 0 });
  const [attacker, setAttacker] = useState<Role>('host');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [winner, setWinner] = useState<Role | null>(null);
  const [restartRequestedBy, setRestartRequestedBy] = useState<Role | null>(null);
  
  const stateRef = useRef({ scores, attacker, gameState, winner });
  useEffect(() => {
    stateRef.current = { scores, attacker, gameState, winner };
  }, [scores, attacker, gameState, winner]);

  const slapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const me: Role = isHost ? 'host' : 'guest';

  // Online Real-time Subscriptions
  useEffect(() => {
    if (local || !channel) return;
    
    const stateSub = channel.on('broadcast', { event: 'redhands_state' }, (payload: any) => {
      if (!isHost) {
        setScores(payload.payload.scores);
        setAttacker(payload.payload.attacker);
        setGameState(payload.payload.gameState);
        setWinner(payload.payload.winner);
      }
    });

    const actionSub = channel.on('broadcast', { event: 'redhands_action' }, (payload: any) => {
      if (isHost) {
        handleAction(payload.payload.player);
      }
    });

    const reqSub = channel.on('broadcast', { event: 'redhands_restart_req' }, (payload: any) => {
      setRestartRequestedBy(payload.payload.by);
    });
    
    const accSub = channel.on('broadcast', { event: 'redhands_restart_accept' }, () => {
      doRestart();
    });
    
    const decSub = channel.on('broadcast', { event: 'redhands_restart_decline' }, () => {
      setRestartRequestedBy(null);
    });

    return () => {};
  }, [local, channel, isHost]);

  const updateState = (newState: Partial<typeof stateRef.current>) => {
    if (newState.scores) setScores(newState.scores);
    if (newState.attacker) setAttacker(newState.attacker);
    if (newState.gameState) setGameState(newState.gameState);
    if (newState.winner !== undefined) setWinner(newState.winner);
    
    if (!local && isHost && channel) {
      channel.send({
        type: 'broadcast',
        event: 'redhands_state',
        payload: { ...stateRef.current, ...newState }
      });
    }
  };

  const scheduleReset = () => {
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => {
      if (!stateRef.current.winner) {
        updateState({ gameState: 'idle' });
      }
    }, 1500);
  };

  const handleAction = (player: Role) => {
    const { attacker, gameState, scores, winner } = stateRef.current;
    
    if (winner || restartRequestedBy) return;

    if (player === attacker) {
      // Attacker slaps
      if (gameState === 'idle') {
        updateState({ gameState: 'slapping' });
        
        slapTimeoutRef.current = setTimeout(() => {
          if (stateRef.current.gameState === 'slapping') {
            const newScores = { ...stateRef.current.scores };
            newScores[player]++;
            const newWinner = newScores[player] >= MAX_SCORE ? player : null;
            
            updateState({ 
              gameState: 'hit', 
              scores: newScores, 
              winner: newWinner 
            });
            scheduleReset();
          }
        }, SLAP_WINDOW_MS);
      }
    } else {
      // Defender dodges
      if (gameState === 'slapping') {
        if (slapTimeoutRef.current) clearTimeout(slapTimeoutRef.current);
        
        updateState({ 
          gameState: 'dodged', 
          attacker: player // roles swap
        });
        scheduleReset();
      } else if (gameState === 'idle') {
        const newScores = { ...scores };
        newScores[attacker]++;
        const newWinner = newScores[attacker] >= MAX_SCORE ? attacker : null;
        
        updateState({
          gameState: 'flinched',
          scores: newScores,
          winner: newWinner
        });
        scheduleReset();
      }
    }
  };

  const triggerAction = (player: Role) => {
    if (winner || restartRequestedBy) return;
    if (stateRef.current.gameState !== 'idle' && stateRef.current.gameState !== 'slapping') return;

    if (!local && !isHost) {
      channel.send({ type: 'broadcast', event: 'redhands_action', payload: { player } });
      return;
    }
    handleAction(player);
  };

  // Keyboard support for local play
  useEffect(() => {
    if (!local) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') triggerAction('guest'); // Top player uses W
      if (e.code === 'ArrowUp') triggerAction('host'); // Bottom player uses Up Arrow
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [local, triggerAction]);

  const doRestart = () => {
    setScores({ host: 0, guest: 0 });
    setAttacker('host');
    setGameState('idle');
    setWinner(null);
    setRestartRequestedBy(null);
    if (slapTimeoutRef.current) clearTimeout(slapTimeoutRef.current);
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
  };

  const handleRestartClick = () => {
    if (local) {
      doRestart();
    } else {
      setRestartRequestedBy(me);
      if (channel) {
        channel.send({ type: 'broadcast', event: 'redhands_restart_req', payload: { by: me } });
      }
    }
  };

  const acceptRestart = () => {
    doRestart();
    if (channel) {
      channel.send({ type: 'broadcast', event: 'redhands_restart_accept' });
    }
  };

  const declineRestart = () => {
    setRestartRequestedBy(null);
    if (channel) {
      channel.send({ type: 'broadcast', event: 'redhands_restart_decline' });
    }
  };

  const getHandAnimation = (player: Role) => {
    const isAttacker = player === attacker;
    
    if (gameState === 'idle') {
       return { y: 0, scale: 1, rotate: player === 'guest' ? 180 : 0 };
    }
    if (gameState === 'slapping') {
       if (isAttacker) return { y: player === 'guest' ? 100 : -100, scale: 1.2, rotate: player === 'guest' ? 180 : 0 };
       return { y: 0, scale: 1, rotate: player === 'guest' ? 180 : 0 };
    }
    if (gameState === 'dodged') {
       if (isAttacker) return { y: player === 'guest' ? 130 : -130, scale: 1.2, rotate: player === 'guest' ? 180 : 0 };
       return { y: player === 'guest' ? -60 : 60, scale: 0.9, rotate: player === 'guest' ? 180 : 0 };
    }
    if (gameState === 'hit') {
       if (isAttacker) return { y: player === 'guest' ? 90 : -90, scale: 1.1, rotate: player === 'guest' ? 180 : 0 };
       return { y: player === 'guest' ? 20 : -20, scale: 0.95, rotate: player === 'guest' ? 170 : 10, x: [-10, 10, -10, 10, 0] };
    }
    if (gameState === 'flinched') {
       if (isAttacker) return { y: 0, scale: 1, rotate: player === 'guest' ? 180 : 0 };
       return { y: player === 'guest' ? -60 : 60, scale: 0.9, rotate: player === 'guest' ? 180 : 0 };
    }
    return {};
  };

  return (
    <motion.div 
      animate={winner ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-6 p-6 md:p-8 bg-card rounded-3xl border border-border shadow-md w-full max-w-2xl mx-auto"
    >
      <div className="text-center space-y-1">
        <h3 className="text-2xl font-bold tracking-tight">Red Hands (Slap!)</h3>
        <p className="text-muted-foreground text-sm">First to {MAX_SCORE} wins. Tap your side to {attacker === me || local ? 'Slap or Dodge' : 'act'}!</p>
      </div>

      <div className="relative w-full h-[400px] md:h-[500px] border-4 border-border rounded-3xl overflow-hidden flex flex-col bg-muted/10 select-none touch-manipulation">
        
        {/* Guest Area (Top) */}
        <div 
          className={`flex-1 border-b-2 border-dashed border-border flex items-start justify-center relative p-8 transition-colors ${local || me === 'guest' ? 'cursor-pointer hover:bg-rose-500/5 active:bg-rose-500/10' : ''}`}
          onPointerDown={() => (local ? triggerAction('guest') : (!isHost && triggerAction('guest')))}
        >
          <div className="absolute top-4 left-6 flex flex-col items-start">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{local ? 'Player 2 (W)' : 'Guest'}</span>
            <span className="text-3xl font-black text-rose-500">{scores.guest}</span>
          </div>
          
          <div className="absolute top-4 right-6 text-sm font-bold text-rose-500/50 uppercase tracking-widest">
            {attacker === 'guest' ? 'Attacker' : 'Defender'}
          </div>

          <motion.div
            animate={getHandAnimation('guest')}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`text-rose-500 ${attacker === 'guest' ? 'z-10' : 'z-0'}`}
          >
            <Hand size={120} className="drop-shadow-lg" fill="currentColor" fillOpacity={0.2} strokeWidth={1.5} />
          </motion.div>
        </div>
        
        {/* Host Area (Bottom) */}
        <div 
          className={`flex-1 flex items-end justify-center relative p-8 transition-colors ${local || me === 'host' ? 'cursor-pointer hover:bg-blue-500/5 active:bg-blue-500/10' : ''}`}
          onPointerDown={() => (local ? triggerAction('host') : (isHost && triggerAction('host')))}
        >
          <div className="absolute bottom-4 right-6 flex flex-col items-end">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{local ? 'Player 1 (Up)' : 'Host'}</span>
            <span className="text-3xl font-black text-blue-500">{scores.host}</span>
          </div>

          <div className="absolute bottom-4 left-6 text-sm font-bold text-blue-500/50 uppercase tracking-widest">
            {attacker === 'host' ? 'Attacker' : 'Defender'}
          </div>

          <motion.div
            animate={getHandAnimation('host')}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`text-blue-500 ${attacker === 'host' ? 'z-10' : 'z-0'}`}
          >
            <Hand size={120} className="drop-shadow-lg" fill="currentColor" fillOpacity={0.2} strokeWidth={1.5} />
          </motion.div>
        </div>

        {/* Center Status Effects */}
        <AnimatePresence>
          {gameState !== 'idle' && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0, x: '-50%', y: '-50%' }}
              animate={{ scale: 1, opacity: 1, x: '-50%', y: '-50%', rotate: [-5, 5, -5, 0] }}
              exit={{ scale: 1.5, opacity: 0, x: '-50%', y: '-50%' }}
              transition={{ duration: 0.3 }}
              className={`absolute top-1/2 left-1/2 font-black text-5xl md:text-6xl uppercase italic tracking-tighter drop-shadow-2xl z-20 pointer-events-none
                ${gameState === 'hit' ? 'text-red-500' : gameState === 'dodged' ? 'text-green-500' : 'text-amber-500'}
              `}
              style={{ textShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
            >
              {gameState === 'hit' && 'BAM!'}
              {gameState === 'dodged' && 'SWISH!'}
              {gameState === 'flinched' && 'FLINCH!'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Winner Overlay */}
        <AnimatePresence>
          {winner && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-30"
            >
              <motion.div 
                initial={{ scale: 0.5, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="text-center space-y-4"
              >
                <div className="text-6xl mb-4">🏆</div>
                <h2 className={`text-4xl font-black uppercase tracking-widest ${winner === 'host' ? 'text-blue-500' : 'text-rose-500'}`}>
                  {local ? (winner === 'host' ? 'Player 1' : 'Player 2') : (winner === me ? 'You Win!' : 'You Lose!')}
                </h2>
                <p className="text-muted-foreground font-semibold">Final Score: {scores.host} - {scores.guest}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Restart Request Overlay */}
        {!local && restartRequestedBy && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-40">
            {restartRequestedBy === me ? (
              <p className="font-semibold text-sm animate-pulse text-foreground">Waiting for opponent to accept...</p>
            ) : (
              <div className="space-y-4">
                <p className="font-semibold text-sm text-foreground">Opponent wants to restart.</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" onClick={acceptRestart} className="gap-1 bg-green-600 hover:bg-green-700 text-white"><Check className="h-4 w-4"/> Accept</Button>
                  <Button size="sm" variant="destructive" onClick={declineRestart} className="gap-1"><X className="h-4 w-4"/> Decline</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Button 
        variant="secondary" 
        className="mt-2 w-full h-12 text-lg" 
        onClick={handleRestartClick}
        disabled={!!restartRequestedBy}
      >
        {winner ? "Play Again" : "Restart Game"}
      </Button>
    </motion.div>
  );
}
