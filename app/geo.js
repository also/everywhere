import topojson from 'topojson';

export function feature(geojson) {
  return topojson.feature(geojson, geojson.objects[Object.keys(geojson.objects)[0]]);
}

export function geoLines(geoJson) {
  return geoJson.features.map(({geometry}) => geometry).filter(({type}) => type === 'LineString' || type === 'MultiLineString');
}
