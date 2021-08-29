import fs from 'fs';
import path from 'path';

import axios from 'axios';

import { getAccessToken } from './strava-creds';
import {
  Activity,
  Stream,
  streamNames,
  StreamsByType,
  SummaryActivity,
} from './strava-api';

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

export async function* getTripSummaries(): AsyncGenerator<SummaryActivity> {
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

async function getStreams(activity: Activity): Promise<StreamsByType> {
  let streams: Stream[];
  try {
    streams = await get(
      `activities/${activity.id}/streams/${streamNames.join(',')}`
    );
  } catch (e) {
    if (e?.response?.status === 404) {
      streams = [];
    }
    throw e;
  }
  const streamsByType: StreamsByType = { activity };
  // @ts-expect-error not sure if there's a right way to do this
  streams.forEach((s) => (streamsByType[s.type] = s.data));
  return streamsByType;
}

async function fetchTrip(id: string): Promise<StreamsByType> {
  const activity = await getTrip(id);
  return await getStreams(activity);
}

export async function cacheTripList() {
  const trips = [];
  for await (const trip of getTripSummaries()) {
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
  return path.join('data', 'strava-activities', `${id}.json`);
}

async function fetchAllTrips(breakOnExisting = false) {
  for await (const trip of getTripSummaries()) {
    const { id, name, type } = trip;
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

    const filename = getTripFilename(id);

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
