import sortBy from 'lodash/collection/sortBy';

import { features, tree } from './geo';

import waysGeojson from 'compact-json!../app-data/highways-clipped-topo.geojson';
import intersectionsTopojson from 'compact-json!../app-data/intersections-clipped-topo.geojson';
import { Feature, FeatureCollection, LineString, Point } from 'geojson';

type WayProperties = {
  name?: string;
  id: string;

  highway: string;

  // we're writing this one
  displayName: string;
  intersections: IntersectionFeature[];
};

type IntersectionProperties = {
  refs: string[];
  ways: WayFeature[];
};

export type GroupedWays = {
  displayName: string;
  features: WayFeature[];
};

export type WayFeature = Feature<LineString, WayProperties>;

export type IntersectionFeature = Feature<Point, IntersectionProperties>;

const ways: FeatureCollection<LineString, WayProperties> = features(
  waysGeojson
);
const intersections: FeatureCollection<
  Point,
  IntersectionProperties
> = features(intersectionsTopojson);

const waysById: Map<string, WayFeature> = new Map();

ways.features.forEach(way => {
  waysById.set(way.properties.id, way);
  way.properties.displayName = way.properties.name || way.properties.id;
  way.properties.intersections = [];
});

export function group(features: WayFeature[]): GroupedWays[] {
  const waysByName: Map<string, WayFeature[]> = new Map();
  const unsortedGroupedWays: GroupedWays[] = [];
  features.forEach(way => {
    const {
      properties: { displayName },
    } = way;
    let wayFeatures = waysByName.get(displayName);
    if (!wayFeatures) {
      wayFeatures = [];
      waysByName.set(displayName, wayFeatures);
      unsortedGroupedWays.push({ displayName, features: wayFeatures });
    }
    wayFeatures.push(way);
  });

  return sortBy(unsortedGroupedWays, ({ displayName }) => displayName);
}

const groupedWays = group(ways.features);

intersections.features.forEach(intersection => {
  intersection.properties.ways = [];
  intersection.properties.refs.forEach(id => {
    const way = waysById.get(id);
    if (way) {
      way.properties.intersections.push(intersection);
      intersection.properties.ways.push(way);
    } else {
      // console.log(`${id} does not exist. maybe it is in cambridge?`);
    }
  });
});

const wayTree = tree(ways);

export { ways, groupedWays, intersections, wayTree, waysById };
