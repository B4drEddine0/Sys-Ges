import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const messages = [
  '🚀 Starting the server...',
  '📦 Loading your workspace...',
  '🔄 Waking up the backend...',
  '⏳ This may take a few moments...',
  '✅ Almost ready...',
];

export function StatusMessages() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % messages.length);
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="relative h-6 overflow-hidden text-sm text-muted-foreground">
      <AnimatePresence mode="wait">
        <motion.p
          key={messages[messageIndex]}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="absolute inset-x-0 text-center"
        >
          {messages[messageIndex]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
