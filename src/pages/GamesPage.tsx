import { useState, useEffect } from 'react';
import { Gamepad2, Users, Monitor, Copy, Check, ArrowLeft, Grid3X3 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { TicTacToe } from '@/components/games/TicTacToe';
import { Connect4 } from '@/components/games/Connect4';
import { Checkers } from '@/components/games/Checkers';

type GameType = 'tictactoe' | 'connect4' | 'checkers' | null;
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
          <Button variant="ghost" size="sm" className="p-2" onClick={resetSelection}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : null}
        <Gamepad2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">Fun Zone</h2>
      </header>

      <main className="flex-1 p-6 md:p-8 flex flex-col items-center">
        <div className="w-full max-w-5xl">
          {!inRoom && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 py-4">
              <div className="text-center space-y-4">
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Choose Your Game</h1>
                <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
                  Play locally on the same device or challenge a teammate online!
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Tic Tac Toe Card */}
                <div className="flex flex-col p-6 bg-card border border-border rounded-3xl gap-6 hover:border-primary/50 transition-colors shadow-sm hover:shadow-lg">
                  <div className="space-y-2 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">Tic Tac Toe</h3>
                    <p className="text-muted-foreground text-sm">The classic 3x3 game of X's and O's.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    <Button onClick={() => startLocalGame('tictactoe')} variant="secondary" className="flex flex-col h-20 gap-2 rounded-2xl">
                      <Monitor className="h-5 w-5" /> Local
                    </Button>
                    <Button onClick={() => createOnlineRoom('tictactoe')} className="flex flex-col h-20 gap-2 rounded-2xl">
                      <Users className="h-5 w-5" /> Room
                    </Button>
                  </div>
                </div>

                {/* Connect 4 Card */}
                <div className="flex flex-col p-6 bg-card border border-border rounded-3xl gap-6 hover:border-primary/50 transition-colors shadow-sm hover:shadow-lg">
                  <div className="space-y-2 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">Connect 4</h3>
                    <p className="text-muted-foreground text-sm">Connect 4 discs horizontally, vertically, or diagonally.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    <Button onClick={() => startLocalGame('connect4')} variant="secondary" className="flex flex-col h-20 gap-2 rounded-2xl">
                      <Monitor className="h-5 w-5" /> Local
                    </Button>
                    <Button onClick={() => createOnlineRoom('connect4')} className="flex flex-col h-20 gap-2 rounded-2xl">
                      <Users className="h-5 w-5" /> Room
                    </Button>
                  </div>
                </div>

                {/* Checkers Card */}
                <div className="flex flex-col p-6 bg-card border border-border rounded-3xl gap-6 hover:border-primary/50 transition-colors shadow-sm hover:shadow-lg">
                  <div className="space-y-2 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">Checkers</h3>
                    <p className="text-muted-foreground text-sm">The classic game of Dama. Jump to win!</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    <Button onClick={() => startLocalGame('checkers')} variant="secondary" className="flex flex-col h-20 gap-2 rounded-2xl">
                      <Monitor className="h-5 w-5" /> Local
                    </Button>
                    <Button onClick={() => createOnlineRoom('checkers')} className="flex flex-col h-20 gap-2 rounded-2xl">
                      <Users className="h-5 w-5" /> Room
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
          {inRoom && gameMode === 'local' && selectedGame === 'checkers' && <Checkers local />}
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
      {initialGameType === 'checkers' && <Checkers local={false} channel={channel} isHost={isHost} />}
    </div>
  );
}
