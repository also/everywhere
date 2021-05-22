import {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
  Polygon,
  Position,
} from 'geojson';
import * as topojson from 'topojson';
import * as TopoJSON from 'topojson-specification';

import makeTree, { Node } from './tree';

export function features<
  G extends GeoJSON.Geometry,
  T extends TopoJSON.Properties
>(
  geojson: TopoJSON.Topology<TopoJSON.Objects<T>>
): FeatureCollection<G, T> | FeatureCollection<G, T> {
  return topojson.feature(
    geojson,
    geojson.objects[Object.keys(geojson.objects)[0]]
  );
}

export function feature<
  G extends GeoJSON.Geometry,
  T extends TopoJSON.Properties
>(geojson: TopoJSON.Topology<TopoJSON.Objects<T>>): Feature<G, T> {
  return features<G, T>(geojson).features[0];
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

export function tree<G extends LineString | MultiLineString | Polygon, T>(
  feat: Feature<G, T> | FeatureCollection<G, T>
): Node<Feature<G, T>> {
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

  return makeTree<Feature<G, T>>({
    arcs,
  });
}
