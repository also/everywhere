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

async function extractGps(filename: string): Promise<GeoJSON.Feature> {
  const data = new SeekableFileBuffer(
    fs.openSync(filename, 'r'),
    Buffer.alloc(10240)
  );

  const mp4 = bind(mp4Parser, data, fileRoot(data));

  const track = await getMeta(mp4);
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

  let dropped;

  if (samples) {
    for await (const sample of iterateMetadataSamples(samples)) {
      const gpsData = await extractGpsSample(data, sample);
      // most of my videos have gps data in all samples, but not quite all
      // just GPS disabled?
      if (gpsData) {
        const { GPS5, GPSU, GPSP, GPSF } = gpsData;
        if (GPSP < 500 && GPSF === 3) {
          GPS5.forEach(([lat, lon, alt]) =>
            coordinates.push([lon, lat, alt, GPSU])
          );
        } else {
          dropped = true;
        }
      }
    }
  }

  // it's not quite to spec to include extra data in coordinates
  // https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.1
  return {
    type: 'Feature',
    properties: {
      creationTime,
      duration,
      cameraModelName,
      mediaUID,
      firmware,
      dropped,
    },
    geometry: {
      type: 'LineString',
      coordinates,
    },
  };
}

export default async function ({ _: [filename] }: { _: string[] }) {
  const files = fs.statSync(filename).isDirectory()
    ? fs
        .readdirSync(filename)
        .filter((f) => f.toLowerCase().endsWith('.mp4'))
        .map((f) => path.join(filename, f))
    : [filename];

  let i = 0;
  for (const f of files) {
    const basename = path.basename(f);
    console.log(basename, (i++ / files.length) * 100);
    const dest = path.join(
      __dirname,
      '..',
      'app-data',
      'video-metadata',
      basename + '.geojson'
    );

    if (!fs.existsSync(dest) || true) {
      try {
        const geojson = await extractGps(f);
        fs.writeFileSync(dest, JSON.stringify(geojson));
      } catch (e) {
        console.log(e);
      }
    }
  }
}
