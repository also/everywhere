import {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  LineString,
  MultiLineString,
  Polygon,
  Position,
} from 'geojson';
import * as topojson from 'topojson';
import * as TopoJSON from 'topojson-specification';
import RBush from 'rbush';

import makeTree, { Node } from './tree';

export type FeatureOrCollection<
  G extends Geometry,
  P extends GeoJsonProperties
> = Feature<G, P> | FeatureCollection<G, P>;

export function features<
  G extends GeoJSON.Geometry,
  T extends TopoJSON.Properties
>(geojson: TopoJSON.Topology<TopoJSON.Objects<T>>): FeatureCollection<G, T> {
  const keys = Object.keys(geojson.objects);
  if (keys.length !== 1) {
    throw new Error('expected exactly one opject in Topology');
  }
  const object = geojson.objects[keys[0]];
  if (object.type !== 'GeometryCollection') {
    throw new Error('expected object to be a GeometryCollection');
  }
  if (object.geometries.length !== 1) {
    console.log('expected a single geometry');
  }
  return topojson.feature(geojson, object);
}

export function feature<
  G extends GeoJSON.Geometry,
  T extends TopoJSON.Properties
>(geojson: TopoJSON.Topology<TopoJSON.Objects<T>>): Feature<G, T> {
  return features<G, T>(geojson).features[0];
}

export function singleFeature<G extends Geometry, P extends GeoJsonProperties>(
  f: FeatureOrCollection<G, P>
): Feature<G, P> | undefined {
  if (f.type === 'Feature') {
    return f;
  } else {
    const { features } = f;
    if (features.length === 1) {
      return features[0];
    }
  }
}

export function geoLines(feat: FeatureCollection | Feature): Geometry[] {
  return (feat.type === 'FeatureCollection' ? feat.features : [feat])
    .map(({ geometry }) => geometry)
    .filter(({ type }) => type === 'LineString' || type === 'MultiLineString');
}

export function featureCollection<T extends Geometry>(
  features: Feature<T>[]
): FeatureCollection<T> {
  return { type: 'FeatureCollection', features: features };
}

function coordses(
  geometry: LineString | MultiLineString | Polygon
): Position[][] {
  return geometry.type === 'MultiLineString' || geometry.type === 'Polygon'
    ? geometry.coordinates
    : [geometry.coordinates];
}

export function trees<G extends LineString | MultiLineString | Polygon, T>(
  feat: Feature<G, T> | FeatureCollection<G, T>
): { tree: Node<Feature<G, T>>; rtree: RBush<RTreeItem<Feature<G, T>>> } {
  const arcs: {
    arc: Position[];
    data: Feature<G, T>;
  }[] = [];

  (feat.type === 'FeatureCollection' ? feat.features : [feat]).forEach(
    (feat) => {
      coordses(feat.geometry).forEach((arc) => {
        arcs.push({ arc, data: feat });
      });
    }
  );

  console.time('rtree');
  const rtree = makeRTree(arcs);
  console.timeEnd('rtree');

  console.time('tree');
  const tree = makeTree<Feature<G, T>>(arcs);
  console.timeEnd('tree');
  return { tree, rtree };
}

export function tree<G extends LineString | MultiLineString | Polygon, T>(
  feat: Feature<G, T> | FeatureCollection<G, T>
): Node<Feature<G, T>> {
  return trees(feat).tree;
}

export interface RTreeItem<T> {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  data: T;
}

function makeRTree<G extends LineString | MultiLineString | Polygon, T>(
  arcs: {
    arc: Position[];
    data: Feature<G, T>;
  }[]
) {
  const tree = new RBush<RTreeItem<Feature<G, T>>>();
  const items: RTreeItem<Feature<G, T>>[] = [];
  arcs.forEach(({ arc, data }) => {
    let i = 0;
    const n = arc.length;
    let p0;
    let p1 = arc[0];

    while (++i < n) {
      p0 = p1;
      p1 = arc[i];
      const minX = Math.min(p0[0], p1[0]);
      const minY = Math.min(p0[1], p1[1]);
      const maxX = Math.max(p0[0], p1[0]);
      const maxY = Math.max(p0[1], p1[1]);
      items.push({
        minX,
        minY,
        maxX,
        maxY,
        data,
      });
    }
  });

  tree.load(items);

  return tree;
}
