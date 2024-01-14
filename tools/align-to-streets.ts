import fs from 'fs';
import path from 'path';

import * as TopoJSON from 'topojson-specification';

import { feature, tree } from '../app/geo';

export default function () {
  let coordCount = 0;

  const waysGeojson = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../app-data/highways-clipped-topo.geojson'),
      'utf8'
    )
  );
  const tripDir = path.join(__dirname, '../app-data/trips');
  const trips = fs.readdirSync(tripDir).map((tripFilename) => {
    const filename = path.join(tripDir, tripFilename);
    const topo: TopoJSON.Topology = JSON.parse(
      fs.readFileSync(filename, 'utf8')
    );

    topo.arcs.forEach((arc) => arc.forEach((coord) => coord.push([])));

    const trip = feature(topo);
    trip.topo = topo;
    trip.filename = filename;

    const {
      features: [{ geometry }],
    } = trip;
    (geometry.type === 'LineString'
      ? [geometry.coordinates]
      : geometry.coordinates
    ).forEach((coords) => (coordCount += coords.length));

    return trip;
  });
  //const intersectionsTopojson = JSON.parse(fs.readFileSync(require.resolve('../app-data/intersections-clipped-topo.geojson')));

  const ways = feature(waysGeojson);
  const waysTree = tree(ways);

  let n = 0;
  for (const {
    features: [{ geometry }],
  } of trips) {
    (geometry.type === 'LineString'
      ? [geometry.coordinates]
      : geometry.coordinates
    ).forEach((coords) =>
      coords.forEach((coord) => {
        const nearestWay = waysTree.nearest(coord).data.feature.properties;
        coord[coord.length - 1].push(nearestWay.id);
        if (n++ % 1 === 0) {
          process.stdout.write(
            `\r\x1b[K${Math.round((n / coordCount) * 100)}%\t${nearestWay.name}`
          );
        }
      })
    );
  }

  for (const { filename, topo } of trips) {
    fs.writeFileSync(
      path.join(
        path.dirname(filename),
        `${path.basename(filename, '.geojson')}-ways.geojson`
      ),
      JSON.stringify(topo, null, 2)
    );
  }
}
