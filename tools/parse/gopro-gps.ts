import { bind, fileRoot } from '.';
import { SeekableBuffer } from './buffers';
import { getMeta, iterateMetadataSamples, extractGpsSample } from './gpmf';
import { parser as mp4Parser } from './mp4';

export async function extractGps(
  data: SeekableBuffer
): Promise<GeoJSON.Feature> {
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
