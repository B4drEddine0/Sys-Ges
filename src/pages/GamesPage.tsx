import { useState, useEffect } from 'react';
import { Gamepad2, Users, Monitor, Copy, Check, ArrowLeft } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';

type GameType = 'tictactoe' | 'connect4' | null;
type GameMode = 'local' | 'online' | null;

const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export function GamesPage() {
  const [selectedGame, setSelectedGame] = useState<GameType>(null);
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [roomCode, setRoomCode] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [inRoom, setInRoom] = useState(false);

  const resetSelection = () => {
    setSelectedGame(null);
    setGameMode(null);
    setRoomCode('');
    setJoinCodeInput('');
    setInRoom(false);
    setIsHost(false);
  };

  const startLocalGame = (game: GameType) => {
    setSelectedGame(game);
    setGameMode('local');
    setInRoom(true);
  };

  const createOnlineRoom = (game: GameType) => {
    setSelectedGame(game);
    setGameMode('online');
    setIsHost(true);
    setRoomCode(generateRoomCode());
    setInRoom(true);
  };

  const joinOnlineRoom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setGameMode('online');
    setIsHost(false);
    setRoomCode(joinCodeInput.trim().toUpperCase());
    setInRoom(true);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto">
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background/80 px-6 backdrop-blur-sm gap-4">
        {inRoom ? (
          <Button variant="ghost" size="icon" onClick={resetSelection}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : null}
        <Gamepad2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">Fun Zone</h2>
      </header>

      <main className="flex-1 p-6 md:p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl">
          {!inRoom && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 py-8">
              <div className="text-center space-y-4">
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Choose Your Game</h1>
                <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
                  Play locally on the same device or challenge a teammate online!
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Tic Tac Toe Card */}
                <div className="flex flex-col p-8 bg-card border border-border rounded-3xl gap-8 hover:border-primary/50 transition-colors shadow-sm hover:shadow-lg">
                  <div className="space-y-3 text-center">
                    <h3 className="text-3xl font-bold tracking-tight">Tic Tac Toe</h3>
                    <p className="text-muted-foreground text-sm">The classic 3x3 game of X's and O's.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-auto">
                    <Button onClick={() => startLocalGame('tictactoe')} variant="outline" className="flex flex-col h-24 gap-3 rounded-2xl">
                      <Monitor className="h-6 w-6" /> Local Play
                    </Button>
                    <Button onClick={() => createOnlineRoom('tictactoe')} className="flex flex-col h-24 gap-3 rounded-2xl">
                      <Users className="h-6 w-6" /> Create Room
                    </Button>
                  </div>
                </div>

                {/* Connect 4 Card */}
                <div className="flex flex-col p-8 bg-card border border-border rounded-3xl gap-8 hover:border-primary/50 transition-colors shadow-sm hover:shadow-lg">
                  <div className="space-y-3 text-center">
                    <h3 className="text-3xl font-bold tracking-tight">Connect 4</h3>
                    <p className="text-muted-foreground text-sm">Connect 4 discs horizontally, vertically, or diagonally.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-auto">
                    <Button onClick={() => startLocalGame('connect4')} variant="outline" className="flex flex-col h-24 gap-3 rounded-2xl">
                      <Monitor className="h-6 w-6" /> Local Play
                    </Button>
                    <Button onClick={() => createOnlineRoom('connect4')} className="flex flex-col h-24 gap-3 rounded-2xl">
                      <Users className="h-6 w-6" /> Create Room
                    </Button>
                  </div>
                </div>
              </div>

              {/* Join Room */}
              <div className="max-w-md mx-auto mt-12 p-8 bg-card border rounded-3xl space-y-6 shadow-sm">
                <div className="text-center space-y-2">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground" />
                  <h3 className="text-xl font-bold">Have a room code?</h3>
                  <p className="text-sm text-muted-foreground">Join a teammate's game instantly.</p>
                </div>
                <form onSubmit={joinOnlineRoom} className="flex gap-2">
                  <Input 
                    placeholder="Enter 6-letter code" 
                    value={joinCodeInput} 
                    onChange={e => setJoinCodeInput(e.target.value)} 
                    className="uppercase text-center font-mono tracking-widest text-lg h-12"
                    maxLength={6}
                  />
                  <Button type="submit" disabled={!joinCodeInput.trim()} className="h-12 px-6">Join</Button>
                </form>
              </div>
            </div>
          )}

          {inRoom && gameMode === 'online' && (
            <OnlineGameWrapper 
              roomCode={roomCode} 
              isHost={isHost} 
              initialGameType={selectedGame}
              onGameSelected={setSelectedGame}
            />
          )}

          {inRoom && gameMode === 'local' && selectedGame === 'tictactoe' && <TicTacToe local />}
          {inRoom && gameMode === 'local' && selectedGame === 'connect4' && <Connect4 local />}
        </div>
      </main>
    </div>
  );
}

