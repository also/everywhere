import { FeatureCollection, MultiLineString } from 'geojson';
import { stravaActivityGeoJson, stravaTopologies } from './strava-files';

import { combineTopologies } from './topojson-utils';

export default function (argv: { geojson?: boolean }) {
  if (argv.geojson) {
    const collection: FeatureCollection<
      MultiLineString,
      { type: 'strava-trip' }
    > = { type: 'FeatureCollection', features: [] };

    for (const trip of stravaActivityGeoJson()) {
      for (const feature of trip.features) {
        collection.features.push({
          ...feature,
          properties: { type: 'strava-trip' },
        });
      }
    }

    console.log(JSON.stringify(collection, null, 2));
    return;
  }

  const bigTopo = combineTopologies(stravaTopologies(), () => ({
    type: 'strava-trip',
  }));

  console.log(JSON.stringify(bigTopo, null, 2));
}
