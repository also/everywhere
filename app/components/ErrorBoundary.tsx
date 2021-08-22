import React, { ReactNode } from 'react';

function ErrorDisplay({
  ignoreError,
  error,
}: {
  ignoreError: () => void;
  error: any;
}) {
  return (
    <>
      <h1>Internal Error</h1>
      <pre>{'' + (error?.stack || error)}</pre>
      <button onClick={() => ignoreError()}>Ignore error</button>
      <button onClick={() => window.location.reload()}>Reload page</button>
    </>
  );
}

export class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error?: any }
> {
  constructor(props: ErrorBoundary['props']) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    console.log(error);
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorDisplay
          ignoreError={() => this.setState({ hasError: false })}
          error={this.state.error}
        />
      );
    }

    return this.props.children;
  }
}
