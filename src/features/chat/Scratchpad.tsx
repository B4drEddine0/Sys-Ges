import { useState, useEffect } from 'react';
import { X, Copy, Trash2, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui';
import { useToast } from '@/providers/ToastProvider';

interface ScratchpadProps {
  open: boolean;
  onClose: () => void;
}

export function Scratchpad({ open, onClose }: ScratchpadProps) {
  const [content, setContent] = useState('');
  const { pushToast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem('sys-ges-scratchpad');
    if (saved) {
      setContent(saved);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    localStorage.setItem('sys-ges-scratchpad', value);
  };

  const handleClear = () => {
    setContent('');
    localStorage.removeItem('sys-ges-scratchpad');
    pushToast({ title: 'Scratchpad cleared' });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    pushToast({ title: 'Copied to clipboard' });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[400px] bg-background border-l border-border shadow-2xl flex flex-col transform transition-transform duration-300">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Edit3 className="h-5 w-5 text-primary" /> Scratchpad
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleCopy} title="Copy all" className="h-8 w-8 p-0">
            <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear} title="Clear" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} title="Close" className="h-8 w-8 p-0 ml-2">
            <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          </Button>
        </div>
      </div>
      <div className="flex-1 p-4 bg-muted/10">
        <textarea
          value={content}
          onChange={handleChange}
          placeholder="Draft a message, paste some code, or write notes here...&#10;&#10;This is a private space and saves automatically."
          className="w-full h-full p-4 bg-card border border-border rounded-xl shadow-inner focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none font-sans text-sm leading-relaxed"
        />
      </div>
      <div className="p-3 border-t border-border bg-card/50 text-xs text-muted-foreground flex justify-between">
        <span>{content.length} characters</span>
        <span>{content.split(/\s+/).filter(Boolean).length} words</span>
      </div>
    </div>
  );
}
