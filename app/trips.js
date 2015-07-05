/* eslint-disable camelcase */
import {feature, tree} from './geo';

import {wayTree} from './ways';

import videos from './videos';

const tripData = new Promise(resolve => {
  // note that the callback parameter must be named "require" or webpack won't notice
  require.ensure(['./trip-data'], (require) => resolve(require('./trip-data')));
});

export default tripData.then(tripTopojson => {
  const trips = tripTopojson.map(trip => {
    const result = feature(trip);
    const {features: [{properties, coordinates}]} = result;
    properties.videos = [];
    const {activity: {id, start_date, total_elevation_gain, max_speed, distance, elapsed_time, moving_time}} = properties;

    const start = new Date(Date.parse(start_date));

    Object.assign(properties, {
      id,
      start,
      end: new Date(start.getTime() + (elapsed_time * 1000)),
      movingTime: moving_time,
      tree: tree(result)
    });
    return result;
  });

  const videoCoverage = [];

  for (const trip of trips) {
    const {features: [{properties}]} = trip;
    for (const video of videos.values()) {
      if (properties.start <= video.end && properties.end >= video.start) {
        video.trips.push(trip);
        properties.videos.push(video);

        const [{geometry}] = trip.features;
        let tripCoords = geometry.coordinates;
        if (geometry.type === 'LineString') {
          tripCoords = [tripCoords];
        }
        const coordinates = tripCoords.map(coords => coords.filter(coord => {
          const [, , , timeOffset] = coord;
          const time = timeOffset * 1000 + (+properties.start);
          return time >= video.start && time <= video.end;
        })).filter(({length}) => length > 0);

        if (coordinates.length > 0) {
          const coverage = {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              id: trip.id,
              properties: trip.properties,
              geometry: {
                type: 'MultiLineString',
                coordinates
              }
            }]
          };
          videoCoverage.push(coverage);
          video.coverage.push(coverage);
        }
      }
    }
  }

  return {trips, videoCoverage};
});
