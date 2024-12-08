import { GeoJSON } from 'geojson';

import { FileWithDetails } from '../file-data';

import swarmTool from './swarm';

import anythingTool from './anything';
import alltrailsGpxTool from './alltrails-gpx';
import stravaTool from './strava';
import geojsonTool from './geojson';
import mp4Tool from './mp4';

export interface FileWithDetailsAndMaybeJson {
  file: FileWithDetails;
  json?: any;
}

export async function getJsonFromFile(
  file: FileWithDetailsAndMaybeJson
): Promise<any> {
  if (file.json) {
    return file.json;
  }
  return JSON.parse(await file.file.file.text());
}

interface BaseTool<T> {
  couldProcessFileByExtension?: (extension: string) => 'yes' | 'maybe' | 'no';
  couldProcessFileByJson?: (json: any) => 'yes' | 'no';
  processFile(
    file: FileWithDetailsAndMaybeJson,
    state: T
  ): Promise<GeoJSON | undefined>;
}

export interface StatefulTool<T> extends BaseTool<T> {
  createState(): T;
}

export type Tool = BaseTool<undefined>;

export type AnyTool = Tool | StatefulTool<any>;

export interface ToolWithName extends StatefulTool<any> {
  name: string;
}

export const tools: Record<string, ToolWithName> = Object.fromEntries(
  Object.entries({
    mp4: mp4Tool,
    geojson: geojsonTool,
    strava: stravaTool,
    alltrailsGpx: alltrailsGpxTool,
    swarm: swarmTool,
    anything: anythingTool,
  }).map(([name, t]) => [
    name,
    {
      createState() {
        return undefined;
      },
      ...t,
      name,
    },
  ])
);
