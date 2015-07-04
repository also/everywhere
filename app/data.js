import {feature} from './geo';

import videos from './videos';
import {ways, groupedWays, intersections} from './ways';

import tripsPromise from './trips';

import boundaryGeojson from 'compact-json!../app-data/somerville-topo.geojson';
import contoursTopojson from 'compact-json!../app-data/contour.geojson';

const boundary = feature(boundaryGeojson);
const contours = feature(contoursTopojson);

export {ways, boundary, contours, tripsPromise, groupedWays, videos, intersections};
