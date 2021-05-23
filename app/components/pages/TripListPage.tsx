import { TripFeature } from '../../trips';
import PageTitle from '../PageTitle';
import TripList from '../TripList';

export default function TripListPage(props: { trips: TripFeature[] }) {
  return (
    <div>
      <PageTitle>Trips</PageTitle>
      <TripList {...props} />
    </div>
  );
}
