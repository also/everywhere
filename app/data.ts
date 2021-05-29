import { feature } from './geo';

import { CoverageTree, Video } from './videos';
import { ways, groupedWays, intersections, wayTree } from './ways';

import { CoverageFeature, StravaTripFeature, TripTree } from './trips';

import boundaryGeojson from 'compact-json!../app-data/somerville-topo.geojson';
import contoursTopojson from 'compact-json!../app-data/contour.geojson';

const boundary = feature(boundaryGeojson);
const contours = feature(contoursTopojson);

export { ways, boundary, contours, groupedWays, intersections, wayTree };

export type DataSet = {
  videos: Map<string, Video>;
  trips: StravaTripFeature[];
  videoCoverage: CoverageFeature[];
  tripTree: TripTree;
  videoTree: CoverageTree;
};
