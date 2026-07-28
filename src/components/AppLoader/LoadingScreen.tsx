import { motion } from 'framer-motion';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui';
import { StatusMessages } from '@/components/AppLoader/StatusMessages';

interface LoadingScreenProps {
  showConnectionHelp: boolean;
  onRetry: () => void;
}

export function LoadingScreen({ showConnectionHelp, onRetry }: LoadingScreenProps) {
  return (
    <motion.div
      key="app-loader"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background px-4 text-foreground"
    >
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md rounded-3xl border border-border bg-card px-6 py-8 text-center shadow-2xl"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-muted/40 p-3">
          <img src="/sys-ges-logo.png" alt="Sys-Ges" className="h-full w-full object-contain" />
        </div>

        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sys-Ges</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Task Manager</h1>
        </div>

        <div className="mt-7 flex justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background"
            aria-hidden="true"
          >
            <RotateCw className="h-5 w-5 text-accent" />
          </motion.div>
        </div>

        <div className="mt-6">
          <StatusMessages />
        </div>

        {showConnectionHelp ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mt-6 rounded-2xl border border-border bg-muted/40 p-4"
          >
            <p className="text-sm font-medium">Unable to connect to the server.</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The backend may still be waking up. You can retry now, and the app will keep checking in the background.
            </p>
            <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
              Retry
            </Button>
          </motion.div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
