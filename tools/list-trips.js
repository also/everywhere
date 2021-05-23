import { getTrips } from './fetch-strava-trips';

export default async function () {
  const trips = await getTrips();
  console.log(trips);
}
