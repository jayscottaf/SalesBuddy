import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI error boundary caught:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, message: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 32,
          maxWidth: 560,
          margin: '80px auto',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #fecaca',
          color: '#111827',
          fontFamily: '-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif',
        }}>
          <h2 style={{ marginTop: 0, color: '#b91c1c' }}>Something went wrong</h2>
          <p style={{ color: '#374151' }}>
            The analysis view failed to render. Your data is safe — this is a display error.
          </p>
          {this.state.message && (
            <pre style={{ background: '#f9fafb', padding: 12, borderRadius: 8, fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>
              {this.state.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            style={{ padding: '8px 14px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
