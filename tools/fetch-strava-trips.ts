import fs from 'fs';
import path from 'path';

import axios from 'axios';

import { getAccessToken } from './strava-creds';
import {
  CompleteActivity,
  Stream,
  streamNames,
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

async function getStreams(id: string): Promise<Stream[] | undefined> {
  try {
    return await get(`activities/${id}/streams/${streamNames.join(',')}`);
  } catch (e) {
    if (e?.response?.status === 404) {
      return;
    }
    throw e;
  }
}

async function fetchTrip(id: string): Promise<CompleteActivity> {
  return {
    activity: await getTrip(id),
    streams: await getStreams(id),
  };
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
    if (name.match(/^\d+ min /) || name.match(/Peloton/)) {
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
