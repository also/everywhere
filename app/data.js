import topojson from 'topojson';


import waysGeojson from 'json!../highways-clipped-topo.geojson';
import boundaryGeojson from 'json!../somerville-topo.geojson';
import contours from 'json!../contour.geojson';

function feature(geojson) {
  return topojson.feature(geojson, geojson.objects[Object.keys(geojson.objects)[0]]);
}

const ways = feature(waysGeojson);
const boundary = feature(boundaryGeojson);

const tripContext = require.context('json!../trips');
const trips = tripContext.keys().map(name => feature(tripContext(name)));

export {ways, boundary, contours, trips};
