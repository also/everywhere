import { getTrips } from './fetch-strava-trips';

export default function({ _: [id] }) {
  getTrips()
    .then(trips => console.log(trips))
    .catch(result => {
      console.error('error', result.stack || JSON.stringify(result));
    });
}
