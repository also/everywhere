import { getTripSummaries } from './fetch-strava-trips';

export default async function () {
  const trips = await getTripSummaries();
  for await (const trip of trips) {
    console.log(trip);
  }
}
