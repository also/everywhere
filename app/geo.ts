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

import makeTree from './tree';

export function features<
  G extends GeoJSON.Geometry,
  T extends TopoJSON.Properties
>(geojson: TopoJSON.Topology<TopoJSON.Objects<T>>): FeatureCollection<G, T> {
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

export function geoLines(feat) {
  return (feat.type === 'FeatureCollection' ? feat.features : [feat])
    .map(({ geometry }) => geometry)
    .filter(({ type }) => type === 'LineString' || type === 'MultiLineString');
}

export function featureCollection(features): FeatureCollection {
  return { type: 'FeatureCollection', features: features };
}

export function tree<T>(
  feat:
    | Feature<LineString | MultiLineString | Polygon, T>
    | FeatureCollection<LineString | MultiLineString | Polygon, T>
) {
  const arcs: {
    arc: Position[];
    data: Feature<LineString | MultiLineString | Polygon, T>;
  }[] = [];

  (feat.type === 'FeatureCollection' ? feat.features : [feat]).forEach(feat => {
    (feat.geometry.type === 'MultiLineString' ||
    feat.geometry.type === 'Polygon'
      ? feat.geometry.coordinates
      : [feat.geometry.coordinates]
    ).forEach(arc => {
      arcs.push({ arc, data: feat });
    });
  });

  return makeTree<Feature<LineString | MultiLineString | Polygon, T>>({
    arcs,
  });
}
