import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { usePrivateSpace } from '@/providers/PrivateSpaceProvider';

export function PrivateSpaceGate({ children }: { children: React.ReactNode }) {
  const { unlocked, unlocking, error, unlock } = usePrivateSpace();
  const [pin, setPin] = useState('');

  if (unlocked) return <>{children}</>;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await unlock(pin);
    if (!ok) setPin('');
  };

  return (
    <div className="flex-1 flex items-center justify-center h-full bg-background p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 p-8 bg-card border border-border rounded-3xl shadow-sm text-center"
      >
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold">Private Space</h1>
          <p className="text-sm text-muted-foreground">Enter the password to continue.</p>
        </div>
        <Input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Password"
          className="text-center tracking-[0.3em] text-lg h-12"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={unlocking || !pin} className="w-full h-11">
          {unlocking ? 'Checking…' : 'Unlock'}
        </Button>
      </form>
    </div>
  );
}
