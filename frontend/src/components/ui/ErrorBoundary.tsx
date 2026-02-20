import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-8">
          <div className="max-w-lg w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center space-y-4">
            <div className="flex justify-center">
              <AlertTriangle size={48} className="text-red-500" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              The app encountered an unexpected error. Your data is safe — a reload will restore it.
            </p>
            {this.state.error && (
              <pre className="text-left text-xs bg-slate-100 dark:bg-slate-700 text-red-600 dark:text-red-400 rounded-lg p-4 overflow-auto max-h-48 whitespace-pre-wrap">
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <RefreshCw size={16} />
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
