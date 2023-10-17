import PageTitle from '../PageTitle';
import StandardPage from '../StandardPage';
import Mdx from '../../docs.mdx';
import { MdxOptionsContext } from '../../docs/also-mdx-jsx-runtime/jsx-dev-runtime';

export default function DocsPage(props) {
  const params = new URLSearchParams(props.location.search);
  return (
    <StandardPage>
      <PageTitle>Docs</PageTitle>
      <MdxOptionsContext.Provider
        value={{
          focus: new Set(params.getAll('focus')),
          showUI: params.get('ui') === 'true',
        }}
      >
        <Mdx />
      </MdxOptionsContext.Provider>
    </StandardPage>
  );
}
