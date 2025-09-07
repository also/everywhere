import PageTitle from '../PageTitle';
import StandardPage from '../StandardPage';
import Mdx from '../../docs.mdx';
import { MdxOptionsContext } from '../../docs/also-mdx-jsx-runtime/jsx-dev-runtime';
import { useNavigate, useSearch } from '@tanstack/react-router';

export default function DocsPage() {
  // TODO ??
  const params = useSearch({ from: '/docs' });
  const navigate = useNavigate();
  const mdxOptions = {
    focus: new Set(params.focus),
    showUI: params.ui,
    showSimpleTags: params.showSimpleTags,
  };

  return (
    <StandardPage className="classic-page">
      <PageTitle>Docs</PageTitle>
      {mdxOptions.showUI && (
        <div>
          {mdxOptions.focus.size === 0 && (
            <>
              <label>
                <input
                  type="checkbox"
                  name="showSimpleTags"
                  onChange={() => {
                    navigate({
                      from: '/docs',
                      search: (prev) => ({
                        ...prev,
                        showSimpleTags: !mdxOptions.showSimpleTags,
                      }),
                    });
                  }}
                  checked={mdxOptions.showSimpleTags}
                />{' '}
                Show simple tags
              </label>
            </>
          )}
          {mdxOptions.focus.size > 0 && (
            <button
              onClick={() => {
                navigate({
                  from: '/docs',
                  search: (prev) => ({ ...prev, focus: [] }),
                });
              }}
            >
              Clear Focus
            </button>
          )}
        </div>
      )}
      <MdxOptionsContext.Provider value={mdxOptions}>
        <Mdx />
      </MdxOptionsContext.Provider>
    </StandardPage>
  );
}
