import { MultiLineString } from 'geojson';
import TinyQueue from 'tinyqueue';
import { positionDistance } from '../app/distance';
import { feature } from '../app/geo';
import { stravaTopologies } from './strava';

import { RawStravaTripFeature, RawStravaTripProperties } from '../app/trips';

export default async function () {
  const heap = new TinyQueue<{ feat: RawStravaTripFeature; count: number }>(
    [],
    (a, b) => b.count - a.count
  );

  for (const trip of stravaTopologies()) {
    const feat = feature<MultiLineString, RawStravaTripProperties>(trip);
    const firstCoord = feat.geometry.coordinates[0][0];
    const lastCoords =
      feat.geometry.coordinates[feat.geometry.coordinates.length - 1];
    const lastCoord = lastCoords[lastCoords.length - 1];
    let count = 0;
    feat.geometry.coordinates.forEach((coords) => {
      coords.forEach((coord) => {
        const dist = Math.min(
          positionDistance(firstCoord, coord),
          positionDistance(lastCoord, coord)
        );
        if (dist < 15) {
          count++;
        }
      });
    });
    heap.push({ feat, count });
  }

  for (let i = 0; i < 30; i++) {
    const entry = heap.pop();
    if (!entry) {
      break;
    }
    const { feat, count } = entry;
    console.log(`${feat.id} ${feat.properties.activity.type} ${count}`);
  }
}
