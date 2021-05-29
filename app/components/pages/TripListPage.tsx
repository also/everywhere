import { StravaTripFeature } from '../../trips';
import PageTitle from '../PageTitle';
import TripList from '../TripList';

export default function TripListPage(props: { trips: StravaTripFeature[] }) {
  return (
    <div>
      <PageTitle>Trips</PageTitle>
      <TripList {...props} />
    </div>
  );
}
