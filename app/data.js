import topojson from 'topojson';
import sortBy from 'lodash/collection/sortBy';


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


const waysByName = new Map();
const unsortedGroupedWays = [];

ways.features.forEach(way => {
  const {properties: {name}} = way;
  let wayFeatures = waysByName.get(name);
  if (!wayFeatures) {
    wayFeatures = [];
    waysByName.set(name, wayFeatures);
    unsortedGroupedWays.push({name, features: wayFeatures});
  }
  wayFeatures.push(way);
});

const groupedWays = sortBy(unsortedGroupedWays, ({name}) => name);

export {ways, boundary, contours, trips, groupedWays};
