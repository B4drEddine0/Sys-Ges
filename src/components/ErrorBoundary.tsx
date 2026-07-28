import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application error boundary caught an error', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">Something went wrong. Refresh the page to recover.</div>;
    }

    return this.props.children;
  }
}