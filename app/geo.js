import topojson from 'topojson';

import makeTree from './tree';

export function features(geojson) {
  return topojson.feature(geojson, geojson.objects[Object.keys(geojson.objects)[0]]);
}

export function feature(geojson) {
  return features(geojson).features[0];
}

export function geoLines(geoJson) {
  return geoJson.features.map(({geometry}) => geometry).filter(({type}) => type === 'LineString' || type === 'MultiLineString');
}

export function tree(feat) {
  const arcs = [];

  (feat.type === 'FeatureCollection' ? feat.features : [feat]).forEach(feat => {
    (feat.geometry.type === 'MultiLineString' ? feat.geometry.coordinates : [feat.geometry.coordinates]).forEach(arc => {
      arc.feature = feat;
      arcs.push(arc);
    });
  });

  return makeTree({arcs});
}
