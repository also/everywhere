import fs from 'fs';

import osmtogeojson from 'osmtogeojson';
import osmxmlParser from 'osmtogeojson/parse_osmxml';

function writeHead() {
  process.stdout.write('{\n  "type": "FeatureCollection",\n  "features": [');
}

function writeFoot() {
  process.stdout.write('\n  ]\n}\n');
}

function writeFeature(f) {
  process.stdout.write(JSON.stringify(f, null, 2));
}

function writeFeatureSeparator() {
  process.stdout.write(', ');
}

function writeFeatures(features) {
  features.forEach((f, i) => {
    writeFeature(f);
    if (i !== features.length - 1) {
      writeFeatureSeparator();
    }
  });
}

function isBikeable(way) {
  const { highway, type } = way.tags;
  return (
    type !== 'multipolygon' &&
    highway &&
    highway !== 'steps' &&
    highway !== 'service' &&
    highway !== 'proposed' &&
    highway !== 'motorway' &&
    highway !== 'motorway_link' &&
    highway !== 'footway' &&
    highway !== 'pedestrian'
  );
}

function loadCachedJson() {
  return Promise.resolve(
    JSON.parse(
      fs.readFileSync('data/scratch/map-osmjson', { encoding: 'utf8' })
    )
  );
}

function parseXml(file) {
  const input = fs.createReadStream(file);

  return new Promise((resolve, reject) => {
    input
      .on('data', chunk => osmxmlParser.write(chunk))
      .on('end', () => {
        osmxmlParser.end();
        resolve(osmxmlParser.getJSON());
      });
    input.resume();
  });
}

function toGeoJson(data) {
  const nodes = {};

  function getNode(id) {
    let node = nodes[id];
    if (!node) {
      node = {
        type: 'Feature',
        geometry: { type: 'Point' },
        refs: [],
        refCount: 0,
        properties: {},
      };
      nodes[id] = node;
    }
    return node;
  }

  console.error('processing elements');
  data.elements.forEach(elt => {
    if (elt.type === 'node') {
      const node = getNode(elt.id);
      node.geometry.coordinates = [parseFloat(elt.lon), parseFloat(elt.lat)];
    } else if (elt.type === 'way' && isBikeable(elt)) {
      elt.tags.bikeable = true;

      const intersections = (elt.intersections = []);
      const last = elt.nodes.length - 1;
      elt.nodes.forEach((id, i) => {
        const node = getNode(id);
        node.refs.push(`way/${elt.id}`);
        node.refCount += i === 0 || i === last ? 2 : 1;
        intersections.push(id);
      });
    }
  });

  console.error('converting to geojson');
  const geoJson = osmtogeojson(data, { flatProperties: true });
  const { features } = geoJson;

  writeHead();
  writeFeatures(features);

  let nodesWritten = 0;

  console.error('writing result');
  for (const id in nodes) {
    const node = nodes[id];
    if (node.refCount > 1) {
      nodesWritten++;
      writeFeatureSeparator();
      writeFeature(node);
    }
  }
  writeFoot();
}

export default function({ _: [file] }) {
  parseXml(file).then(toGeoJson);
}
