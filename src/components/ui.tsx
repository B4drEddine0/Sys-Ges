import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Button({ className, variant = 'default', size = 'md', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'secondary' | 'ghost' | 'destructive'; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'default' && 'bg-foreground text-background hover:opacity-90',
        variant === 'secondary' && 'bg-muted text-foreground hover:bg-muted/80',
        variant === 'ghost' && 'bg-transparent hover:bg-muted',
        variant === 'destructive' && 'bg-rose-600 text-white hover:bg-rose-700',
        size === 'sm' && 'h-8 px-3',
        size === 'md' && 'h-10 px-4',
        size === 'lg' && 'h-11 px-5',
        className,
      )}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn('h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn('min-h-[96px] w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring', className)} {...props} />;
});

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative', className)}>
      <select className="h-10 w-full appearance-none rounded-xl border border-border bg-card px-3 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export function Checkbox({ checked, onChange, className }: { checked: boolean; onChange: (checked: boolean) => void; className?: string }) {
  return <button type="button" aria-pressed={checked} onClick={() => onChange(!checked)} className={cn('inline-flex h-5 w-5 items-center justify-center rounded-md border border-border bg-card transition hover:border-ring', checked && 'border-accent bg-accent text-accent-foreground', className)} />;
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground', className)}>{children}</span>;
}

export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function Card({ className, ...props }, ref) {
  return <div ref={ref} className={cn('rounded-2xl border border-border bg-card text-card-foreground shadow-soft', className)} {...props} />;
});

export function Avatar({ name, color, src, className }: { name: string; color: string; src?: string | null; className?: string }) {
  if (src) {
    return <img src={src} alt={name} className={cn("h-9 w-9 rounded-full object-cover", className)} />;
  }
  return <div className={cn("flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white", className)} style={{ backgroundColor: color }}>{name}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted', className)} />;
}

export function Progress({ value }: { value: number }) {
  return <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function Modal({ open, title, description, children, onClose, className }: { open: boolean; title: string; description?: string; children: ReactNode; onClose: () => void; className?: string }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 px-4 py-6" onClick={onClose}>
      <div className={cn("w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl", className)} onClick={(event) => event.stopPropagation()}>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ open, title, children, onClose, width = 'max-w-2xl' }: { open: boolean; title: string; children: ReactNode; onClose: () => void; width?: string }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/40" onClick={onClose}>
      <aside className={cn('absolute right-0 top-0 h-full w-full border-l border-border bg-card shadow-2xl', width)} onClick={(event) => event.stopPropagation()}>
        <div className="flex h-full flex-col">
          <div className="border-b border-border px-6 py-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </div>
      </aside>
    </div>
  );
}