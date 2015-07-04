/* eslint-disable camelcase */
import {feature} from './geo';

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
      movingTime: moving_time
    });
    return result;
  });

  for (const trip of trips) {
    const {features: [{properties}]} = trip;
    for (const video of videos.values()) {
      if (properties.start <= video.end && properties.end >= video.start) {
        video.trips.push(trip);
        properties.videos.push(video);
      }
    }
  }

  return trips;
});
