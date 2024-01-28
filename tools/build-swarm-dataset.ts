import { readdirSync, readFileSync } from 'fs';
import * as GeoJSON from 'geojson';
import { Checkin, Venue } from './swarm';
import { topology } from 'topojson';
import { combineTopologies, SimpleTopology } from './topojson-utils';

export default function () {
  const files = readdirSync('data/swarm');

  const venues = new Map<string, Venue>();
  const topologies: SimpleTopology[] = [];

  for (const filename of files) {
    const checkin: Checkin = JSON.parse(
      readFileSync(`data/swarm/${filename}`, 'utf8')
    );
    const venue = checkin.venue;
    if (!venue) {
      console.log('no venue', checkin);
    } else {
      venues.set(venue.id, venue);
    }
  }

  for (const venue of venues.values()) {
    const point: GeoJSON.Point = {
      type: 'Point',
      coordinates: [venue.location.lng, venue.location.lat],
    };

    const topo = topology({ geoJson: point }) as SimpleTopology;
    topologies.push(topo);
  }

  console.log(
    JSON.stringify(
      combineTopologies(topologies, () => ({ type: 'swarm-venue' }))
    )
  );
}
