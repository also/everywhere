// GPS tracks from the Strava activity dump (data/strava-activities/*.json).

import { readAllJson } from '../data';
import { CompleteActivity } from '../strava-api';

export const DEFAULT_SPORTS = ['Ride', 'EBikeRide'];

// consecutive points further apart than this are a GPS jump or a paused
// recording; don't draw a line between them
const MAX_GAP_M = 150;

export interface Ride {
  id: number;
  name: string;
  sport: string;
  startDate: string; // local ISO timestamp
  distanceM: number;
  movingTimeS: number;
  /** tracks split at gaps, each [lon0, lat0, lon1, lat1, ...] */
  tracks: Float64Array[];
}

interface Stream {
  type: string;
  data: unknown[];
}

function splitTracks(
  latlng: [number, number][],
  moving?: boolean[]
): Float64Array[] {
  const tracks: Float64Array[] = [];
  let cur: number[] = [];
  let plon = NaN;
  let plat = NaN;
  for (let i = 0; i < latlng.length; i++) {
    if (moving && moving.length === latlng.length && !moving[i]) continue;
    const [lat, lon] = latlng[i];
    if (cur.length) {
      const dy = (lat - plat) * 111_000;
      const dx = (lon - plon) * 111_000 * Math.cos((lat * Math.PI) / 180);
      if (Math.hypot(dx, dy) > MAX_GAP_M) {
        if (cur.length >= 4) tracks.push(Float64Array.from(cur));
        cur = [];
      }
    }
    cur.push(lon, lat);
    plon = lon;
    plat = lat;
  }
  if (cur.length >= 4) tracks.push(Float64Array.from(cur));
  return tracks;
}

export function loadRides(sports = DEFAULT_SPORTS): Ride[] {
  const rides: Ride[] = [];
  let n = 0;
  for (const { activity: a, streams } of readAllJson<CompleteActivity>(
    'strava-activities'
  )) {
    n++;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const act = a as any;
    const sport: string = act.sport_type ?? act.type;
    if (!sports.includes(sport)) continue;
    const byType = new Map(
      (streams as unknown as Stream[]).map((s) => [s.type, s.data])
    );
    const latlng = byType.get('latlng') as [number, number][] | undefined;
    if (!latlng) continue;
    const tracks = splitTracks(
      latlng,
      byType.get('moving') as boolean[] | undefined
    );
    if (!tracks.length) continue;
    rides.push({
      id: act.id,
      name: act.name ?? '',
      sport,
      startDate: act.start_date_local ?? act.start_date,
      distanceM: act.distance ?? 0,
      movingTimeS: act.moving_time ?? 0,
      tracks,
    });
  }
  process.stderr.write(`read ${n} activities, ${rides.length} rides\n`);
  rides.sort((a, b) =>
    a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0
  );
  return rides;
}
