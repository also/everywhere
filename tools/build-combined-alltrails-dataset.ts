import * as fs from 'fs';
import { DOMParser } from 'xmldom';
import { gpx } from '@tmcw/togeojson';
import { topology } from 'topojson-server';
import { combineTopologies, SimpleTopology } from './topojson-utils';

export default function () {
  const files = fs
    .readdirSync('data/alltrails-recordings')
    .filter((f) => f.endsWith('.gpx'));
  const topologies: SimpleTopology[] = [];
  for (const file of files) {
    const xml = fs.readFileSync(`data/alltrails-recordings/${file}`, 'utf8');
    const doc = new DOMParser().parseFromString(xml);
    const geoJson = gpx(doc);
    const topo = topology({ geoJson }) as SimpleTopology;
    topologies.push(topo);
  }
  console.log(
    JSON.stringify(
      combineTopologies(topologies, () => ({ type: 'alltrails-recording' }))
    )
  );
}
