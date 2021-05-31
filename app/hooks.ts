import { useEffect, useState } from 'react';

export function useMemoAsync<T>(
  f: () => Promise<T>,
  deps?: any[]
): T | undefined {
  const [state, setState] = useState<T>();

  useEffect(() => {
    (async () => setState(await f()))();
  }, deps);

  return state;
}
