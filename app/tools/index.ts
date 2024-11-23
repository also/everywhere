import { FileWithDetails } from '../file-data';

import swarmTool from './swarm';

import anythingTool from './anything';
import alltrailsGpxTool from './alltrails-gpx';
import stravaTool from './strava';

export interface Tool<T> {
  createState(): T;
  processFile(
    file: {
      file: FileWithDetails;
      type: 'osm' | 'generic';
    },
    state: T
  ): Promise<GeoJSON.GeoJSON | undefined>;
}

export type ToolFunction = (file: {
  file: FileWithDetails;
  type: 'osm' | 'generic';
}) => Promise<GeoJSON.GeoJSON | undefined>;

export const tools: Record<string, ToolFunction | Tool<any>> = {
  strava: stravaTool,
  alltrailsGpx: alltrailsGpxTool,
  swarm: swarmTool,
  anything: anythingTool,
};
