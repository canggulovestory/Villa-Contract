import React, { Component, ErrorInfo, ReactNode } from 'react';

// ─── ErrorBoundary ────────────────────────────────────────────────────────
// Catches unexpected JS errors anywhere in the component tree and renders a
// friendly fallback instead of a white screen crash.
// Usage: wrap your app root or any critical section in <ErrorBoundary>.

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 max-w-md w-full text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-red-700 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-500 mb-1">An unexpected error occurred:</p>
            <p className="text-sm font-mono bg-red-50 text-red-600 rounded p-2 mb-6 text-left break-words">
              {this.state.errorMessage || 'Unknown error'}
            </p>
            <button
              onClick={this.handleReset}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
