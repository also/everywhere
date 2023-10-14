import { stravaTopologies } from './strava-files';

import { combineTolologies } from './topojson-utils';

export default function () {
  const bigTopo = combineTolologies(stravaTopologies(), () => ({
    type: 'strava-trip',
  }));

  console.log(JSON.stringify(bigTopo, null, 2));
}
