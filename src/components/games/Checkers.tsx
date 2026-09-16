import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

type Player = 'R' | 'B';
type Piece = { player: Player; isKing: boolean };
type BoardState = (Piece | null)[][];

const initializeBoard = (): BoardState => {
  const board: BoardState = Array(8).fill(null).map(() => Array(8).fill(null));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) board[r][c] = { player: 'R', isKing: false };
    }
  }
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) board[r][c] = { player: 'B', isKing: false };
    }
  }
  return board;
};

export function Checkers({ local, channel, isHost }: { local: boolean, channel?: any, isHost?: boolean }) {
  const [board, setBoard] = useState<BoardState>(initializeBoard());
  const [redIsNext, setRedIsNext] = useState(false); // Black starts traditionally, or let's say Red starts (B starts is fine, B is at the bottom). We'll do B starts.
  const [firstTurnIsRed, setFirstTurnIsRed] = useState(false);
  const [selectedPos, setSelectedPos] = useState<{r: number, c: number} | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [restartRequestedBy, setRestartRequestedBy] = useState<'host' | 'guest' | null>(null);

  useEffect(() => {
    if (local || !channel) return;
    const sub = channel.on('broadcast', { event: 'checkers_state' }, (payload: any) => {
      setBoard(payload.payload.board);
      setRedIsNext(payload.payload.redIsNext);
      setWinner(payload.payload.winner);
    });
    
    const reqSub = channel.on('broadcast', { event: 'checkers_restart_req' }, (payload: any) => {
      setRestartRequestedBy(payload.payload.by);
    });
    
    const accSub = channel.on('broadcast', { event: 'checkers_restart_accept' }, () => {
      doRestart();
    });
    
    const decSub = channel.on('broadcast', { event: 'checkers_restart_decline' }, () => {
      setRestartRequestedBy(null);
    });

    return () => {};
  }, [local, channel]);

  const checkWinner = (currentBoard: BoardState): Player | null => {
    let rCount = 0;
    let bCount = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (currentBoard[r][c]?.player === 'R') rCount++;
        if (currentBoard[r][c]?.player === 'B') bCount++;
      }
    }
    if (rCount === 0) return 'B';
    if (bCount === 0) return 'R';
    return null;
  };

  const handleSquareClick = (r: number, c: number) => {
    if (winner || restartRequestedBy) return;

    const currentPlayer = redIsNext ? 'R' : 'B';
    
    // Enforcement online
    if (!local) {
      if (isHost && currentPlayer !== 'B') return; // Host is always B (bottom)
      if (!isHost && currentPlayer !== 'R') return; // Guest is always R (top)
    }

    // Select piece
    if (board[r][c]?.player === currentPlayer) {
      setSelectedPos({ r, c });
      return;
    }

    // Move piece
    if (selectedPos && board[r][c] === null && ((r + c) % 2 === 1)) {
      const dr = r - selectedPos.r;
      const dc = c - selectedPos.c;
      const piece = board[selectedPos.r][selectedPos.c]!;
      
      const isSimpleMove = Math.abs(dr) === 1 && Math.abs(dc) === 1;
      const isJump = Math.abs(dr) === 2 && Math.abs(dc) === 2;
      
      // Direction validation (unless king)
      const validDirection = piece.isKing || (piece.player === 'B' ? dr < 0 : dr > 0);

      if (validDirection) {
        if (isSimpleMove) {
          executeMove(r, c, false);
        } else if (isJump) {
          const mr = selectedPos.r + dr / 2;
          const mc = selectedPos.c + dc / 2;
          const middlePiece = board[mr][mc];
          if (middlePiece && middlePiece.player !== piece.player) {
            executeMove(r, c, true, {r: mr, c: mc});
          }
        }
      }
    }
  };

  const executeMove = (r: number, c: number, isJump: boolean, capturedPos?: {r: number, c: number}) => {
    if (!selectedPos) return;
    
    const newBoard = board.map(row => [...row]);
    const piece = { ...newBoard[selectedPos.r][selectedPos.c]! };
    
    // Kinging
    if (piece.player === 'B' && r === 0) piece.isKing = true;
    if (piece.player === 'R' && r === 7) piece.isKing = true;

    newBoard[r][c] = piece;
    newBoard[selectedPos.r][selectedPos.c] = null;
    
    if (isJump && capturedPos) {
      newBoard[capturedPos.r][capturedPos.c] = null;
    }

    const win = checkWinner(newBoard);
    const nextTurn = !redIsNext;
    
    setBoard(newBoard);
    setWinner(win);
    setSelectedPos(null);
    if (!win) setRedIsNext(nextTurn);
    
    if (!local && channel) {
      channel.send({
        type: 'broadcast',
        event: 'checkers_state',
        payload: { board: newBoard, redIsNext: nextTurn, winner: win }
      });
    }
  };

  const doRestart = () => {
    const newBoard = initializeBoard();
    const newFirstTurn = !firstTurnIsRed;
    setBoard(newBoard);
    setFirstTurnIsRed(newFirstTurn);
    setRedIsNext(newFirstTurn);
    setWinner(null);
    setSelectedPos(null);
    setRestartRequestedBy(null);
  };

  const handleRestartClick = () => {
    if (local) {
      doRestart();
    } else {
      const me = isHost ? 'host' : 'guest';
      setRestartRequestedBy(me);
      if (channel) {
        channel.send({ type: 'broadcast', event: 'checkers_restart_req', payload: { by: me } });
      }
    }
  };

  const acceptRestart = () => {
    doRestart();
    if (channel) {
      channel.send({ type: 'broadcast', event: 'checkers_restart_accept' });
    }
  };

  const declineRestart = () => {
    setRestartRequestedBy(null);
    if (channel) {
      channel.send({ type: 'broadcast', event: 'checkers_restart_decline' });
    }
  };

  let status = "";
  if (winner) {
    status = `Winner: ${winner === 'R' ? 'Red' : 'Black'}`;
  } else {
    if (!local) {
      status = (isHost === !redIsNext) ? "Your turn!" : "Opponent's turn...";
    } else {
      status = `Next player: ${redIsNext ? 'Red' : 'Black'}`;
    }
  }

  const youAre = !local ? (isHost ? 'B' : 'R') : null;
  const me = isHost ? 'host' : 'guest';

  return (
    <motion.div 
      animate={winner ? { scale: [1, 1.02, 1], rotate: [0, 2, -2, 0] } : {}}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-6 p-8 bg-card rounded-3xl border border-border shadow-md"
    >
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold tracking-tight">Checkers (Dama)</h3>
        {youAre && (
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2">
            You are: 
            <div className={`w-3 h-3 rounded-full ${youAre === 'R' ? 'bg-rose-500' : 'bg-slate-800 dark:bg-slate-200'}`} />
          </div>
        )}
      </div>

      <motion.div 
        key={status}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm font-bold bg-muted px-6 py-2 rounded-full flex items-center gap-2"
      >
        {!winner && local && (
          <div className={`w-3 h-3 rounded-full ${redIsNext ? 'bg-rose-500' : 'bg-slate-800 dark:bg-slate-200'}`} />
        )}
        {status}
      </motion.div>

      <div className="relative border-4 border-amber-900/40 rounded-xl overflow-hidden shadow-inner">
        <div className="grid grid-cols-8 w-[320px] h-[320px] md:w-[400px] md:h-[400px]">
          {board.map((row, r) => row.map((cell, c) => {
            const isDark = (r + c) % 2 === 1;
            const isSelected = selectedPos?.r === r && selectedPos?.c === c;
            return (
              <div 
                key={`${r}-${c}`}
                onClick={() => handleSquareClick(r, c)}
                className={`w-full h-full flex items-center justify-center relative
                  ${isDark ? 'bg-amber-900/80 cursor-pointer' : 'bg-amber-100'}
                  ${isSelected ? 'bg-amber-600' : ''}
                `}
              >
                {cell && (
                  <motion.div 
                    layoutId={`piece-${r}-${c}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: isSelected ? 1.1 : 1 }}
                    className={`w-[80%] h-[80%] rounded-full shadow-md flex items-center justify-center border-2
                      ${cell.player === 'R' ? 'bg-rose-500 border-rose-600' : 'bg-slate-800 border-slate-900 dark:bg-slate-200 dark:border-slate-300'}
                    `}
                  >
                    {cell.isKing && (
                      <div className="w-[50%] h-[50%] rounded-full border-2 border-amber-400 opacity-60" />
                    )}
                  </motion.div>
                )}
              </div>
            );
          }))}
        </div>

        {/* Restart Overlay */}
        {!local && restartRequestedBy && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-20">
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
        {winner ? "Play Again" : "Restart Game"}
      </Button>
    </motion.div>
  );
}
