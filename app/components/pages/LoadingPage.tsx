import Map from '../stylized/Map';
import PageTitle from '../PageTitle';
import StandardPage from '../StandardPage';

export default function LoadingPage({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <StandardPage>
      <PageTitle>Loading</PageTitle>

      {children}

      <div
        style={{
          display: 'flex',
          alignContent: 'center',
          justifyContent: 'center',
        }}
      >
        <div>
          <Map width={600} height={600} asLoadingAnimation={true} />
        </div>
      </div>
    </StandardPage>
  );
}
