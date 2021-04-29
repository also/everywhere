import { FeatureCollection } from 'geojson';
import * as topojson from 'topojson';
import * as TopoJSON from 'topojson-specification';

import makeTree from './tree';

export function features(geojson: TopoJSON.Topology) {
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

export function tree(feat) {
  const arcs = [];

  (feat.type === 'FeatureCollection' ? feat.features : [feat]).forEach(feat => {
    (feat.geometry.type === 'MultiLineString'
      ? feat.geometry.coordinates
      : [feat.geometry.coordinates]
    ).forEach(arc => {
      arc.feature = feat;
      arcs.push(arc);
    });
  });

  return makeTree({ arcs });
}
