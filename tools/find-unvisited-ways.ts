import { readFileSync, writeFileSync } from 'fs';
import { FeatureCollection } from 'geojson';
import { features, linesWithinDistance, tree } from '../app/geo';
import { stravaTopologies } from './strava-files';
import { combineTolologies } from './topojson-utils';

const distanceThreshold = 10;

export default function ({
  _: [streetsFilename, outputFilename],
}: {
  _: string[];
}) {
  const streetsGeojson: FeatureCollection = JSON.parse(
    readFileSync(streetsFilename, 'utf8')
  );

  const bigTopo = combineTolologies(stravaTopologies(), () => ({
    type: 'strava-trip',
  }));

  const tripTree = tree(features(bigTopo));

  let i = 0;
  let visitedCount = 0;
  let unvisitedCount = 0;

  for (const street of streetsGeojson.features) {
    const { geometry } = street;
    const points =
      geometry.type === 'LineString'
        ? geometry.coordinates
        : geometry.type === 'MultiLineString'
        ? geometry.coordinates.flat()
        : [];
    let visitedSome = false;
    let visitedAll = true;
    // TODO check every n meters along a street, rather than each point
    // if there's a trip down either end of a two-point street, it'll be
    // marked as visited, even if the middle is not
    for (const point of points) {
      const near = linesWithinDistance(tripTree, point, distanceThreshold);
      if (near.length === 0) {
        visitedAll = false;
        break;
      } else {
        visitedSome = true;
      }

      if (i++ % 100 === 0) {
        console.log(i);
      }
    }

    const visited = visitedSome && visitedAll;

    street.properties!.everywhere = {
      visited,
      distanceThreshold,
    };

    if (visited) {
      visitedCount++;
    } else {
      unvisitedCount++;
    }
  }

  console.log({ visitedCount, unvisitedCount });

  writeFileSync(outputFilename, JSON.stringify(streetsGeojson));
}
