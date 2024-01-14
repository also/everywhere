import { stravaTopologies } from './strava-files';

import { combineTopologies } from './topojson-utils';

export default function () {
  const bigTopo = combineTopologies(stravaTopologies(), () => ({
    type: 'strava-trip',
  }));

  console.log(JSON.stringify(bigTopo, null, 2));
}
