import PageTitle from '../PageTitle';
import TripList from '../TripList';

export default function TripListPage(props) {
  return (
    <div>
      <PageTitle>Trips</PageTitle>
      <TripList {...props} />
    </div>
  );
}
