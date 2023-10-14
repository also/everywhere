import fs from 'fs';
import path from 'path';
import { stravaTopologies } from './strava-files';

export default function () {
  const appDataPath = path.join(__dirname, '../app-data/');

  const trips = [];
  for (const trip of stravaTopologies()) {
    trips.push(trip);
  }

  const videoDataPath = path.join(appDataPath, 'video-metadata');
  const videos = [];
  for (const videoFile of fs.readdirSync(videoDataPath)) {
    const match = videoFile.match(/(.+)\.json/);
    if (match) {
      const video = JSON.parse(
        fs.readFileSync(path.join(videoDataPath, videoFile), 'utf8')
      );
      video.name = match[1] + '.MP4';
      videos.push(video);
    }
  }

  console.log(JSON.stringify({ trips, videos }));
}
