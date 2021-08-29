import fs from 'fs';
import path from 'path';

import axios from 'axios';
import { FeatureCollection, MultiLineString } from 'geojson';
import * as topojson from 'topojson';

import { distance } from '../app/distance';

import { getAccessToken } from './strava-creds';

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

type ActivityType =
  | 'AlpineSki'
  | 'BackcountrySki'
  | 'Canoeing'
  | 'Crossfit'
  | 'EBikeRide'
  | 'Elliptical'
  | 'Golf'
  | 'Handcycle'
  | 'Hike'
  | 'IceSkate'
  | 'InlineSkate'
  | 'Kayaking'
  | 'Kitesurf'
  | 'NordicSki'
  | 'Ride'
  | 'RockClimbing'
  | 'RollerSki'
  | 'Rowing'
  | 'Run'
  | 'Sail'
  | 'Skateboard'
  | 'Snowboard'
  | 'Snowshoe'
  | 'Soccer'
  | 'StairStepper'
  | 'StandUpPaddling'
  | 'Surfing'
  | 'Swim'
  | 'Velomobile'
  | 'VirtualRide'
  | 'VirtualRun'
  | 'Walk'
  | 'WeightTraining'
  | 'Wheelchair'
  | 'Windsurf'
  | 'Workout'
  | 'Yoga';

type Activity = {
  id: string;
  type: ActivityType;
  name: string;
  start_date: string;
  elapsed_time: number;
  moving_time: number;
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

type SBT = {
  [K in Stream['type']]?: Extract<Stream, { type: K }>['data'];
};

type StreamsByType = {
  activity: Activity;
} & SBT;

async function get(path: string) {
  const accessToken = await getAccessToken();
  const { data: result } = await axios.get(
    `https://www.strava.com/api/v3/${path}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (result.errors && result.errors.length > 0) {
    throw new Error(JSON.stringify(result));
  } else {
    return result;
  }
}

type SummaryActivity = {
  id: string;
  type: ActivityType;
  name: string;
  manual: boolean;
};

export async function* getTrips(): AsyncGenerator<SummaryActivity> {
  const result: SummaryActivity[] = [];

  let page = 1;

  while (true) {
    console.error(`listing activities, page ${page}`);
    const current: SummaryActivity[] = await get(
      `athlete/activities?per_page=200&page=${page++}`
    );
    if (current.length === 0) {
      break;
    }
    for (const activity of current) {
      yield activity;
    }
  }
}

function getTrip(id: string) {
  return get(`activities/${id}`);
}

async function getStreams(
  activity: Activity
): Promise<StreamsByType | undefined> {
  let streams: Stream[];
  try {
    streams = await get(
      `activities/${activity.id}/streams/${streamNames.join(',')}`
    );
  } catch (e) {
    if (e?.response?.status === 404) {
      return;
    }
    throw e;
  }
  const streamsByType: StreamsByType = { activity };
  // @ts-expect-error not sure if there's a right way to do this
  streams.forEach((s) => (streamsByType[s.type] = s.data));
  return streamsByType;
}

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

async function fetchTrip(id: string) {
  const activity = await getTrip(id);
  const streams = await getStreams(activity);
  if (!streams) {
    return;
  }
  const gj = streamsToGeoJson(streams);
  if (gj) {
    return geoJsonToTopoJson(gj);
  }
}

export async function cacheTripList() {
  const trips = [];
  for await (const trip of getTrips()) {
    trips.push(trip);
  }
  fs.writeFileSync(
    path.join('app-data', 'strava-trips-list.json'),
    JSON.stringify(trips)
  );
}

function readCachedTripList() {
  return JSON.parse(
    fs.readFileSync(path.join('app-data', 'strava-trips-list.json'), 'utf8')
  );
}

function getTripFilename(id: string) {
  return path.join('app-data', 'strava-trips', `strava-${id}.geojson`);
}

async function fetchAllTrips(breakOnExisting = false) {
  for await (const trip of getTrips()) {
    const { id, name, type } = trip;
    const filename = getTripFilename(id);
    if (trip.type === 'Workout') {
      console.error(`skipping ${type} ${id}`);
      continue;
    }
    if (trip.manual === true) {
      console.error(`skipping manual trip ${id}`);
      continue;
    }
    if (name.match(/^\d+ min /)) {
      console.log(`skipping probably peloton "${name}" ${id}`);
      continue;
    }

    if (fs.existsSync(filename)) {
      console.log(`already fetched ${id}`);
      if (breakOnExisting) {
        break;
      }
    } else {
      console.log(`fetching ${id}`);

      try {
        const topojson = await fetchTrip(id);
        if (topojson) {
          fs.writeFileSync(filename, JSON.stringify(topojson));
        } else {
          console.error(`no geo info in "${name}" ${id}`);
        }
      } catch (e) {
        console.log(trip);
        console.log(e);
        throw e;
      }
    }
  }
}

export default async function ({ _: [id] }: { _: string[] }) {
  if (id === 'new') {
    await fetchAllTrips(true);
  } else if (id) {
    const topojson = await fetchTrip(id);
    if (topojson) {
      fs.writeFileSync(getTripFilename(id), JSON.stringify(topojson));
    } else {
      console.error(`no geo info in "${name}" ${id}`);
    }
  } else {
    await fetchAllTrips();
  }
}
