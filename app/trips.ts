/* eslint-disable camelcase */
import { feature, tree } from './geo';
import { group, Node } from './tree';
import moment from 'moment';

import { CoverageTree, Video } from './videos';
import { Feature, LineString, MultiLineString } from 'geojson';

export type TripProperties = {
  activity: {
    id: string;
    start_date: string;
    elapsed_time: number;
    moving_time: number;
  };
  // we assign these
  id: string;
  start: moment.Moment;
  end: moment.Moment;
  movingTime: number;
  videos: Video[];
  tree: TripTree;
};

export type TripFeature = Feature<LineString | MultiLineString, TripProperties>;

export type TripTopology = TopoJSON.Topology<TopoJSON.Objects<TripProperties>>;

export type CoverageFeature = Feature<
  LineString | MultiLineString,
  TripProperties & { video: Video; tree: CoverageTree }
>;

function load(trip: TripTopology): TripFeature {
  const result: TripFeature = feature(trip);
  const { properties } = result;
  properties.videos = [];
  const {
    activity: { id, start_date, elapsed_time, moving_time },
  } = properties;

  const start = moment(start_date);

  Object.assign(properties, {
    id,
    start,
    end: start.clone().add(elapsed_time, 's'),
    movingTime: moving_time * 1000,
    tree: tree(result),
  });
  return result;
}

function calculateVideoCoverage(
  trips: TripFeature[],
  videos: Map<string, Video>
): CoverageFeature[] {
  const videoCoverage: CoverageFeature[] = [];

  for (const trip of trips) {
    const { properties } = trip;
    for (const video of videos.values()) {
      if (properties.start <= video.end && properties.end >= video.start) {
        video.trips.push(trip);
        properties.videos.push(video);

        const { geometry } = trip;
        const tripCoords =
          geometry.type === 'LineString'
            ? [geometry.coordinates]
            : geometry.coordinates;
        const coordinates = tripCoords
          .map((coords) =>
            coords.filter((coord) => {
              const [, , , timeOffset] = coord;
              const time = timeOffset * 1000 + +properties.start;
              return (
                time >= video.start.valueOf() && time <= video.end.valueOf()
              );
            })
          )
          .filter(({ length }) => length > 0);

        if (coordinates.length > 0) {
          const covProperties = Object.assign({ video }, properties);
          const coverage: CoverageFeature = {
            type: 'Feature',
            properties: covProperties,
            geometry: {
              type: 'MultiLineString',
              coordinates,
            },
          };
          covProperties.tree = tree(coverage);

          videoCoverage.push(coverage);
          video.coverage.push(coverage);
        }
      }
    }
  }

  return videoCoverage;
}

export type TripTree = Node<TripFeature>;

export function buildDataSet(
  tripTopojson: TripTopology[],
  videos: Map<string, Video>
) {
  const trips = tripTopojson.map(load);

  const videoCoverage = calculateVideoCoverage(trips, videos);

  const tripTree: TripTree = group(
    trips.map(({ properties: { tree } }) => tree)
  );

  const videoTree = group(
    Array.from(videos.values())
      .map((video) => {
        video.coverageTree = group(
          video.coverage.map(({ properties: { tree } }) => tree)
        );
        return video.coverageTree;
      })
      .filter((n) => n)
  );

  return { trips, videoCoverage, tripTree, videoTree };
}
