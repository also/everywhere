import { MultiLineString } from 'topojson-specification';
import { Activity, CompleteActivity } from './strava-api';
import { SimpleTopology } from './topojson-utils';
import { completeActivityToGeoJson, geoJsonToTopoJson } from './strava';
import { mapGen, readAllJson } from './data';

export function stravaActivityGeoJson() {
  return mapGen(
    readAllJson<CompleteActivity>('strava-activities'),
    (activity) =>
      activity.activity.type === 'Ride'
        ? completeActivityToGeoJson(activity)
        : undefined
  );
}

export function stravaTopologies(): Generator<
  SimpleTopology<MultiLineString<{ activity: Activity }>>
> {
  return mapGen(stravaActivityGeoJson(), geoJsonToTopoJson);
}
