import topojson from 'topojson';
import sortBy from 'lodash/collection/sortBy';


import waysGeojson from 'json!../app-data/highways-clipped-topo.geojson';
import boundaryGeojson from 'json!../app-data/somerville-topo.geojson';
import contoursTopojson from 'json!../app-data/contour.geojson';


function feature(geojson) {
  return topojson.feature(geojson, geojson.objects[Object.keys(geojson.objects)[0]]);
}

const ways = feature(waysGeojson);
const boundary = feature(boundaryGeojson);
const contours = feature(contoursTopojson);

const tripsPromise = new Promise(resolve => {
  // note that the callback parameter must be named "require" or webpack won't notice
  require.ensure(['./trip-data'], (require) => resolve(require('./trip-data').map(feature)));
});

const videoContext = require.context('json!../app-data/video-metadata', false, /\.json$/);
const videos = new Map(
  sortBy(
    videoContext.keys()
      .map(filename => {
        const data = videoContext(filename);
        const name = filename.replace(/^\.\/(.+)\.json$/, '$1');
        const video = Object.assign({
          name,
          low: `http://static.ryanberdeen.com/everywhere/video/mp4-low/${name}.MP4`,
          high: `http://static.ryanberdeen.com/everywhere/video/mp4-high/${name}.MP4`,
          stills: Array(...Array(Math.ceil(data.duration / 30))).map((_, i) => (
            {
              small: `http://static.ryanberdeen.com/everywhere/video/thumbnails/${name}/small-${i}.jpg`,
              large: `http://static.ryanberdeen.com/everywhere/video/thumbnails/${name}/large-${i}.jpg`
            }
          ))
        }, data);
        video.thumbnail = video.stills[Math.floor(video.stills.length / 2)];
        return [name, video];
      }),
    (([name, {start}]) => start)));


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

export {ways, boundary, contours, tripsPromise, groupedWays, videos};
