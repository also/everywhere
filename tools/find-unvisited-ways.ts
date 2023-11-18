import { readFileSync, writeFileSync } from 'fs';
import { FeatureCollection } from 'geojson';
import { positionDistance } from '../app/distance';
import { features, linesWithinDistance, tree } from '../app/geo';
import { interpolateLineRange } from '../app/interpolate-lines';
import { stravaTopologies } from './strava-files';
import { combineTolologies } from './topojson-utils';

const distanceThreshold = 10;

export default function (opts: {
  _: string[];
  'only-visited'?: boolean;
  'only-unvisited'?: boolean;
}) {
  const {
    _: [streetsFilename, outputFilename],
    'only-visited': onlyVisited = false,
    'only-unvisited': onlyUnvisited = false,
  } = opts;

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

  let resultFeatures = [];

  for (const street of streetsGeojson.features) {
    const { geometry } = street;

    if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') {
      continue;
    }

    const lines =
      geometry.type === 'LineString'
        ? [geometry.coordinates]
        : geometry.coordinates;

    const interpolatedLines = lines.map((coordinates) => [
      ...interpolateLineRange(coordinates, 5000, positionDistance, 5),
    ]);

    let visitedSome = false;
    let visitedAll = true;
    for (const line of interpolatedLines) {
      for (const { point } of line) {
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
    }
    // TODO check every n meters along a street, rather than each point
    // if there's a trip down either end of a two-point street, it'll be
    // marked as visited, even if the middle is not

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

    if (onlyUnvisited) {
      if (!visited) {
        resultFeatures.push(street);
      }
    } else if (onlyVisited) {
      if (visited) {
        resultFeatures.push(street);
      }
    } else {
      resultFeatures.push(street);
    }
  }

  streetsGeojson.features = resultFeatures;

  writeFileSync(outputFilename, JSON.stringify(streetsGeojson));
}
