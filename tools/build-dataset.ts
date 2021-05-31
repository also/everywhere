import fs from 'fs';
import { Feature, FeatureCollection } from 'geojson';
import path from 'path';
import { Topology } from 'topojson-specification';

export default function () {
  const appDataPath = path.join(__dirname, '../app-data/');
  const tripsPath = path.join(appDataPath, 'strava-trips');

  const trips: Topology[] = [];
  const bigTopo: Topology = {
    type: 'Topology',
    arcs: [],
    objects: { geoJson: { type: 'GeometryCollection', geometries: [] } },
  };
  for (const tripFile of fs.readdirSync(tripsPath)) {
    const match = tripFile.match(/strava-(\d+)\.geojson/);
    if (match) {
      const trip: Topology = JSON.parse(
        fs.readFileSync(path.join(tripsPath, tripFile), 'utf8')
      );
      const arcStart = bigTopo.arcs.length;
      const obj = (trip.objects.geoJson as TopoJSON.GeometryCollection)
        .geometries[0] as TopoJSON.MultiLineString;
      (bigTopo.objects.geoJson as TopoJSON.GeometryCollection).geometries.push({
        type: 'MultiLineString',
        id: obj.id,
        arcs: obj.arcs.map((arcs) => arcs.map((i) => i + arcStart)),
      });
      bigTopo.arcs.push(...trip.arcs);
      trips.push(trip);
    }
  }

  const videoDataPath = path.join(appDataPath, 'video-metadata');
  const videos = [];
  const videoTrips: Feature[] = [];
  for (const videoFile of fs.readdirSync(videoDataPath)) {
    const filename = fs.readFileSync(
      path.join(videoDataPath, videoFile),
      'utf8'
    );
    const video = JSON.parse(filename);
    const match = videoFile.match(/(.+)\.json/);
    if (match) {
      video.name = match[1] + '.MP4';
      videos.push(video);
    } else {
      const geojson = video as Feature;
      videoTrips.push(geojson);
    }
  }

  const featureColl: FeatureCollection = {
    type: 'FeatureCollection',
    features: videoTrips,
  };

  console.log(JSON.stringify(bigTopo, null, 2));

  // console.log(JSON.stringify({ trips, videos }));
}
