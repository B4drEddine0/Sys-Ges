import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
  action?: ToastAction;
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = (id: string) => setToasts((current) => current.filter((toast) => toast.id !== id));

  const pushToast = (toast: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => dismissToast(id), 4500);
  };

  const value = useMemo(() => ({ pushToast, dismissToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[80] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'rounded-2xl border bg-card px-4 py-3 text-sm shadow-soft backdrop-blur',
              toast.variant === 'destructive' && 'border-rose-200 dark:border-rose-900',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{toast.title}</p>
                {toast.description ? <p className="mt-1 text-muted-foreground">{toast.description}</p> : null}
                {toast.action ? (
                  <button
                    type="button"
                    className="mt-3 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
                    onClick={() => {
                      toast.action?.onClick();
                      dismissToast(toast.id);
                    }}
                  >
                    {toast.action.label}
                  </button>
                ) : null}
              </div>
              <button type="button" onClick={() => dismissToast(toast.id)} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}