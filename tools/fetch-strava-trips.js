import axios from 'axios';
import * as topojson from 'topojson';

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

async function get(path) {
  const { data: result } = await axios.get(
    `https://www.strava.com/api/v3/${path}`,
    {
      headers: { Authorization: `Bearer ${stravaAuth.access_token}` },
    }
  );
  if (result.errors && result.errors.length > 0) {
    throw new Error(JSON.stringify(result));
  } else {
    return result;
  }
}

export function getTrips() {
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

export default async function({ _: [id] }) {
  const activity = await getTrip(id);
  const streams = await getStreams(activity);
  const gj = streamsToGeoJson(streams);
  const result = geoJsonToTopoJson(gj);
  console.log(JSON.stringify(result));
}
