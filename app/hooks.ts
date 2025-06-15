import { useEffect, useState } from 'react';

export function useAsyncError(): (v: any) => void {
  const [error, setError] = useState();
  if (error) {
    throw error;
  }
  return setError;
}

export function useMemoAsync<T>(
  f: (opts: { signal: AbortSignal }) => Promise<T>,
  deps?: any[]
): T | undefined {
  const [state, setState] = useState<T>();
  const handleAsyncError = useAsyncError();

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const value = await f({ signal: ac.signal });
        if (!ac.signal.aborted) {
          setState(value);
        }
      } catch (e) {
        if (!(e instanceof Error) || e.name !== 'AbortError') {
          throw e;
        }
      }
    })().catch(handleAsyncError);
    return () => ac.abort();
  }, deps);

  return state;
}
