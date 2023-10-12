import { ReactNode, useContext } from 'react';
import { createPortal } from 'react-dom';
import { createStateContext } from './utils';

export const NavExtensionContext = createStateContext<HTMLDivElement>();

export function NavExtension({ children }: { children: ReactNode }) {
  const { value: div } = useContext(NavExtensionContext.Context);
  return div ? createPortal(children, div) : null;
}
