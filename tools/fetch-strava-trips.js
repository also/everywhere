import requestNode from 'request';
import Promise from 'bluebird';
import topojson from 'topojson';

import { distance } from '../app/distance';

import stravaAuth from '../creds/strava.json';

const streamNames = [
  'latlng',
  'altitude',
  'time',
  'distance',
  'velocity_smooth',
  'heartrate',
  'cadence',
  'watts',
  'temp',
  'moving',
  'grade_smooth',
];

const otherStreamNames = streamNames.slice(1);

const request = Promise.promisify(requestNode);

function get(path) {
  return request({
    url: `https://www.strava.com/api/v3/${path}`,
    headers: { Authorization: `Bearer ${stravaAuth.access_token}` },
  }).then(([response, body]) => {
    const result = JSON.parse(body);
    if (result.errors && result.errors.length > 0) {
      return Promise.reject(result);
    } else {
      return result;
    }
  });
}

function getTrips() {
  return get('athlete/activities');
}

function getTrip(id) {
  return get(`activities/${id}`);
}

function getStreams(activity) {
  return get(`activities/${activity.id}/streams/${streamNames.join(',')}`).then(
    streams => {
      const streamsByType = { activity };
      streams.forEach(({ type, data }) => (streamsByType[type] = data));
      return streamsByType;
    }
  );
}

function streamsToGeoJson(streams) {
  const orderedStreams = [];
  otherStreamNames.forEach(type => {
    if (streams[type]) {
      orderedStreams.push(streams[type]);
    }
  });

  const coordinates = [];
  let currentCoordinates = null;

  let currentPosition = null;

  streams.latlng.forEach(([lat, lng], i) => {
    if (!currentPosition || distance(lng, lat, ...currentPosition) > 100) {
      currentCoordinates = [];
      coordinates.push(currentCoordinates);
    }

    currentPosition = [lng, lat];

    currentCoordinates.push([
      lng,
      lat,
      ...orderedStreams.map(stream => stream[i]),
    ]);
  });

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: streams.activity.id,
        properties: { activity: streams.activity },
        geometry: {
          type: 'MultiLineString',
          coordinates: coordinates,
        },
      },
    ],
  };
}

function geoJsonToTopoJson(geoJson) {
  return topojson.topology(
    { geoJson },
    { 'property-transform': f => f.properties }
  );
}

export default function({ _: [id] }) {
  //getTrips()
  // .then(trips);
  getTrip(id)
    .then(getStreams)
    .then(streamsToGeoJson)
    .then(geoJsonToTopoJson)
    .then(result => {
      console.log(JSON.stringify(result));
    })
    .catch(result => {
      console.error('error', result.stack || JSON.stringify(result));
    });
}
