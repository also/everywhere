// handles the google takeout file "Records.json" with the format:
// {
//   locations: [
//     {
//       latitudeE7: 423697835,
//       longitudeE7: -710783232,
//       accuracy: 65,
//       source: 'UNKNOWN',
//       deviceTag: 1622928128,
//       timestamp: '2013-04-29T18:12:05.999Z',
//     },
//   ],
// }

import { readFileSync } from 'fs';
import { topology } from 'topojson-server';
import { combineTopologies, SimpleTopology } from './topojson-utils';

export interface GMRecords {
  locations: GMRecordsLocation[];
}

export interface GMRecordsLocation {
  latitudeE7: number;
  longitudeE7: number;
  accuracy: number;
  source: string;
  deviceTag: number;
  timestamp: string;
}

export interface LocationFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    timestamp: number;
  };
}

export default function ({ _: [recordsPath] }: { _: string[] }) {
  const records = JSON.parse(readFileSync(recordsPath, 'utf8')) as GMRecords;
  const topologies: SimpleTopology[] = [];
  for (const location of records.locations) {
    const timestamp = new Date(location.timestamp).getTime();
    const feature: LocationFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [location.longitudeE7 / 1e7, location.latitudeE7 / 1e7],
      },
      properties: {
        timestamp,
      },
    };
    const topo = topology({ geoJson: feature }) as SimpleTopology;
    topologies.push(topo);
  }

  console.log(JSON.stringify(combineTopologies(topologies, (p) => p)));
}
