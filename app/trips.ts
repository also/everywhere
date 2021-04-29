/* eslint-disable camelcase */
import { feature, tree } from './geo';
import { group } from './tree';
import moment from 'moment';

import videos from './videos';

const tripData = import('./trip-data');

function load(trip) {
  const result = feature(trip);
  const { properties, geometry } = result;
  properties.videos = [];
  const {
    activity: {
      id,
      start_date,
      total_elevation_gain,
      max_speed,
      distance,
      elapsed_time,
      moving_time,
    },
  } = properties;

  const start = moment(start_date);

  Object.assign(properties, {
    id,
    start,
    end: start.clone().add(elapsed_time, 's'),
    movingTime: moment.duration(moving_time, 's'),
    tree: tree(result),
  });
  return result;
}

function calculateVideoCoverage(trips, videos) {
  const videoCoverage = [];

  for (const trip of trips) {
    const { properties } = trip;
    for (const video of videos.values()) {
      if (properties.start <= video.end && properties.end >= video.start) {
        video.trips.push(trip);
        properties.videos.push(video);

        const { geometry } = trip;
        let tripCoords = geometry.coordinates;
        if (geometry.type === 'LineString') {
          tripCoords = [tripCoords];
        }
        const coordinates = tripCoords
          .map(coords =>
            coords.filter(coord => {
              const [, , , timeOffset] = coord;
              const time = timeOffset * 1000 + +properties.start;
              return time >= video.start && time <= video.end;
            })
          )
          .filter(({ length }) => length > 0);

        if (coordinates.length > 0) {
          const covProperties = Object.assign({ video }, properties);
          const coverage = {
            type: 'Feature',
            properties: covProperties,
            geometry: {
              type: 'MultiLineString',
              coordinates,
            },
          };
          covProperties.tree = tree(coverage);

          videoCoverage.push(coverage);
          video.coverage.push(coverage);
        }
      }
    }
  }

  return videoCoverage;
}

export default tripData.then(({ default: tripTopojson }) => {
  const trips = tripTopojson.map(load);

  const videoCoverage = calculateVideoCoverage(trips, videos);

  const tripTree = group(trips.map(({ properties: { tree } }) => tree));

  const videoTree = group(
    Array.from(videos.values())
      .map(video => {
        video.coverageTree = group(
          video.coverage.map(({ properties: { tree } }) => tree)
        );
        return video.coverageTree;
      })
      .filter(n => n)
  );

  return { trips, videoCoverage, tripTree, videoTree };
});
