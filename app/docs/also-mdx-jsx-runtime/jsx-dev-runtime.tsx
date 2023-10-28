import { Fragment } from 'react/jsx-dev-runtime';
export { Fragment };

import { createContext, PropsWithChildren, useContext } from 'react';
import { jsxDEV as original } from 'react/jsx-dev-runtime';
import { Link } from 'react-router-dom';

export function jsxDEV(
  type,
  originalProps,
  key,
  isStaticChildren,
  source,
  self
) {
  if (type === Fragment) {
    return original(type, originalProps, key, isStaticChildren, source, self);
  } else {
    const { mdxFocusKey, ...props } = originalProps ?? {};

    if (typeof type === 'string') {
      originalProps['data-also-mdx-source'] = JSON.stringify(source);
    }

    const children = original(type, props, key, isStaticChildren, source, self);
    return original(
      MdxComponentWrapper,
      {
        children,
        source,
        type,
        mdxFocusKey,
      },
      key,
      false,
      source,
      self
    );
  }
}

const Context = createContext();

function MdxComponentWrapper({
  children,
  source,
  type,
  mdxFocusKey,
}: PropsWithChildren<{
  source: { fileName: string; lineNumber: string; columnNumber: string };
  type: any;
  mdxFocusKey: string;
}>) {
  const { focus, showUI, showSimpleTags } = useContext(MdxOptionsContext);
  const existing = useContext(Context);
  if (existing) {
    return children;
  }

  if (typeof type === 'string' && !showSimpleTags) {
    return children;
  }

  const sourceKey = `${source.fileName}:${source.lineNumber}:${source.columnNumber}`;

  const focusKeys = [];

  if (mdxFocusKey) {
    focusKeys.push(mdxFocusKey);
  }

  focusKeys.push(sourceKey);

  if (typeof type === 'function' && type.name) {
    focusKeys.push(type.name);
  }
  if (typeof type === 'string') {
    focusKeys.push(type);
  }

  if (focus.size > 0 && !focusKeys.some((k) => focus.has(k))) {
    return null;
  }
  return (
    <>
      {showUI && (
        <div style={{ background: '#eee', padding: '.5em' }}>
          <a href={`vscode://file/${sourceKey}`}>open in vs code</a> focus on:{' '}
          {focusKeys.map((k) => (
            <Fragment key={k}>
              <Link
                key={k}
                to={(location) => {
                  const params = new URLSearchParams(location.search);
                  params.set('focus', k);
                  return { search: params.toString() };
                }}
              >
                {k}
              </Link>{' '}
            </Fragment>
          ))}
        </div>
      )}
      <Context.Provider value={source}>{children}</Context.Provider>
    </>
  );
}

export const MdxOptionsContext = createContext<{
  focus: Set<string>;
  showUI: boolean;
  showSimpleTags: boolean;
}>({ focus: new Set(), showUI: false, showSimpleTags: false });
