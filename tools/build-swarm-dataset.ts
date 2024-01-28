import * as GeoJSON from 'geojson';
import { Checkin, Venue } from './swarm';
import { topology } from 'topojson';
import { combineTopologies, SimpleTopology } from './topojson-utils';
import { readAllJson } from './data';

export type SimpleVenue = Pick<Venue, 'id' | 'name'>;
export type SimpleCheckin = Pick<Checkin, 'id' | 'createdAt'>;

type VenueFeature = GeoJSON.Feature<
  GeoJSON.Point,
  { type: 'swarm-venue'; venue: SimpleVenue; checkins: SimpleCheckin[] }
>;

export default function () {
  const checkins = readAllJson<Checkin>('swarm');

  const venues = new Map<string, { venue: Venue; checkins: Checkin[] }>();
  const topologies: SimpleTopology[] = [];

  for (const checkin of checkins) {
    const existing = venues.get(checkin.venue.id);
    if (existing) {
      existing.checkins.push(checkin);
    } else {
      venues.set(checkin.venue.id, {
        venue: checkin.venue,
        checkins: [checkin],
      });
    }
  }

  for (const { venue, checkins } of venues.values()) {
    const point: VenueFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [venue.location.lng, venue.location.lat],
      },
      properties: {
        type: 'swarm-venue',
        venue: {
          id: venue.id,
          name: venue.name,
        },
        checkins: checkins.map((c) => ({
          id: c.id,
          createdAt: c.createdAt,
        })),
      },
    };

    const topo = topology({ geoJson: point }) as SimpleTopology;
    topologies.push(topo);
  }

  console.log(JSON.stringify(combineTopologies(topologies, (p) => p)));
}
