import { readFileSync, writeFileSync } from 'fs';
import { Feature, FeatureCollection, MultiLineString } from 'geojson';
import { positionDistance } from '../app/distance';
import { features, linesWithinDistance, tree } from '../app/geo';
import { GoodPosition, interpolateLineRange } from '../app/interpolate-lines';
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

  const resultFeatures = [];

  for (const street of streetsGeojson.features) {
    const { geometry } = street;

    if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') {
      continue;
    }

    let visitedSome = false;
    let visitedAll = true;

    const visitedLines = [];
    const unvisitedLines = [];

    let currentLine: GoodPosition[] | undefined = undefined;

    let previousVisited: boolean | undefined = undefined;

    let previousStartIndex = 0;

    for (const line of geometry.type === 'LineString'
      ? [geometry.coordinates]
      : geometry.coordinates) {
      const interpolatedLine = interpolateLineRange(
        line,
        5000,
        positionDistance,
        5
      );
      for (const { point, index } of interpolatedLine) {
        const near = linesWithinDistance(tripTree, point, distanceThreshold);
        const visitedPoint = near.length > 0;

        if (!currentLine) {
          currentLine = [];
          if (visitedPoint) {
            visitedLines.push(currentLine);
          } else {
            unvisitedLines.push(currentLine);
          }
        } else if (
          visitedPoint !== previousVisited ||
          index === line.length - 1
        ) {
          currentLine.push(...line.slice(previousStartIndex, index));
          previousStartIndex = index;
          currentLine.push(point);
          currentLine = [];
          if (visitedPoint) {
            visitedLines.push(currentLine);
          } else {
            unvisitedLines.push(currentLine);
          }
        }

        previousVisited = visitedPoint;

        if (!visitedPoint) {
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

    if (visitedLines.length > 0) {
      const visitedFeature: Feature<MultiLineString> = {
        ...street,
        properties: {
          ...street.properties,
          visited: true,
        },
        geometry: {
          type: 'MultiLineString',
          coordinates: visitedLines,
        },
      };

      resultFeatures.push(visitedFeature);
    }

    if (unvisitedLines.length > 0) {
      const unvisitedFeature: Feature<MultiLineString> = {
        ...street,
        properties: {
          ...street.properties,
          visited: false,
          someVisited: visitedLines.length > 0,
        },
        geometry: {
          type: 'MultiLineString',
          coordinates: unvisitedLines,
        },
      };
      resultFeatures.push(unvisitedFeature);
    }

    const visited = visitedSome && visitedAll;

    // street.properties!.everywhere = {
    //   visited,
    //   distanceThreshold,
    // };

    if (visited) {
      visitedCount++;
    } else {
      unvisitedCount++;
    }

    // if (onlyUnvisited) {
    //   if (!visited) {
    //     resultFeatures.push(street);
    //   }
    // } else if (onlyVisited) {
    //   if (visited) {
    //     resultFeatures.push(street);
    //   }
    // } else {
    //   resultFeatures.push(street);
    // }
  }

  streetsGeojson.features = resultFeatures;

  writeFileSync(outputFilename, JSON.stringify(streetsGeojson));
}
