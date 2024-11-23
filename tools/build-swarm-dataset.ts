import { Checkin, processCheckin, VenueFeature } from './swarm';
import { topology } from 'topojson';
import { combineTopologies, SimpleTopology } from './topojson-utils';
import { readAllJson } from './data';

export default function () {
  const checkins = readAllJson<Checkin>('swarm');

  const venues: Map<string, VenueFeature> = new Map();
  const topologies: SimpleTopology[] = [];

  for (const checkin of checkins) {
    const geoJson = processCheckin(checkin, venues);
    if (geoJson) {
      const topo = topology({ geoJson }) as SimpleTopology;
      topologies.push(topo);
    }
  }

  console.log(JSON.stringify(combineTopologies(topologies, (p) => p)));
}
