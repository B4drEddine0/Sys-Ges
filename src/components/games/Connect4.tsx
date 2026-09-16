import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

export function Connect4({ local, channel, isHost }: { local: boolean, channel?: any, isHost?: boolean }) {
  const ROWS = 6;
  const COLS = 7;
  const [board, setBoard] = useState(Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));
  
  const [firstTurnIsRed, setFirstTurnIsRed] = useState(true);
  const [redIsNext, setRedIsNext] = useState(true);
  const [restartRequestedBy, setRestartRequestedBy] = useState<'host' | 'guest' | null>(null);

  useEffect(() => {
    if (local || !channel) return;
    const sub = channel.on('broadcast', { event: 'connect4_state' }, (payload: any) => {
      setBoard(payload.payload.board);
      setRedIsNext(payload.payload.redIsNext);
    });
    
    const reqSub = channel.on('broadcast', { event: 'connect4_restart_req' }, (payload: any) => {
      setRestartRequestedBy(payload.payload.by);
    });
    
    const accSub = channel.on('broadcast', { event: 'connect4_restart_accept' }, () => {
      doRestart();
    });
    
    const decSub = channel.on('broadcast', { event: 'connect4_restart_decline' }, () => {
      setRestartRequestedBy(null);
    });

    return () => {};
  }, [local, channel]);

  const checkWin = (b: any[][]) => {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!b[r][c]) continue;
        const player = b[r][c];
        for (let [dr, dc] of directions) {
          let win = true;
          const winningCells = [[r, c]];
          for (let i = 1; i < 4; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || b[nr][nc] !== player) {
              win = false;
              break;
            }
            winningCells.push([nr, nc]);
          }
          if (win) return { winner: player, winningCells };
        }
      }
    }
    return null;
  };

  const winData = checkWin(board);
  const winner = winData?.winner;
  const winningCells = winData?.winningCells || [];

  const handleColumnClick = (c: number) => {
    if (winner || restartRequestedBy) return;

    if (!local) {
      if (isHost && !redIsNext) return;
      if (!isHost && redIsNext) return;
    }

    const newBoard = board.map(row => [...row]);
    
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!newBoard[r][c]) {
        newBoard[r][c] = redIsNext ? 'R' : 'Y';
        
        const win = checkWin(newBoard);
        const nextTurn = !redIsNext;
        
        setBoard(newBoard);
        if (!win) setRedIsNext(nextTurn);
        
        if (!local && channel) {
          channel.send({
            type: 'broadcast',
            event: 'connect4_state',
            payload: { board: newBoard, redIsNext: win ? redIsNext : nextTurn }
          });
        }
        break;
      }
    }
  };

  const doRestart = () => {
    const newBoard = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    const newFirstTurn = !firstTurnIsRed;
    setBoard(newBoard);
    setFirstTurnIsRed(newFirstTurn);
    setRedIsNext(newFirstTurn);
    setRestartRequestedBy(null);
  };

  const handleRestartClick = () => {
    if (local) {
      doRestart();
    } else {
      const me = isHost ? 'host' : 'guest';
      setRestartRequestedBy(me);
      if (channel) {
        channel.send({ type: 'broadcast', event: 'connect4_restart_req', payload: { by: me } });
      }
    }
  };

  const acceptRestart = () => {
    doRestart();
    if (channel) {
      channel.send({ type: 'broadcast', event: 'connect4_restart_accept' });
    }
  };

  const declineRestart = () => {
    setRestartRequestedBy(null);
    if (channel) {
      channel.send({ type: 'broadcast', event: 'connect4_restart_decline' });
    }
  };

  let status = "";
  if (winner) {
    status = `Winner: ${winner === 'R' ? 'Red' : 'Yellow'}`;
  } else if (board.flat().every(Boolean)) {
    status = "Draw!";
  } else {
    if (!local) {
      status = (isHost === redIsNext) ? "Your turn!" : "Opponent's turn...";
    } else {
      status = `Next player: ${redIsNext ? 'Red' : 'Yellow'}`;
    }
  }

  const youAre = !local ? (isHost ? 'R' : 'Y') : null;
  const me = isHost ? 'host' : 'guest';

  return (
    <motion.div 
      animate={winner ? { scale: [1, 1.02, 1], y: [0, -5, 5, -5, 0] } : {}}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-6 p-8 bg-card rounded-3xl border border-border shadow-md overflow-x-auto max-w-full"
    >
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold tracking-tight">Connect 4</h3>
        {youAre && (
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2">
            You are: 
            <div className={`w-3 h-3 rounded-full ${youAre === 'R' ? 'bg-rose-500' : 'bg-amber-400'}`} />
          </div>
        )}
      </div>
      
      <motion.div 
        key={status}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-sm font-bold bg-muted px-6 py-2 rounded-full flex items-center gap-2"
      >
        {!winner && !board.flat().every(Boolean) && (
          <div className={`w-3 h-3 rounded-full ${redIsNext ? 'bg-rose-500' : 'bg-amber-400'}`} />
        )}
        {status}
      </motion.div>

      <div className="flex gap-2 bg-blue-600 p-4 rounded-3xl shadow-inner mt-2 relative">
        {Array(COLS).fill(null).map((_, c) => (
          <div 
            key={c} 
            className={`flex flex-col gap-2 ${(!winner && !restartRequestedBy && (local || isHost === redIsNext)) ? 'cursor-pointer group' : ''}`} 
            onClick={() => handleColumnClick(c)}
          >
            <div className={`h-2.5 rounded-full mb-1 transition-colors ${!winner && !restartRequestedBy && !board[0][c] && (local || isHost === redIsNext) ? (redIsNext ? 'group-hover:bg-rose-500/70' : 'group-hover:bg-amber-400/70') : ''}`} />
            
            {Array(ROWS).fill(null).map((_, r) => {
              const cell = board[r][c];
              const isWinningCell = winningCells.some(([wr, wc]) => wr === r && wc === c);
              return (
                <motion.div 
                  key={r} 
                  animate={isWinningCell ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] } : {}}
                  transition={isWinningCell ? { duration: 0.6, repeat: Infinity } : {}}
                  className={`w-12 h-12 md:w-14 md:h-14 rounded-full border-[4px] shadow-sm transition-all duration-300 relative
                    ${cell === 'R' ? 'bg-rose-500' : cell === 'Y' ? 'bg-amber-400' : 'bg-background'}
                    ${isWinningCell ? 'border-white z-10' : 'border-blue-700/50'}
                  `}
                >
                  {isWinningCell && <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />}
                </motion.div>
              );
            })}
          </div>
        ))}

        {!local && restartRequestedBy && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-4 text-center z-20">
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
        className="mt-4 w-full h-12 text-lg" 
        onClick={handleRestartClick}
        disabled={!!restartRequestedBy}
      >
        {winner || board.flat().every(Boolean) ? "Play Again" : "Restart Game"}
      </Button>
    </motion.div>
  );
}
