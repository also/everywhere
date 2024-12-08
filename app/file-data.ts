import { Feature } from 'geojson';
import { FileWithHandle } from 'browser-fs-access';
import { FeatureOrCollection } from './geo';
import { DataSet } from './data';
import { buildDataSet, RawStravaTripFeature } from './trips';
import { RawVideoFeature, toChapter, VideoChapter } from './videos';
import { CompleteActivity } from '../tools/strava-api';

export type FileWithDetails = FileHandleWithDetails | FileContentsWithDetails;

export interface BaseFileDetails {
  id: string;
  inferredType?: string;
}

export interface FileHandleWithDetails extends BaseFileDetails {
  type: 'handle';
  file: FileWithHandle;
}

export interface FileContentsWithDetails extends BaseFileDetails {
  type: 'contents';
  file: Blob;
  name: string;
}

export function getFilename(file: FileWithDetails) {
  return file.type === 'handle' ? file.file.name : file.name;
}

export function isProbablyStravaCompleteActivity(
  json: any
): json is CompleteActivity {
  return json.activity && json.streams;
}

function isProbablyStravaTrip(
  f: FeatureOrCollection<any, any>
): f is RawStravaTripFeature {
  return f.type === 'Feature' && !!f.properties?.activity?.moving_time;
}

function isProbablyVideoTrack(
  f: FeatureOrCollection<any, any>
): f is RawVideoFeature {
  return f.type === 'Feature' && !!f.properties?.creationTime;
}

export async function readToDataset(features: Feature[]): Promise<DataSet> {
  const trips: RawStravaTripFeature[] = [];

  const videoChapters: VideoChapter[] = [];
  for (const f of features) {
    // FIXME add type for these properties
    const name = f.properties?.everywhereFilename ?? 'unknown';

    if (isProbablyStravaTrip(f)) {
      trips.push(f);
    } else if (isProbablyVideoTrack(f)) {
      const start = new Date(f.properties.creationTime * 1000);
      // using current timezone :(
      start.setMinutes(start.getMinutes() + start.getTimezoneOffset());
      videoChapters.push(
        toChapter(name, {
          start: +start,
          // TODO what the hell? 90
          // this gives the right duration for GOPR0039, at least
          duration: f.properties.duration / 1000 / 1000 / 90,
        })
      );
    }
  }

  return buildDataSet(trips, videoChapters);
}

export async function peekFile(file: FileWithHandle) {
  const extension = file.name.split('.').pop()!.toLowerCase();
  if (extension === 'gpx') {
    return 'gpx';
  }
  // todo look for ftyp?
  if (extension === 'mp4') {
    return 'mp4';
  }
  const head = file.slice(0, 100);
  const value = await head.arrayBuffer();
  const array = new Uint8Array(value);
  // if json
  if (array[0] === 123) {
    const s = new TextDecoder('ascii').decode(array);
    const type = s.match(/{\s*"type"\s*:\s*"([^"]+)"/)?.[1];
    return type ?? 'json';
  }
  return 'unknown';
}
