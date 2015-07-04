import sortBy from 'lodash/collection/sortBy';

import {feature} from './geo';

import waysGeojson from 'compact-json!../app-data/highways-clipped-topo.geojson';
import intersectionsTopojson from 'compact-json!../app-data/intersections-clipped-topo.geojson';

const ways = feature(waysGeojson);
const intersections = feature(intersectionsTopojson);

const waysByName = new Map();
const waysById = new Map();
const unsortedGroupedWays = [];

ways.features.forEach(way => {
  waysById.set(way.properties.id, way);
  way.intersections = [];

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

intersections.features.forEach(intersection => {
  intersection.ways = [];
  intersection.properties.refs.forEach(id => {
    const way = waysById.get(id);
    if (way) {
      way.intersections.push(intersection);
      intersection.ways.push(way);
    } else {
      console.log(`${id} does not exist. maybe it is in cambridge?`);
    }
  });
});

export {ways, groupedWays, intersections};
