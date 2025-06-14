import { GeoJSON } from 'geojson';

import { FileWithDetails, getFilename } from '../file-data';

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

export async function getFileText(file: FileWithDetails): Promise<string> {
  switch (file.type) {
    case 'handle':
      return file.file.text();
    case 'contents':
      return file.file.text();
    case 'url':
      const response = await fetch(file.url);
      return response.text();
  }
}

export async function getFileBlob(file: FileWithDetails): Promise<Blob> {
  switch (file.type) {
    case 'handle':
    case 'contents':
      return file.file;
    case 'url':
      const response = await fetch(file.url);
      return response.blob();
  }
}

export async function getJsonFromFile(
  file: FileWithDetailsAndMaybeJson
): Promise<any> {
  if (file.json) {
    return file.json;
  }
  return JSON.parse(await getFileText(file.file));
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

export function getTools(file: FileWithDetails): {
  tool: ToolWithName;
  status: 'yes' | 'no' | 'maybe' | 'unknown';
}[] {
  const filename = getFilename(file);
  const extension = filename.split('.').pop()!.toLowerCase();
  return Object.values(tools).map((tool) => ({
    tool,
    status: tool.couldProcessFileByExtension
      ? tool.couldProcessFileByExtension(extension)
      : 'unknown',
  }));
}

export function getPossibleTools(file: FileWithDetails): {
  yes: ToolWithName[];
  maybe: ToolWithName[];
} {
  const yes: ToolWithName[] = [];
  const maybe: ToolWithName[] = [];
  for (const { tool, status } of getTools(file)) {
    if (status === 'yes') {
      yes.push(tool);
    } else if (status === 'maybe') {
      maybe.push(tool);
    }
  }

  return { yes, maybe };
}

export async function findTool(
  file: FileWithDetailsAndMaybeJson
): Promise<ToolWithName[]> {
  const { yes, maybe } = getPossibleTools(file.file);

  for (const tool of maybe) {
    if (tool.couldProcessFileByJson) {
      const json = (file.json = await getJsonFromFile(file));
      const result = tool.couldProcessFileByJson(json);
      if (result === 'yes') {
        yes.push(tool);
      }
    }
  }

  return yes;
}
