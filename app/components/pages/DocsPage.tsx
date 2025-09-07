import PageTitle from '../PageTitle';
import StandardPage from '../StandardPage';
import Mdx from '../../docs.mdx';
import { MdxOptionsContext } from '../../docs/also-mdx-jsx-runtime/jsx-dev-runtime';
import { useHistory, useLocation } from 'react-router';

export default function DocsPage() {
  const location = useLocation();
  const history = useHistory();
  const params = new URLSearchParams(location.search);
  const mdxOptions = {
    focus: new Set(params.getAll('focus')),
    showUI: params.get('ui') === 'true',
    showSimpleTags: params.get('showSimpleTags') === 'true',
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
                    params.set(
                      'showSimpleTags',
                      (!mdxOptions.showSimpleTags).toString()
                    );
                    history.push({ search: params.toString() });
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
                params.delete('focus');
                history.push({ search: params.toString() });
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
