import fs from 'fs';
import { Feature, FeatureCollection } from 'geojson';
import path from 'path';
import * as topojson from 'topojson';
import { GeometryObject, Topology } from 'topojson-specification';

type SimpleTopology = Topology<{ geoJson: GeometryObject }>;

function addTopology(target: SimpleTopology, toploogy: SimpleTopology) {
  const arcStart = target.arcs.length;
  const coll = toploogy.objects.geoJson;
  let obj: GeometryObject;
  if (coll.type !== 'GeometryCollection') {
    obj = coll;
  } else {
    if (coll.geometries.length !== 1) {
      throw new Error('expected a single geometry');
    }
    obj = coll.geometries[0];
  }
  if (obj.type === 'MultiLineString') {
    (target.objects.geoJson as TopoJSON.GeometryCollection).geometries.push({
      type: 'MultiLineString',
      id: obj.id,
      arcs: obj.arcs.map((arcs) => arcs.map((i) => i + arcStart)),
    });
  } else if (obj.type === 'LineString') {
    (target.objects.geoJson as TopoJSON.GeometryCollection).geometries.push({
      type: 'LineString',
      id: obj.id,
      arcs: obj.arcs.map((i) => i + arcStart),
    });
  } else {
    throw new Error(`unxpected ${obj.type}`);
  }

  target.arcs.push(...toploogy.arcs);
}

export default function () {
  const appDataPath = path.join(__dirname, '../app-data/');
  const tripsPath = path.join(appDataPath, 'strava-trips');

  const trips: Topology[] = [];
  const bigTopo: SimpleTopology = {
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

      addTopology(bigTopo, trip as SimpleTopology);

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
      const geoJson = video as Feature;

      if (
        geoJson.geometry.type !== 'Point' &&
        geoJson.geometry.type !== 'GeometryCollection' &&
        geoJson.geometry.coordinates.length > 0
      ) {
        const topology = topojson.topology({ geoJson });
        addTopology(bigTopo, topology);
      }
      videoTrips.push(geoJson);
    }
  }

  const featureColl: FeatureCollection = {
    type: 'FeatureCollection',
    features: videoTrips,
  };

  console.log(JSON.stringify(bigTopo, null, 2));

  // console.log(JSON.stringify({ trips, videos }));
}
