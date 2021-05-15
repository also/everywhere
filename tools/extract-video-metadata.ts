import fs from 'fs';
import { SeekableFileBuffer } from './parse/buffers';
import {
  getMetaTrack,
  iterateMetadataSamples,
  extractGpsSample,
} from './parse/gpmf';
import { parser as mp4Parser } from './parse/mp4';
import { bind, fileRoot, root } from './parse';

function extractGps(filename: string) {
  const data = new SeekableFileBuffer(
    fs.openSync(filename, 'r'),
    Buffer.alloc(10240)
  );

  const mp4 = bind(mp4Parser, data, fileRoot(data));

  const track = getMetaTrack(mp4);
  const { creationTime, duration } = track;

  const coordinates: [longitude: number, latitude: number, altitude: number, timestamp: number][] = [];

  for (const sample of iterateMetadataSamples(track)) {
    const { GPS5, GPSU } = extractGpsSample(data, sample);
    GPS5.forEach(([lat, lon, alt]) => coordinates.push([lon, lat, alt, GPSU]));
  }

  // it's not quite to spec to include extra data in coordinates
  // https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.1
  const geoJson: GeoJSON.Feature = {
    type: 'Feature',
    properties: { creationTime, duration },
    geometry: {
      type: 'LineString',
      coordinates,
    },
  };

  console.log(JSON.stringify(geoJson));
}

export default function({ _: [filename] }: { _: string[] }) {
  extractGps(filename);
}
