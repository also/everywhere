import fs from 'fs';
import path from 'path';

export default function () {
  const appDataPath = path.join(__dirname, '../app-data/');
  const tripsPath = path.join(appDataPath, 'trips');

  const trips = [];
  for (const tripFile of fs.readdirSync(tripsPath)) {
    const match = tripFile.match(/strava-(\d+)\.geojson/);
    if (match) {
      trips.push(
        JSON.parse(fs.readFileSync(path.join(tripsPath, tripFile), 'utf8'))
      );
    }
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
