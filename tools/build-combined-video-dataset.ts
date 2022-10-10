import fs from 'fs';
import path from 'path';
import { Feature, Geometry } from 'geojson';
import * as topojson from 'topojson';
import { combineTolologies, SimpleTopology } from './topojson-utils';
import { VideoProperties } from './parse/gopro-gps';
import { GeometryObject } from 'topojson-specification';

const appDataPath = path.join(__dirname, '../app-data/');

function* videoGeoJson() {
  const videoDataPath = path.join(appDataPath, 'video-metadata');

  for (const basename of fs.readdirSync(videoDataPath)) {
    if (basename.endsWith('.geojson')) {
      const filename = path.join(videoDataPath, basename);
      const geoJson = JSON.parse(fs.readFileSync(filename, 'utf8')) as Feature<
        Geometry,
        VideoProperties
      >;
      geoJson.id = basename.replace(/\.geojson$/, '');
      yield {
        filename,
        geoJson,
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
      const topology = topojson.topology({ geoJson }) as SimpleTopology<
        GeometryObject<VideoProperties>
      >;
      const simplified = topojson.presimplify(topology);
      // TODO is there a good general minWeight value based on the level of detail expected? this value was chosen with minimal trial and error
      const minWeight = topojson.quantile(simplified, 0.07);
      yield topojson.simplify(simplified, minWeight);
    } catch (e) {
      console.error(`error processing ${filename}`);
    }
  }
}

export default function () {
  const bigTopo = combineTolologies(videoTopoJson(), (properties) => ({
    type: 'video',
    ...properties,
  }));

  console.log(JSON.stringify(bigTopo, null, 2));
}