// --- Multiplayer Wrapper ---
function OnlineGameWrapper({ roomCode, isHost, initialGameType, onGameSelected }: { roomCode: string, isHost: boolean, initialGameType: GameType, onGameSelected: (g: GameType) => void }) {
  const [copied, setCopied] = useState(false);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [channel, setChannel] = useState<any>(null);
  
  useEffect(() => {
    const ch = supabase.channel(`game:${roomCode}`, {
      config: {
        broadcast: { ack: false },
        presence: { key: isHost ? 'host' : 'guest' }
      },
    });

    setChannel(ch);

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      // More than 1 presence key means both are here
      if (Object.keys(state).length >= 2) {
        setOpponentJoined(true);
        if (isHost && initialGameType) {
          ch.send({ type: 'broadcast', event: 'game_init', payload: { gameType: initialGameType } });
        }
      } else {
        setOpponentJoined(false);
      }
    })
    .on('broadcast', { event: 'game_init' }, (payload) => {
      if (!isHost && payload.payload.gameType) {
        onGameSelected(payload.payload.gameType as GameType);
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ joined_at: new Date().toISOString() });
      }
    });

    return () => {
      ch.unsubscribe();
    };
  }, [roomCode, isHost, initialGameType, onGameSelected]);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!opponentJoined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-8 animate-in fade-in zoom-in-95">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary relative z-10" />
        </div>
        <div>
          <h2 className="text-3xl font-bold mb-2">Waiting for opponent...</h2>
          <p className="text-muted-foreground text-lg">Share this code with your teammate so they can join!</p>
        </div>
        <div className="p-2 pl-6 bg-muted/50 border rounded-2xl flex items-center gap-4">
          <span className="text-3xl font-mono tracking-[0.3em] font-bold text-primary">{roomCode}</span>
          <Button size="lg" className="rounded-xl px-6 h-14" onClick={copyCode}>
            {copied ? <><Check className="h-5 w-5 mr-2" /> Copied</> : <><Copy className="h-5 w-5 mr-2" /> Copy Code</>}
          </Button>
        </div>
      </div>
    );
  }

  if (!initialGameType) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      <span className="ml-4 font-semibold text-lg">Syncing game state...</span>
    </div>
  );

  return (
    <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
      <div className="mb-6 px-4 py-1.5 bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30 rounded-full text-sm font-bold flex items-center gap-2 shadow-sm">
        <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
        Opponent Connected
      </div>
      {initialGameType === 'tictactoe' && <TicTacToe local={false} channel={channel} isHost={isHost} />}
      {initialGameType === 'connect4' && <Connect4 local={false} channel={channel} isHost={isHost} />}
    </div>
  );
}

// --- Tic Tac Toe Component ---
function TicTacToe({ local, channel, isHost }: { local: boolean, channel?: any, isHost?: boolean }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  
  useEffect(() => {
    if (local || !channel) return;
    const sub = channel.on('broadcast', { event: 'tictactoe_state' }, (payload: any) => {
      setBoard(payload.payload.board);
      setXIsNext(payload.payload.xIsNext);
    });
    // Cleanup handled by unmounting the parent wrapper
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
        return squares[a];
      }
    }
    return null;
  };
  
  const handleClick = (i: number) => {
    if (board[i] || calculateWinner(board)) return;
    
    // Turn enforcement in online mode
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

  const handleRestart = () => {
    const newBoard = Array(9).fill(null);
    setBoard(newBoard);
    setXIsNext(true);
    if (!local && channel) {
      channel.send({
        type: 'broadcast',
        event: 'tictactoe_state',
        payload: { board: newBoard, xIsNext: true }
      });
    }
  };
  
  const winner = calculateWinner(board);
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
  
  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-card rounded-3xl border border-border shadow-md">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold tracking-tight">Tic Tac Toe</h3>
        {youAre && (
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            You are: <span className={youAre === 'X' ? 'text-blue-500' : 'text-rose-500'}>{youAre}</span>
          </div>
        )}
      </div>
      <div className="text-sm font-bold bg-muted px-6 py-2 rounded-full">{status}</div>
      <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-2xl">
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            disabled={(!local && ((isHost && !xIsNext) || (!isHost && xIsNext))) || !!winner}
            className="w-24 h-24 bg-background hover:bg-muted/80 disabled:hover:bg-background rounded-xl text-5xl font-bold flex items-center justify-center transition-colors border border-border shadow-sm disabled:opacity-80"
          >
            <span className={cell === 'X' ? 'text-blue-500' : 'text-rose-500'}>{cell}</span>
          </button>
        ))}
      </div>
      <Button variant="outline" className="mt-4 w-full h-12 text-lg" onClick={handleRestart}>
        Restart Game
      </Button>
    </div>
  );
}

