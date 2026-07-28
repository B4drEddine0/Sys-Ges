import { Link } from 'react-router-dom';
import { Card } from '@/components/ui';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="max-w-lg p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">404</p>
        <h1 className="mt-3 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The page you requested does not exist.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Return home
          </Link>
        </div>
      </Card>
    </div>
  );
}
