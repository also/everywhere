import path from 'path';
import fs from 'fs';
import { FeatureCollection, MultiLineString } from 'geojson';
import {
  Activity,
  otherStreamNames,
  StravaCoord,
  Stream,
  StreamsByType,
} from './strava-api';
import { distance } from '../app/distance';
import * as topojson from 'topojson';

const tripsPath = path.join(__dirname, '..', 'data', 'strava-activities');

type TripGeoJSON = FeatureCollection<
  MultiLineString,
  {
    activity: Activity;
  }
>;

function streamsToGeoJson(streams: StreamsByType): TripGeoJSON | undefined {
  if (!streams.latlng) {
    return;
  }
  const orderedStreams: Stream['data'][] = [];
  otherStreamNames.forEach((type) => {
    const v = streams[type];
    if (v) {
      orderedStreams.push(v);
    }
  });

  const coordinates: StravaCoord[][] = [];
  let currentCoordinates: StravaCoord[] | null = null;

  let currentPosition: [number, number] | null = null;

  streams.latlng.forEach(([lat, lng], i) => {
    if (!currentPosition || distance(lng, lat, ...currentPosition) > 100) {
      currentCoordinates = [];
      coordinates.push(currentCoordinates);
    }

    currentPosition = [lng, lat];

    currentCoordinates!.push([
      lng,
      lat,
      ...orderedStreams.map((stream) => stream[i]),
    ]);
  });

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: streams.activity.id,
        properties: { activity: streams.activity },
        geometry: {
          type: 'MultiLineString',
          coordinates: coordinates,
        },
      },
    ],
  };
}

function geoJsonToTopoJson(geoJson: TripGeoJSON) {
  return topojson.topology({ geoJson });
}

export function* stravaTopologies() {
  for (const activitiesFile of fs.readdirSync(tripsPath)) {
    const match = activitiesFile.match(/(\d+)\.json/);
    if (match) {
      const activity: StreamsByType = JSON.parse(
        fs.readFileSync(path.join(tripsPath, activitiesFile), 'utf8')
      );

      const geoJson = streamsToGeoJson(activity);
      if (geoJson) {
        yield geoJsonToTopoJson(geoJson);
      }
    }
  }
}