// --- Connect 4 Component ---
function Connect4({ local, channel, isHost }: { local: boolean, channel?: any, isHost?: boolean }) {
  const ROWS = 6;
  const COLS = 7;
  const [board, setBoard] = useState(Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));
  const [redIsNext, setRedIsNext] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    if (local || !channel) return;
    const sub = channel.on('broadcast', { event: 'connect4_state' }, (payload: any) => {
      setBoard(payload.payload.board);
      setRedIsNext(payload.payload.redIsNext);
      setWinner(payload.payload.winner);
    });
  }, [local, channel]);

  const checkWin = (b: any[][]) => {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!b[r][c]) continue;
        const player = b[r][c];
        for (let [dr, dc] of directions) {
          let win = true;
          for (let i = 1; i < 4; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || b[nr][nc] !== player) {
              win = false;
              break;
            }
          }
          if (win) return player;
        }
      }
    }
    return null;
  };

  const handleColumnClick = (c: number) => {
    if (winner) return;

    if (!local) {
      if (isHost && !redIsNext) return;
      if (!isHost && redIsNext) return;
    }

    const newBoard = board.map(row => [...row]);
    
    let moveMade = false;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!newBoard[r][c]) {
        newBoard[r][c] = redIsNext ? 'R' : 'Y';
        moveMade = true;
        
        const win = checkWin(newBoard);
        const nextTurn = !redIsNext;
        
        setBoard(newBoard);
        setWinner(win);
        if (!win) setRedIsNext(nextTurn);
        
        if (!local && channel) {
          channel.send({
            type: 'broadcast',
            event: 'connect4_state',
            payload: { board: newBoard, redIsNext: nextTurn, winner: win }
          });
        }
        break;
      }
    }
  };

  const handleRestart = () => {
    const newBoard = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    setBoard(newBoard);
    setWinner(null);
    setRedIsNext(true);
    
    if (!local && channel) {
      channel.send({
        type: 'broadcast',
        event: 'connect4_state',
        payload: { board: newBoard, redIsNext: true, winner: null }
      });
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

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-card rounded-3xl border border-border shadow-md overflow-x-auto max-w-full">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold tracking-tight">Connect 4</h3>
        {youAre && (
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2">
            You are: 
            <div className={`w-3 h-3 rounded-full ${youAre === 'R' ? 'bg-rose-500' : 'bg-amber-400'}`} />
          </div>
        )}
      </div>
      
      <div className="text-sm font-bold bg-muted px-6 py-2 rounded-full flex items-center gap-2">
        {!winner && !board.flat().every(Boolean) && local && (
          <div className={`w-3 h-3 rounded-full ${redIsNext ? 'bg-rose-500' : 'bg-amber-400'}`} />
        )}
        {status}
      </div>

      <div className="flex gap-2 bg-blue-600 p-4 rounded-3xl shadow-inner mt-2">
        {Array(COLS).fill(null).map((_, c) => (
          <div 
            key={c} 
            className={`flex flex-col gap-2 ${(!winner && (local || isHost === redIsNext)) ? 'cursor-pointer group' : ''}`} 
            onClick={() => handleColumnClick(c)}
          >
            {/* Preview indicator */}
            <div className={`h-2.5 rounded-full mb-1 transition-colors ${!winner && !board[0][c] && (local || isHost === redIsNext) ? (redIsNext ? 'group-hover:bg-rose-500/70' : 'group-hover:bg-amber-400/70') : ''}`} />
            
            {Array(ROWS).fill(null).map((_, r) => {
              const cell = board[r][c];
              return (
                <div key={r} className={`w-12 h-12 md:w-14 md:h-14 rounded-full border-[4px] border-blue-700/50 shadow-sm transition-all duration-300 ${cell === 'R' ? 'bg-rose-500' : cell === 'Y' ? 'bg-amber-400' : 'bg-background'}`} />
              );
            })}
          </div>
        ))}
      </div>
      
      <Button variant="outline" className="mt-4 w-full h-12 text-lg" onClick={handleRestart}>
        Restart Game
      </Button>
    </div>
  );
}
