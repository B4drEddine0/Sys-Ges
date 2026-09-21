import { createContext, useContext, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'sysges_private_space_unlocked';

type PrivateSpaceContextValue = {
  unlocked: boolean;
  unlocking: boolean;
  error: string | null;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
};

const PrivateSpaceContext = createContext<PrivateSpaceContextValue | null>(null);

export function PrivateSpaceProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(STORAGE_KEY) === '1');
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = async (pin: string) => {
    setUnlocking(true);
    setError(null);
    try {
      const res = await fetch('/api/private-space/unlock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data.ok) {
        sessionStorage.setItem(STORAGE_KEY, '1');
        setUnlocked(true);
        return true;
      }
      setError('Incorrect password.');
      return false;
    } catch {
      setError('Could not reach the server. Try again.');
      return false;
    } finally {
      setUnlocking(false);
    }
  };

  const lock = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setUnlocked(false);
  };

  return (
    <PrivateSpaceContext.Provider value={{ unlocked, unlocking, error, unlock, lock }}>
      {children}
    </PrivateSpaceContext.Provider>
  );
}

export function usePrivateSpace() {
  const ctx = useContext(PrivateSpaceContext);
  if (!ctx) throw new Error('usePrivateSpace must be used within PrivateSpaceProvider');
  return ctx;
}
