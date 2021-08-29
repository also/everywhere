import { getTripSummaries } from './fetch-strava-trips';

export default async function () {
  const trips = await getTripSummaries();
  console.log(trips);
}
