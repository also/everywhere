import path from 'path';
import fs from 'fs';
import { SimpleTopology } from './topojson-utils';

const appDataPath = path.join(__dirname, '../app-data/');
const tripsPath = path.join(appDataPath, 'strava-trips');

export function* stravaTopologies() {
  for (const tripFile of fs.readdirSync(tripsPath)) {
    const match = tripFile.match(/strava-(\d+)\.geojson/);
    if (match) {
      const trip: SimpleTopology = JSON.parse(
        fs.readFileSync(path.join(tripsPath, tripFile), 'utf8')
      );

      yield trip;
    }
  }
}
