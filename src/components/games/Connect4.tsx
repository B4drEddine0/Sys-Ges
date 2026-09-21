import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const PLAYER_STYLES = [
  { name: 'Red', bg: 'bg-rose-500', dot: 'bg-rose-500', hover: 'group-hover:bg-rose-500/70' },
  { name: 'Yellow', bg: 'bg-amber-400', dot: 'bg-amber-400', hover: 'group-hover:bg-amber-400/70' },
  { name: 'Green', bg: 'bg-emerald-500', dot: 'bg-emerald-500', hover: 'group-hover:bg-emerald-500/70' },
  { name: 'Blue', bg: 'bg-sky-500', dot: 'bg-sky-500', hover: 'group-hover:bg-sky-500/70' },
] as const;

type Cell = number | null;

export function Connect4({
  local,
  channel,
  mySeat = 0,
  totalPlayers = 2,
}: {
  local: boolean;
  channel?: any;
  mySeat?: number;
  totalPlayers?: 2 | 4;
}) {
  // 4-player games get a noticeably bigger board so there's actually room to build
  // lines around three opponents instead of one.
  const ROWS = totalPlayers === 4 ? 9 : 6;
  const COLS = totalPlayers === 4 ? 11 : 7;

  const emptyBoard = () => Array(ROWS).fill(null).map(() => Array<Cell>(COLS).fill(null));

  const [board, setBoard] = useState<Cell[][]>(emptyBoard);
  const [firstTurnIndex, setFirstTurnIndex] = useState(0);
  const [turnIndex, setTurnIndex] = useState(0);
  const [restartRequestedBy, setRestartRequestedBy] = useState<number | null>(null);

  useEffect(() => {
    if (local || !channel) return;
    channel.on('broadcast', { event: 'connect4_state' }, (payload: any) => {
      setBoard(payload.payload.board);
      setTurnIndex(payload.payload.turnIndex);
    });

    channel.on('broadcast', { event: 'connect4_restart_req' }, (payload: any) => {
      setRestartRequestedBy(payload.payload.by);
    });

    channel.on('broadcast', { event: 'connect4_restart_accept' }, () => {
      doRestart();
    });

    channel.on('broadcast', { event: 'connect4_restart_decline' }, () => {
      setRestartRequestedBy(null);
    });
  }, [local, channel]);

  const checkWin = (b: Cell[][]) => {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const player = b[r][c];
        if (player === null) continue;
        for (const [dr, dc] of directions) {
          let win = true;
          const winningCells: [number, number][] = [[r, c]];
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
  const winner = winData?.winner ?? null;
  const winningCells = winData?.winningCells || [];
  const isDraw = !winner && board.every((row) => row.every((cell) => cell !== null));

  const handleColumnClick = (c: number) => {
    if (winner !== null || restartRequestedBy !== null) return;
    if (!local && mySeat !== turnIndex) return;

    const newBoard = board.map((row) => [...row]);

    for (let r = ROWS - 1; r >= 0; r--) {
      if (newBoard[r][c] === null) {
        newBoard[r][c] = turnIndex;

        const win = checkWin(newBoard);
        const nextTurn = (turnIndex + 1) % totalPlayers;

        setBoard(newBoard);
        if (!win) setTurnIndex(nextTurn);

        if (!local && channel) {
          channel.send({
            type: 'broadcast',
            event: 'connect4_state',
            payload: { board: newBoard, turnIndex: win ? turnIndex : nextTurn },
          });
        }
        break;
      }
    }
  };

  const doRestart = () => {
    const nextFirst = (firstTurnIndex + 1) % totalPlayers;
    setBoard(emptyBoard());
    setFirstTurnIndex(nextFirst);
    setTurnIndex(nextFirst);
    setRestartRequestedBy(null);
  };

  const handleRestartClick = () => {
    if (local) {
      doRestart();
    } else {
      setRestartRequestedBy(mySeat);
      if (channel) {
        channel.send({ type: 'broadcast', event: 'connect4_restart_req', payload: { by: mySeat } });
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

  let status = '';
  if (winner !== null) {
    status = `Winner: ${PLAYER_STYLES[winner].name}`;
  } else if (isDraw) {
    status = 'Draw!';
  } else if (!local) {
    status = mySeat === turnIndex ? 'Your turn!' : `${PLAYER_STYLES[turnIndex].name}'s turn...`;
  } else {
    status = `Next player: ${PLAYER_STYLES[turnIndex].name}`;
  }

  const youAre = !local ? PLAYER_STYLES[mySeat] : null;
  const canClick = winner === null && restartRequestedBy === null && (local || mySeat === turnIndex);
  const isBig = totalPlayers === 4;

  return (
    <motion.div
      animate={winner !== null ? { scale: [1, 1.02, 1], y: [0, -5, 5, -5, 0] } : {}}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-6 p-8 bg-card rounded-3xl border border-border shadow-md overflow-x-auto max-w-full"
    >
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold tracking-tight">Connect 4 {isBig ? '(4 Players)' : ''}</h3>
        {youAre && (
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2">
            You are:
            <div className={`w-3 h-3 rounded-full ${youAre.dot}`} />
            {youAre.name}
          </div>
        )}
      </div>

      <motion.div
        key={status}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-sm font-bold bg-muted px-6 py-2 rounded-full flex items-center gap-2"
      >
        {winner === null && !isDraw && (
          <div className={`w-3 h-3 rounded-full ${PLAYER_STYLES[turnIndex].dot}`} />
        )}
        {status}
      </motion.div>

      <div className={`flex ${isBig ? 'gap-1' : 'gap-2'} bg-blue-600 ${isBig ? 'p-2' : 'p-4'} rounded-3xl shadow-inner mt-2 relative`}>
        {Array(COLS).fill(null).map((_, c) => (
          <div
            key={c}
            className={`flex flex-col ${isBig ? 'gap-1' : 'gap-2'} ${canClick ? 'cursor-pointer group' : ''}`}
            onClick={() => handleColumnClick(c)}
          >
            <div className={`h-2 rounded-full mb-1 transition-colors ${canClick && board[0][c] === null ? PLAYER_STYLES[turnIndex].hover : ''}`} />

            {Array(ROWS).fill(null).map((_, r) => {
              const cell = board[r][c];
              const isWinningCell = winningCells.some(([wr, wc]) => wr === r && wc === c);
              return (
                <motion.div
                  key={r}
                  animate={isWinningCell ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] } : {}}
                  transition={isWinningCell ? { duration: 0.6, repeat: Infinity } : {}}
                  className={`${isBig ? 'w-7 h-7 md:w-9 md:h-9' : 'w-12 h-12 md:w-14 md:h-14'} rounded-full border-[3px] md:border-[4px] shadow-sm transition-all duration-300 relative
                    ${cell !== null ? PLAYER_STYLES[cell].bg : 'bg-background'}
                    ${isWinningCell ? 'border-white z-10' : 'border-blue-700/50'}
                  `}
                >
                  {isWinningCell && <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />}
                </motion.div>
              );
            })}
          </div>
        ))}

        {!local && restartRequestedBy !== null && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-4 text-center z-20">
            {restartRequestedBy === mySeat ? (
              <p className="font-semibold text-sm animate-pulse text-foreground">Waiting for others to accept...</p>
            ) : (
              <div className="space-y-4">
                <p className="font-semibold text-sm text-foreground">
                  {PLAYER_STYLES[restartRequestedBy].name} wants to restart.
                </p>
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
        disabled={restartRequestedBy !== null}
      >
        {winner !== null || isDraw ? "Play Again" : "Restart Game"}
      </Button>
    </motion.div>
  );
}
