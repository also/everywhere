import { Feature, FeatureCollection, LineString } from 'geojson';
import { FileWithHandle } from 'browser-fs-access';
import { SeekableBlobBuffer } from '../tools/parse/buffers';
import { extractGps, VideoProperties } from '../tools/parse/gopro-gps';
import { bind, fileRoot } from '../tools/parse';
import { parser as mp4Parser } from '../tools/parse/mp4';
import { getMeta } from '../tools/parse/gpmf';
import { FeatureOrCollection, features, singleFeature } from './geo';
import { DataSet } from './data';
import { buildDataSet, RawStravaTripFeature } from './trips';
import { RawVideoFeature, toChapter, VideoChapter } from './videos';
import { CompleteActivity } from '../tools/strava-api';
import { completeActivityToGeoJson } from '../tools/strava';

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

export async function mp4ToGeoJson(
  blob: Blob
): Promise<Feature<LineString, VideoProperties>> {
  const data = new SeekableBlobBuffer(blob, 1024000);
  const mp4 = bind(mp4Parser, data, fileRoot(data));
  const track = await getMeta(mp4);
  return await extractGps(track, mp4);
}

export async function readFile({
  file,
  inferredType,
}: FileWithDetails): Promise<Feature | FeatureCollection | undefined> {
  let geojson: Feature | FeatureCollection | undefined;
  if (inferredType === '.mp4') {
    geojson = await mp4ToGeoJson(file);
  } else {
    const text = await file.text();
    const json = JSON.parse(text);
    if (isProbablyStravaCompleteActivity(json)) {
      geojson = completeActivityToGeoJson(json);
    } else if (json.type === 'Topology') {
      geojson = features(json);
    } else {
      geojson = json as Feature;
    }
  }
  return geojson;
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

export async function readToDataset(
  newFiles: FileHandleWithDetails[]
): Promise<DataSet> {
  const trips: RawStravaTripFeature[] = [];

  const videoChapters: VideoChapter[] = [];
  for (const file of newFiles) {
    const geojson = await readFile(file);
    if (!geojson) {
      continue;
    }

    const name = file.file.name;

    const f = singleFeature(geojson) || geojson;
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
