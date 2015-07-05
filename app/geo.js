import topojson from 'topojson';

import makeTree from './tree';

export function feature(geojson) {
  return topojson.feature(geojson, geojson.objects[Object.keys(geojson.objects)[0]]);
}

export function geoLines(geoJson) {
  return geoJson.features.map(({geometry}) => geometry).filter(({type}) => type === 'LineString' || type === 'MultiLineString');
}

export function tree(featCollection) {
  const arcs = [];

  featCollection.features.forEach(feat => {
    (feat.geometry.type === 'MultiLineString' ? feat.geometry.coordinates : [feat.geometry.coordinates]).forEach(arc => {
      arc.feature = feat;
      arcs.push(arc);
    });
  });

  return makeTree({arcs});
}
