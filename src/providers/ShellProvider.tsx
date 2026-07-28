import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface ShellContextValue {
  search: string;
  setSearch: (value: string) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState('');

  const value = useMemo(() => ({ search, setSearch }), [search]);

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const context = useContext(ShellContext);
  if (!context) throw new Error('useShell must be used within ShellProvider');
  return context;
}