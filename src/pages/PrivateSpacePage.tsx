import { useNavigate } from 'react-router-dom';
import { Lock, Gamepad2, Clapperboard } from 'lucide-react';
import { usePrivateSpace } from '@/providers/PrivateSpaceProvider';

export function PrivateSpacePage() {
  const navigate = useNavigate();
  const { lock } = usePrivateSpace();

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Private Space</h2>
        </div>
        <button
          onClick={() => {
            lock();
            navigate('/projects');
          }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Lock
        </button>
      </header>

      <main className="flex-1 p-6 md:p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 py-8">
          <button
            onClick={() => navigate('/private/mystery')}
            className="flex flex-col items-start gap-4 p-8 bg-card border border-border rounded-3xl text-left hover:border-primary/50 hover:shadow-lg transition-all"
          >
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Gamepad2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Fun Zone</h3>
              <p className="text-sm text-muted-foreground mt-1">Games to play solo or with a teammate.</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/private/mystery1')}
            className="flex flex-col items-start gap-4 p-8 bg-card border border-border rounded-3xl text-left hover:border-primary/50 hover:shadow-lg transition-all"
          >
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Clapperboard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Cinema</h3>
              <p className="text-sm text-muted-foreground mt-1">Browse through the private proxy.</p>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
