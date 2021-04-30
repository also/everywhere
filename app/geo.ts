import {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Position,
} from 'geojson';
import * as topojson from 'topojson';
import * as TopoJSON from 'topojson-specification';

import makeTree from './tree';
import { CoverageFeature } from './trips';

export function features<
  T extends TopoJSON.Objects<TopoJSON.Properties> = TopoJSON.Objects<
    TopoJSON.Properties
  >
>(geojson: TopoJSON.Topology<T>): FeatureCollection {
  return topojson.feature(
    geojson,
    geojson.objects[Object.keys(geojson.objects)[0]]
  );
}

export function feature(geojson: TopoJSON.Topology) {
  return features(geojson).features[0];
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
    | Feature<LineString | MultiLineString, T>
    | FeatureCollection<LineString | MultiLineString, T>
) {
  const arcs: (Position[] & {
    feature: Feature<LineString | MultiLineString, T>;
  })[] = [];

  (feat.type === 'FeatureCollection' ? feat.features : [feat]).forEach(feat => {
    (feat.geometry.type === 'MultiLineString'
      ? feat.geometry.coordinates
      : [feat.geometry.coordinates]
    ).forEach(arc => {
      arc.feature = feat;
      arcs.push(arc);
    });
  });

  return makeTree<{
    feature: Feature<LineString | MultiLineString, T>;
  }>({ arcs });
}
