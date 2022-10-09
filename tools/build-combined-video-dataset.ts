import fs from 'fs';
import path from 'path';
import { Feature } from 'geojson';
import * as topojson from 'topojson';
import { combineTolologies, SimpleTopology } from './topojson-utils';

const appDataPath = path.join(__dirname, '../app-data/');

function* videoGeoJson() {
  const videoDataPath = path.join(appDataPath, 'video-metadata');

  for (const basename of fs.readdirSync(videoDataPath)) {
    if (basename.endsWith('.geojson')) {
      const filename = path.join(videoDataPath, basename);
      yield {
        filename,
        geoJson: JSON.parse(fs.readFileSync(filename, 'utf8')) as Feature,
      };
    }
  }
}

function* videoTopoJson() {
  for (const { filename, geoJson } of videoGeoJson()) {
    if (
      geoJson.geometry.type === 'LineString' &&
      geoJson.geometry.coordinates.length === 0
    ) {
      // skip empty lines - topojson doesn't like them
      // TODO include records of videos with no location data in the combined dataset somehow?
      continue;
    }
    try {
      yield topojson.topology({ geoJson }) as SimpleTopology;
    } catch (e) {
      console.error(`error processing ${filename}`);
    }
  }
}

export default function () {
  const bigTopo = combineTolologies(videoTopoJson(), () => ({ type: 'video' }));

  console.log(JSON.stringify(bigTopo, null, 2));
}
