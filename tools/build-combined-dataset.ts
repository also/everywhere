import fs from 'fs';
import path from 'path';

import { combineTolologies, SimpleTopology } from './topojson-utils';

const appDataPath = path.join(__dirname, '../app-data/');

function* stravaTopologies() {
  const tripsPath = path.join(appDataPath, 'strava-trips');
  for (const tripFile of fs.readdirSync(tripsPath)) {
    const match = tripFile.match(/strava-(\d+)\.geojson/);
    if (match) {
      const trip: SimpleTopology = JSON.parse(
        fs.readFileSync(path.join(tripsPath, tripFile), 'utf8')
      );

      yield trip;
    }
  }
}

export default function () {
  const bigTopo = combineTolologies(stravaTopologies());

  // const videoDataPath = path.join(appDataPath, 'video-metadata');
  // const videos = [];
  // const videoTrips: Feature[] = [];

  // for (const videoFile of fs.readdirSync(videoDataPath)) {
  //   const filename = fs.readFileSync(
  //     path.join(videoDataPath, videoFile),
  //     'utf8'
  //   );
  //   const video = JSON.parse(filename);
  //   const match = videoFile.match(/(.+)\.json/);
  //   if (match) {
  //     video.name = match[1] + '.MP4';
  //     videos.push(video);
  //   } else {
  //     const geoJson = video as Feature;

  //     if (
  //       geoJson.geometry.type !== 'Point' &&
  //       geoJson.geometry.type !== 'GeometryCollection' &&
  //       geoJson.geometry.coordinates.length > 0
  //     ) {
  //       const topology = topojson.topology({ geoJson });
  //       addTopology(bigTopo, topology);
  //     }
  //     videoTrips.push(geoJson);
  //   }
  // }

  // const featureColl: FeatureCollection = {
  //   type: 'FeatureCollection',
  //   features: videoTrips,
  // };

  console.log(JSON.stringify(bigTopo, null, 2));
}
