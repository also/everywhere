import { createContext, useState } from 'react';

interface StateContext<T> {
  value: T | undefined;
  setValue: (value: T) => void;
}

export function createStateContext<T>() {
  const Context = createContext<StateContext<T>>(undefined as any);

  function Provider({ children }: { children: JSX.Element }) {
    const [value, setValue] = useState<T>();
    return (
      <Context.Provider value={{ value, setValue }}>
        {children}
      </Context.Provider>
    );
  }

  return { Context, Provider };
}
