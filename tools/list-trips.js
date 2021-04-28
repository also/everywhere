import { getTrips } from './fetch-strava-trips';

export default async function({ _: [id] }) {
  const trips = await getTrips();
  console.log(trips);
}
