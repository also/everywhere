import { Feature, LineString } from 'geojson';
import { FileWithHandle } from 'browser-fs-access';
import { FeatureOrCollection } from './geo';
import { DataSet } from './data';
import { buildDataSet, RawStravaTripFeature } from './trips';
import {
  RawVideoFeature,
  RawVideoProperties,
  toChapter,
  VideoChapter,
} from './videos';
import { CompleteActivity } from '../tools/strava-api';

export type FileWithDetails =
  | FileHandleWithDetails
  | FileContentsWithDetails
  | FileUrlWithDetails;

export type LocalFileWithDetails =
  | FileHandleWithDetails
  | FileContentsWithDetails;

export interface BaseFileDetails {
  id: string;
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

export interface FileUrlWithDetails extends BaseFileDetails {
  type: 'url';
  url: string;
  name: string;
}

export function getFilename(file: FileWithDetails) {
  switch (file.type) {
    case 'handle':
      return file.file.name;
    case 'contents':
      return file.name;
    case 'url':
      return file.name;
  }
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

  return buildDataSet(trips, videoChapters, false);
}

export function datasetToFiles(dataset: DataSet): FileContentsWithDetails[] {
  let i = 0;
  const files: FileContentsWithDetails[] = [];
  for (const trip of dataset.trips) {
    const simpleTrip = {
      ...trip,
      properties: {
        type: 'strava-trip',
        activity: trip.properties.activity,
      },
    };
    files.push({
      type: 'contents',
      file: new Blob([JSON.stringify(simpleTrip)], {
        type: 'application/json',
      }),
      name: `${trip.properties.activity.id}.geojson`,
      id: i++ + '',
    });
  }
  for (const video of dataset.videos.values()) {
    for (const chapter of video.chapters) {
      const simpleVideo: Feature<LineString, RawVideoProperties> = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [],
        },
        properties: {
          creationTime: chapter.start.valueOf() / 1000,
          duration: chapter.duration / 1000 / 1000 / 90,
        },
      };
      files.push({
        type: 'contents',
        file: new Blob([JSON.stringify(simpleVideo)], {
          type: 'application/json',
        }),
        name: chapter.name + '.MP4.geojson',
        id: i++ + '',
      });
    }
  }
  return files;
}
