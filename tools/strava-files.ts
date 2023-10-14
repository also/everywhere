import path from 'path';
import fs from 'fs';

import { MultiLineString } from 'topojson-specification';
import { Activity, CompleteActivity } from './strava-api';
import { SimpleTopology } from './topojson-utils';
import { completeActivityToGeoJson, geoJsonToTopoJson } from './strava';

const tripsPath = path.join(__dirname, '..', 'data', 'strava-activities');

export function* stravaTopologies(): Generator<
  SimpleTopology<MultiLineString<{ activity: Activity }>>
> {
  for (const activitiesFile of fs.readdirSync(tripsPath)) {
    const match = activitiesFile.match(/(\d+)\.json/);
    if (match) {
      const activity: CompleteActivity = JSON.parse(
        fs.readFileSync(path.join(tripsPath, activitiesFile), 'utf8')
      );
      if (activity.activity.type !== 'Ride') {
        continue;
      }

      const geoJson = completeActivityToGeoJson(activity);
      if (geoJson) {
        yield geoJsonToTopoJson(geoJson);
      }
    }
  }
}
