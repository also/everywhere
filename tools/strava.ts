import path from 'path';
import fs from 'fs';
import { SimpleTopology } from './topojson-utils';
import { RawStravaTripProperties } from '../app/trips';

const appDataPath = path.join(__dirname, '../app-data/');
const tripsPath = path.join(appDataPath, 'strava-trips');

export function* stravaTopologies() {
  for (const tripFile of fs.readdirSync(tripsPath)) {
    const match = tripFile.match(/strava-(\d+)\.geojson/);
    if (match) {
      const trip: SimpleTopology<
        TopoJSON.GeometryObject<RawStravaTripProperties>
      > = JSON.parse(fs.readFileSync(path.join(tripsPath, tripFile), 'utf8'));

      yield trip;
    }
  }
}
