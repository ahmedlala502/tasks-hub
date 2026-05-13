import { Component } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  info: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, info: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, info: '' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.setState({ info: info.componentStack || '' });
  }

  reset = () => this.setState({ hasError: false, error: null, info: '' });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const errorMessage = this.state.error?.message || 'An unexpected error occurred.';
      const errorStack = this.state.error?.stack || '';

      return (
        <div
          style={{
            minHeight: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            background: '#f9fafb',
            color: '#111827',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: 720,
              width: '100%',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
              padding: 28,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: '#fef2f2',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertCircle style={{ width: 22, height: 22, color: '#ef4444' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#111827' }}>
                  This page hit an error
                </h2>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0', fontWeight: 500 }}>
                  The sidebar and rest of the app are still working.
                </p>
              </div>
            </div>

            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
                fontSize: 13,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                color: '#991b1b',
                wordBreak: 'break-word',
              }}
            >
              {errorMessage}
            </div>

            {errorStack && (
              <details style={{ marginBottom: 16 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>
                  Show technical details
                </summary>
                <pre
                  style={{
                    marginTop: 8,
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 11,
                    color: '#374151',
                    maxHeight: 240,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {errorStack}
                  {this.state.info ? `\n\nComponent stack:${this.state.info}` : ''}
                </pre>
              </details>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={this.reset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  background: '#111827',
                  color: '#ffffff',
                  borderRadius: 10,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw style={{ width: 14, height: 14 }} />
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  background: '#ffffff',
                  color: '#111827',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reload Page
              </button>
              <button
                onClick={() => { window.location.hash = ''; window.location.href = '/'; }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  background: '#ffffff',
                  color: '#111827',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
