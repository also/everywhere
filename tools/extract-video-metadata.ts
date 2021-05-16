import fs from 'fs';
import path from 'path';
import { SeekableFileBuffer } from './parse/buffers';
import {
  getMeta,
  iterateMetadataSamples,
  extractGpsSample,
} from './parse/gpmf';
import { parser as mp4Parser } from './parse/mp4';
import { bind, fileRoot } from './parse';

function extractGps(filename: string): GeoJSON.Feature {
  const data = new SeekableFileBuffer(
    fs.openSync(filename, 'r'),
    Buffer.alloc(10240)
  );

  const mp4 = bind(mp4Parser, data, fileRoot(data));

  const track = getMeta(mp4);
  const {
    cameraModelName,
    mediaUID,
    firmware,
    samples,
    creationTime,
    duration,
  } = track;

  const coordinates: [
    longitude: number,
    latitude: number,
    altitude: number,
    timestamp: number
  ][] = [];

  if (samples) {
    for (const sample of iterateMetadataSamples(samples)) {
      const { GPS5, GPSU } = extractGpsSample(data, sample);
      GPS5.forEach(([lat, lon, alt]) =>
        coordinates.push([lon, lat, alt, GPSU])
      );
    }
  }

  // it's not quite to spec to include extra data in coordinates
  // https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.1
  return {
    type: 'Feature',
    properties: { creationTime, duration, cameraModelName, mediaUID, firmware },
    geometry: {
      type: 'LineString',
      coordinates,
    },
  };
}

export default function ({ _: [filename] }: { _: string[] }) {
  const files = fs.statSync(filename).isDirectory()
    ? fs
        .readdirSync(filename)
        .filter((f) => f.toLowerCase().endsWith('.mp4'))
        .map((f) => path.join(filename, f))
    : [filename];

  files.forEach((f) => {
    const basename = path.basename(f);
    console.log(basename);
    const geojson = extractGps(f);
    fs.writeFileSync(
      path.join(
        __dirname,
        '..',
        'app-data',
        'video-metadata',
        basename + '.geojson'
      ),
      JSON.stringify(geojson)
    );
  });
}
