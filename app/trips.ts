/* eslint-disable camelcase */
import { tree } from './geo';
import { group, Node } from './tree';
import moment from 'moment';

import { CoverageTree, groupChapters, Video, VideoChapter } from './videos';
import { Feature, LineString, MultiLineString } from 'geojson';

export type RawTripProperties = {
  activity: {
    id: string;
    start_date: string;
    elapsed_time: number;
    moving_time: number;
  };
};

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

export type TripTopology = TopoJSON.Topology<
  TopoJSON.Objects<RawTripProperties>
>;

export type CoverageFeature = Feature<
  MultiLineString,
  TripProperties & { video: Video; tree: CoverageTree }
>;

export type RawTripFeature = Feature<
  LineString | MultiLineString,
  RawTripProperties
>;

function load(trip: RawTripFeature): TripFeature {
  const {
    properties,
    properties: {
      activity: { id, start_date, elapsed_time, moving_time },
    },
  } = trip;

  const start = moment(start_date);

  const result: TripFeature = {
    ...trip,
    properties: {
      ...properties,
      id,
      start,
      end: start.clone().add(elapsed_time, 's'),
      movingTime: moving_time * 1000,
      videos: [],
      tree: undefined as any,
    },
  };

  result.properties.tree = tree(result);

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
          const coverage: CoverageFeature = {
            type: 'Feature',
            properties: { ...properties, video, tree: undefined as any },
            geometry: {
              type: 'MultiLineString',
              coordinates,
            },
          };
          coverage.properties.tree = tree(coverage);

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
  rawTrips: RawTripFeature[],
  videoChapters: VideoChapter[]
) {
  const videos = groupChapters(videoChapters);
  const trips = rawTrips.map(load);

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

  return { trips, videoCoverage, tripTree, videoTree, videos };
}
