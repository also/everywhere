import axios from 'axios';
import { FeatureCollection, MultiLineString } from 'geojson';
import * as topojson from 'topojson';

import { distance } from '../app/distance';

import stravaAuth from '../creds/strava.json';

const streamNames = [
  'latlng',
  'altitude',
  'time',
  'distance',
  'velocity_smooth',
  'heartrate',
  'cadence',
  'watts',
  'temp',
  'moving',
  'grade_smooth',
] as const;

const otherStreamNames = streamNames.slice(1);

type Activity = {
  id: string;
};

type StravaCoord = [number, number, ...any];

type LatLngStrm = { type: 'latlng'; data: [number, number][] };
type AltitudeStream = { type: 'altitude'; data: number[] };
type TimeStream = {
  type: 'time';
  /** The sequence of time values for this stream, in seconds */
  data: number[];
};
type DistanceStream = {
  type: 'distance';
  /** The sequence of distance values for this stream, in meters */
  data: number[];
};
type SmoothVelocityStream = {
  type: 'velocity_smooth';
  /** The sequence of velocity values for this stream, in meters per second*/
  data: number[];
};
type HeartrateStream = {
  type: 'heartrate';
  /** The sequence of heart rate values for this stream, in beats per minute */
  data: number[];
};

type CadenceStream = {
  type: 'cadence';
  /** The sequence of cadence values for this stream, in rotations per minute */
  data: number[];
};

type PowerStream = {
  type: 'watts';
  /** The sequence of power values for this stream, in watts */
  data: number[];
};

type TemperatureStream = {
  type: 'temp';
  /** The sequence of temperature values for this stream, in celsius degrees */
  data: number[];
};

type MovingStream = {
  type: 'moving';
  /** The sequence of moving values for this stream, as boolean values */
  data: boolean[];
};

type SmoothGradeStream = {
  type: 'grade_smooth';
  /** The sequence of velocity values for this stream, in meters per second */
  data: number[];
};

type Stream =
  | LatLngStrm
  | AltitudeStream
  | TimeStream
  | DistanceStream
  | SmoothVelocityStream
  | HeartrateStream
  | CadenceStream
  | PowerStream
  | TemperatureStream
  | MovingStream
  | SmoothGradeStream;

type SBT = { [K in Stream['type']]: Extract<Stream, { type: K }>['data'] };

type StreamsByType = {
  activity: Activity;
} & SBT;

async function get(path: string) {
  const { data: result } = await axios.get(
    `https://www.strava.com/api/v3/${path}`,
    {
      headers: { Authorization: `Bearer ${stravaAuth.access_token}` },
    }
  );
  if (result.errors && result.errors.length > 0) {
    throw new Error(JSON.stringify(result));
  } else {
    return result;
  }
}

export function getTrips() {
  return get('athlete/activities');
}

function getTrip(id: string) {
  return get(`activities/${id}`);
}

function getStreams(activity: Activity): StreamsByType {
  return get(`activities/${activity.id}/streams/${streamNames.join(',')}`).then(
    (streams: Stream[]) => {
      const streamsByType: Partial<StreamsByType> = { activity };
      streams.forEach((s) => (streamsByType[s.type] = s.data));
      return streamsByType;
    }
  ) as any;
}

function streamsToGeoJson(
  streams: StreamsByType
): FeatureCollection<MultiLineString> {
  const orderedStreams: Stream['data'][] = [];
  otherStreamNames.forEach((type) => {
    if (streams[type]) {
      orderedStreams.push(streams[type]);
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

function geoJsonToTopoJson(geoJson) {
  return topojson.topology(
    { geoJson },
    { 'property-transform': (f) => f.properties }
  );
}

export default async function ({ _: [id] }: { _: string[] }) {
  const activity = await getTrip(id);
  const streams = await getStreams(activity);
  const gj = streamsToGeoJson(streams);
  const result = geoJsonToTopoJson(gj);
  console.log(JSON.stringify(result));
}
