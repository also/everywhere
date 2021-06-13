import { useEffect, useState } from 'react';

export function useMemoAsync<T>(
  f: (opts: { signal: AbortSignal }) => Promise<T>,
  deps?: any[]
): T | undefined {
  const [state, setState] = useState<T>();

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const value = await f({ signal: ac.signal });
        if (!ac.signal.aborted) {
          setState(value);
        }
      } catch (e) {
        if (e?.name !== 'AbortError') {
          throw e;
        }
      }
    })();
    return () => ac.abort();
  }, deps);

  return state;
}
