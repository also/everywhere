import path from 'path';
import fs from 'fs';
import { FeatureCollection, MultiLineString } from 'geojson';
import {
  Activity,
  CompleteActivity,
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

function streamsByType({ streams, activity }: CompleteActivity): StreamsByType {
  const streamsByType: StreamsByType = { activity: activity };

  (streams || []).forEach(
    (s) =>
      // @ts-expect-error not sure if there's a right way to do this
      (streamsByType[s.type] = s.data)
  );
  return streamsByType;
}

function extractProperties(activity: Activity): Activity {
  return {
    id: activity.id,
    name: activity.name,
    moving_time: activity.moving_time,
    elapsed_time: activity.elapsed_time,
    start_date: activity.start_date,
    type: activity.type,
  };
}

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
      // ...orderedStreams.map((stream) => stream[i]),
    ]);
  });

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: streams.activity.id,
        properties: { activity: extractProperties(streams.activity) },
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
      const activity: CompleteActivity = JSON.parse(
        fs.readFileSync(path.join(tripsPath, activitiesFile), 'utf8')
      );

      const geoJson = streamsToGeoJson(streamsByType(activity));
      if (geoJson) {
        yield geoJsonToTopoJson(geoJson);
      }
    }
  }
}
