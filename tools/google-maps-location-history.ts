// handles the google maps app location-history.json file with the format:
// [
//   {
//     "endTime" : "2024-09-20T21:09:07.999-04:00",
//     "startTime" : "2024-09-20T17:45:18.152-04:00",
//     "activity" : {
//       "probability" : "0.587855",
//       "end" : "geo:42.404707,-71.126226",
//       "topCandidate" : {
//         "type" : "walking",
//         "probability" : "0.496676"
//       },
//       "distanceMeters" : "5599.117188",
//       "start" : "geo:42.369934,-71.076917"
//     }
//   },
// {
//   endTime: '2024-10-03T15:00:00.000Z',
//   startTime: '2024-10-03T13:00:00.000Z',
//   timelinePath: [
//     {
//       point: 'geo:42.404467,-71.125561',
//       durationMinutesOffsetFromStartTime: '55'
//     }
//   ]
// },
// {
//   endTime: '2024-10-06T22:49:54.221-04:00',
//   startTime: '2024-10-06T17:02:21.998-04:00',
//   visit: {
//     hierarchyLevel: '0',
//     topCandidate: {
//       probability: '0.657336',
//       semanticType: 'Home',
//       placeID: 'ChIJx_G4dOF244kRMwR972-uYWg',
//       placeLocation: 'geo:42.404510,-71.125611'
//     },
//     probability: '0.627650'
//   }

import { readFileSync } from 'fs';
import { Feature, LineString, Point } from 'geojson';
import { topology } from 'topojson-server';
import { combineTopologies, SimpleTopology } from './topojson-utils';

function parseGeoPoint(point: string) {
  return point
    .slice(4)
    .split(',')
    .map((s) => parseFloat(s))
    .reverse();
}

interface BaseGLHEntry {
  endTime: string;
  startTime: string;
}

interface GLHTimelinePathEntry extends BaseGLHEntry {
  timelinePath: {
    point: string;
    durationMinutesOffsetFromStartTime: string;
  }[];
}

interface GLHActivityEntry extends BaseGLHEntry {
  activity: {
    probability: string;
    end: string;
    topCandidate: {
      type: string;
      probability: string;
    };
    distanceMeters: string;
    start: string;
  };
}

interface GLHVisitEntry extends BaseGLHEntry {
  visit: {
    hierarchyLevel: string;
    topCandidate: {
      probability: string;
      semanticType: string;
      placeID: string;
      placeLocation: string;
    };
    probability: string;
  };
}

type GLHEntry = GLHTimelinePathEntry | GLHActivityEntry | GLHVisitEntry;

export default function ({ _: [recordsPath] }: { _: string[] }) {
  const entries = JSON.parse(readFileSync(recordsPath, 'utf8')) as GLHEntry[];
  const topologies: SimpleTopology[] = [];
  for (const entry of entries) {
    const startTime = new Date(entry.startTime).getTime();
    const endTime = new Date(entry.endTime).getTime();

    if (
      'activity' in entry &&
      entry.activity.start.startsWith('geo:') &&
      entry.activity.end.startsWith('geo:')
    ) {
      const start = parseGeoPoint(entry.activity.start);
      const end = parseGeoPoint(entry.activity.end);
      const feature: Feature<LineString> = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [start, end],
        },
        properties: {
          startTime,
          endTime,
          activity: entry.activity,
        },
      };
      const topo = topology({ geoJson: feature }) as SimpleTopology;
      topologies.push(topo);
    } else if ('timelinePath' in entry) {
      const points = entry.timelinePath.map((p) => {
        const [lng, lat] = parseGeoPoint(p.point);
        return [lng, lat];
      });

      const feature: Feature<LineString> = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: points,
        },
        properties: {
          startTime,
          endTime,
          timelinePath: entry.timelinePath,
        },
      };

      const topo = topology({ geoJson: feature }) as SimpleTopology;
      topologies.push(topo);
    } else if ('visit' in entry) {
      const [lng, lat] = parseGeoPoint(entry.visit.topCandidate.placeLocation);
      const feature: Feature<Point> = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          startTime,
          endTime,
          visit: entry.visit,
        },
      };
      const topo = topology({ geoJson: feature }) as SimpleTopology;
      topologies.push(topo);
    } else {
      console.error('unknown entry type', entry);
    }
  }

  console.log(JSON.stringify(combineTopologies(topologies, (p) => p)));
}
