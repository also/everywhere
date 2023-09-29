import PageTitle from '../PageTitle';
import StandardPage from '../StandardPage';
import Mdx from '../../docs.mdx';

export default function DocsPage() {
  return (
    <StandardPage>
      <PageTitle>Docs</PageTitle>
      <Mdx />
    </StandardPage>
  );
}
