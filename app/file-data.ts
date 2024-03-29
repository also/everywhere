import { Feature, FeatureCollection, LineString } from 'geojson';
import { FileWithHandle } from 'browser-fs-access';
import { SeekableBlobBuffer } from '../tools/parse/buffers';
import { extractGps, VideoProperties } from '../tools/parse/gopro-gps';
import { bind, fileRoot, Traverser } from '../tools/parse';
import { Box, parser as mp4Parser } from '../tools/parse/mp4';
import { getMeta, Metadata } from '../tools/parse/gpmf';
import { FeatureOrCollection, features, singleFeature } from './geo';
import { DataSet } from './data';
import { buildDataSet, RawStravaTripFeature } from './trips';
import { RawVideoFeature, toChapter, VideoChapter } from './videos';
import { CompleteActivity } from '../tools/strava-api';
import { completeActivityToGeoJson } from '../tools/strava';

export interface FileWithDetails {
  file: FileWithHandle;
  inferredType?: string;
}

export type SomeFile = {
  geojson: Feature | FeatureCollection;
  json?: any;
  mp4?: Traverser<Box>;
  track?: Metadata;
  raw: FileWithHandle;
};

function isProbablyStravaCompleteActivity(json: any): json is CompleteActivity {
  return json.activity && json.streams;
}

export async function mp4ToGeoJson(
  file: File
): Promise<Feature<LineString, VideoProperties>> {
  const data = new SeekableBlobBuffer(file, 1024000);
  const mp4 = bind(mp4Parser, data, fileRoot(data));
  const track = await getMeta(mp4);
  return await extractGps(track, mp4);
}

export async function readFile({ file }: FileWithDetails): Promise<SomeFile> {
  let geojson: Feature | FeatureCollection | undefined;
  let mp4;
  let track;
  let json;
  if (file.name.toLowerCase().endsWith('.mp4')) {
    const data = new SeekableBlobBuffer(file, 1024000);
    mp4 = bind(mp4Parser, data, fileRoot(data));
    track = await getMeta(mp4);
    geojson = await extractGps(track, mp4);
  } else {
    const text = await file.text();
    json = JSON.parse(text);
    if (isProbablyStravaCompleteActivity(json)) {
      geojson = completeActivityToGeoJson(json);
    } else if (json.type === 'Topology') {
      geojson = features(json);
    } else {
      geojson = json as Feature;
    }
  }
  if (!geojson) {
    geojson = {
      type: 'FeatureCollection',
      features: [],
    };
  }
  (geojson.type === 'FeatureCollection' ? geojson.features : [geojson]).forEach(
    (feat) => {
      if (!feat.properties) {
        feat.properties = {};
      }
      feat.properties.filename = file.name;
    }
  );
  return { json, geojson, mp4, track, raw: file };
}

export function readFiles(files: FileWithDetails[]): Promise<SomeFile[]> {
  return Promise.all(files.map((file) => readFile(file)));
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

export function readToDataset(newFiles: SomeFile[]): DataSet {
  const trips: RawStravaTripFeature[] = [];

  const videoChapters: VideoChapter[] = [];
  newFiles.forEach(({ geojson, raw: { name } }) => {
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
  });

  return buildDataSet(trips, videoChapters);
}

export async function peekFile(file: FileWithHandle) {
  // todo look for ftyp?
  if (file.name.toLowerCase().endsWith('.mp4')) {
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
