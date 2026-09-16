import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

export function TicTacToe({ local, channel, isHost }: { local: boolean, channel?: any, isHost?: boolean }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [firstTurnIsX, setFirstTurnIsX] = useState(true);
  const [xIsNext, setXIsNext] = useState(true);
  const [restartRequestedBy, setRestartRequestedBy] = useState<'host' | 'guest' | null>(null);
  
  useEffect(() => {
    if (local || !channel) return;
    const sub = channel.on('broadcast', { event: 'tictactoe_state' }, (payload: any) => {
      setBoard(payload.payload.board);
      setXIsNext(payload.payload.xIsNext);
    });
    
    const reqSub = channel.on('broadcast', { event: 'tictactoe_restart_req' }, (payload: any) => {
      setRestartRequestedBy(payload.payload.by);
    });
    
    const accSub = channel.on('broadcast', { event: 'tictactoe_restart_accept' }, () => {
      doRestart();
    });
    
    const decSub = channel.on('broadcast', { event: 'tictactoe_restart_decline' }, () => {
      setRestartRequestedBy(null);
    });

    return () => {}; // Cleanup handled by parent wrapper
  }, [local, channel]);

  const calculateWinner = (squares: any[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a], line: lines[i] };
      }
    }
    return null;
  };
  
  const winData = calculateWinner(board);
  const winner = winData?.winner;
  const winningLine = winData?.line || [];
  
  const handleClick = (i: number) => {
    if (board[i] || winner) return;
    
    if (!local) {
      if (isHost && !xIsNext) return;
      if (!isHost && xIsNext) return;
    }

    const newBoard = board.slice();
    newBoard[i] = xIsNext ? 'X' : 'O';
    setBoard(newBoard);
    setXIsNext(!xIsNext);
    
    if (!local && channel) {
      channel.send({
        type: 'broadcast',
        event: 'tictactoe_state',
        payload: { board: newBoard, xIsNext: !xIsNext }
      });
    }
  };

  const doRestart = () => {
    const newBoard = Array(9).fill(null);
    const newFirstTurn = !firstTurnIsX;
    setBoard(newBoard);
    setFirstTurnIsX(newFirstTurn);
    setXIsNext(newFirstTurn);
    setRestartRequestedBy(null);
  };

  const handleRestartClick = () => {
    if (local) {
      doRestart();
    } else {
      const me = isHost ? 'host' : 'guest';
      setRestartRequestedBy(me);
      if (channel) {
        channel.send({ type: 'broadcast', event: 'tictactoe_restart_req', payload: { by: me } });
      }
    }
  };

  const acceptRestart = () => {
    doRestart();
    if (channel) {
      channel.send({ type: 'broadcast', event: 'tictactoe_restart_accept' });
    }
  };

  const declineRestart = () => {
    setRestartRequestedBy(null);
    if (channel) {
      channel.send({ type: 'broadcast', event: 'tictactoe_restart_decline' });
    }
  };
  
  let status = "";
  if (winner) {
    status = `Winner: ${winner}`;
  } else if (board.every(Boolean)) {
    status = "Draw!";
  } else {
    if (!local) {
      status = (isHost === xIsNext) ? "Your turn!" : "Opponent's turn...";
    } else {
      status = `Next player: ${xIsNext ? 'X' : 'O'}`;
    }
  }

  const youAre = !local ? (isHost ? 'X' : 'O') : null;
  const me = isHost ? 'host' : 'guest';
  
  return (
    <motion.div 
      animate={winner ? { scale: [1, 1.02, 1], rotate: [0, -1, 1, -1, 0] } : {}}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-6 p-8 bg-card rounded-3xl border border-border shadow-md"
    >
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold tracking-tight">Tic Tac Toe</h3>
        {youAre && (
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            You are: <span className={youAre === 'X' ? 'text-blue-500' : 'text-rose-500'}>{youAre}</span>
          </div>
        )}
      </div>
      
      <motion.div 
        key={status}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm font-bold bg-muted px-6 py-2 rounded-full"
      >
        {status}
      </motion.div>

      <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-2xl relative">
        {board.map((cell, i) => {
          const isWinningCell = winningLine.includes(i);
          return (
            <motion.button
              key={i}
              onClick={() => handleClick(i)}
              disabled={(!local && ((isHost && !xIsNext) || (!isHost && xIsNext))) || !!winner || !!restartRequestedBy}
              animate={isWinningCell ? { scale: [1, 1.2, 1.1], backgroundColor: ['var(--background)', 'var(--primary)', 'var(--background)'] } : {}}
              transition={isWinningCell ? { duration: 0.5, repeat: Infinity, repeatType: 'reverse' } : {}}
              className={`w-24 h-24 bg-background hover:bg-muted/80 disabled:hover:bg-background rounded-xl text-5xl font-bold flex items-center justify-center transition-colors border shadow-sm disabled:opacity-80
                ${isWinningCell ? 'border-primary/50 shadow-primary/20 z-10' : 'border-border'}
              `}
            >
              <span className={cell === 'X' ? 'text-blue-500' : 'text-rose-500'}>{cell}</span>
            </motion.button>
          );
        })}

        {/* Restart Overlay */}
        {!local && restartRequestedBy && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-4 text-center z-20">
            {restartRequestedBy === me ? (
              <p className="font-semibold text-sm animate-pulse">Waiting for opponent to accept restart...</p>
            ) : (
              <div className="space-y-4">
                <p className="font-semibold text-sm">Opponent wants to restart.</p>
                <div className="flex gap-2">
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
        {winner || board.every(Boolean) ? "Play Again" : "Restart Game"}
      </Button>
    </motion.div>
  );
}
