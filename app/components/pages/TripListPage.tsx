import { StravaTripFeature } from '../../trips';
import PageTitle from '../PageTitle';
import StandardPage from '../StandardPage';
import TripList from '../TripList';

export default function TripListPage(props: { trips: StravaTripFeature[] }) {
  return (
    <StandardPage>
      <PageTitle>Trips</PageTitle>
      <TripList {...props} />
    </StandardPage>
  );
}
