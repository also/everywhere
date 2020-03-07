import sortBy from 'lodash/collection/sortBy';

import {features, tree} from './geo';

import waysGeojson from 'compact-json!../app-data/highways-clipped-topo.geojson';
import intersectionsTopojson from 'compact-json!../app-data/intersections-clipped-topo.geojson';

const ways = features(waysGeojson);
const intersections = features(intersectionsTopojson);

const waysById = new Map();

ways.features.forEach(way => {
  waysById.set(way.properties.id, way);
  way.properties.displayName = way.properties.name || way.properties.id;
  way.intersections = [];
});

export function group(features) {
  const waysByName = new Map();
  const unsortedGroupedWays = [];
  features.forEach(way => {
    const {properties: {displayName}} = way;
    let wayFeatures = waysByName.get(displayName);
    if (!wayFeatures) {
      wayFeatures = [];
      waysByName.set(displayName, wayFeatures);
      unsortedGroupedWays.push({displayName, features: wayFeatures});
    }
    wayFeatures.push(way);
  });

  return sortBy(unsortedGroupedWays, ({displayName}) => displayName);
}

const groupedWays = group(ways.features);

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

const wayTree = tree(ways);

export {ways, groupedWays, intersections, wayTree, waysById};
