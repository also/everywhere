import { LineString } from 'geojson';
import { Traverser } from '.';
import { iterateMetadataSamples, extractGpsSample, Metadata } from './gpmf';
import { Box } from './mp4';

export interface VideoProperties {
  creationTime: number;
  duration: number;
  cameraModelName: string | undefined;
  mediaUID: string;
  firmware: string;
  dropped: boolean | undefined;
}

export async function extractGps(
  track: Metadata,
  mp4: Traverser<Box>
): Promise<GeoJSON.Feature<LineString, VideoProperties>> {
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
      const gpsData = await extractGpsSample(mp4.data, sample);
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
