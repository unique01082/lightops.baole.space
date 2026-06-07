import { Component, ErrorInfo, ReactNode } from 'react';
import i18n from '../../i18n';

interface CapturedError {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset: () => void;
}

interface ErrorBoundaryState {
  errors: CapturedError[];
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    errors: [],
    hasError: false,
  };

  private removeWindowErrorListener?: () => void;
  private removeRejectionListener?: () => void;

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      errors: [
        {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  componentDidMount() {
    const onWindowError = (event: ErrorEvent) => {
      this.captureError(event.error instanceof Error ? event.error : new Error(event.message));
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      this.captureError(reason instanceof Error ? reason : new Error(String(reason)));
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    this.removeWindowErrorListener = () => window.removeEventListener('error', onWindowError);
    this.removeRejectionListener = () =>
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.captureError(error, info.componentStack ?? undefined);
  }

  componentWillUnmount() {
    this.removeWindowErrorListener?.();
    this.removeRejectionListener?.();
  }

  private captureError(error: Error, componentStack?: string) {
    const captured: CapturedError = {
      message: error.message,
      stack: error.stack,
      componentStack,
      timestamp: new Date().toISOString(),
    };
    this.setState((state) => ({
      hasError: true,
      errors: [captured, ...state.errors].slice(0, 10),
    }));
  }

  private handleReset = () => {
    this.setState({ hasError: false, errors: [] });
    this.props.onReset();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const latest = this.state.errors[0];

    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,87,108,0.18),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(79,172,254,0.12),transparent_28%),linear-gradient(135deg,#0f0c29,#24243e)]" />
        <div
          className="relative z-10 w-full max-w-3xl rounded-3xl border p-6 shadow-2xl"
          style={{ background: 'rgba(10, 8, 30, 0.88)', borderColor: 'var(--glass-border)' }}
        >
          <p className="text-xs uppercase tracking-[0.28em]" style={{ color: 'var(--text-muted)' }}>
            {i18n.t('errorBoundary.recovered')}
          </p>
          <h1 className="mt-2 text-3xl text-white" style={{ fontFamily: 'var(--font-heading)' }}>
            {i18n.t('errorBoundary.title')}
          </h1>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {i18n.t('errorBoundary.body')}
          </p>
          <div
            className="mt-5 max-h-72 overflow-auto rounded-2xl border p-4 text-xs"
            style={{
              borderColor: 'rgba(245, 87, 108, 0.3)',
              background: 'rgba(245, 87, 108, 0.08)',
              color: 'var(--text-secondary)',
            }}
          >
            <p className="font-semibold text-white">{latest?.message ?? i18n.t('shared.unknownError')}</p>
            {this.state.errors.map((error) => (
              <details key={`${error.timestamp}-${error.message}`} className="mt-3">
                <summary className="cursor-pointer text-white">{error.timestamp}</summary>
                <pre className="mt-2 whitespace-pre-wrap">{error.stack}</pre>
                {error.componentStack && (
                  <pre className="mt-2 whitespace-pre-wrap">{error.componentStack}</pre>
                )}
              </details>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
              <button
              type="button"
              onClick={this.handleReset}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: 'var(--accent-lightops)' }}
            >
              {i18n.t('errorBoundary.return')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
