import * as geojson from 'geojson';
import { MultiLineString } from 'topojson-specification';
import { topology } from 'topojson';
import {
  Activity,
  CompleteActivity,
  otherStreamNames,
  StravaCoord,
  Stream,
  StreamsByType,
} from './strava-api';
import { distance } from '../app/distance';
import { SimpleTopology } from './topojson-utils';

export type TripGeoJSON = geojson.FeatureCollection<
  geojson.MultiLineString,
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

  streams.latlng.forEach(([lat, lng]) => {
    const gapThreshold = 100;
    if (
      !currentPosition ||
      distance(lng, lat, ...currentPosition) > gapThreshold
    ) {
      if (currentPosition) {
        console.error(
          `distance greater than ${gapThreshold}m in ${streams.activity.id}, starting new line`
        );
      }
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

export function geoJsonToTopoJson(
  geoJson: TripGeoJSON
): SimpleTopology<MultiLineString<{ activity: Activity }>> {
  // @ts-expect-error topojson.topology returns a generic record
  return topology({ geoJson });
}

export function completeActivityToGeoJson(
  activity: CompleteActivity
): TripGeoJSON | undefined {
  return streamsToGeoJson(streamsByType(activity));
}
