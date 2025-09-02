/* eslint-disable camelcase */
import { geoLines, group, LineRTree, tree } from './geo';
import moment from 'moment';
import d3 from 'd3';

import { CoverageTree, groupChapters, Video, VideoChapter } from './videos';
import { Feature, LineString, MultiLineString } from 'geojson';
import { Activity } from '../tools/strava-api';
import { DataSet } from './data';
import { geometryLength } from './distance';

export type RawStravaTripProperties = {
  activity: Activity;
};

export type StravaTripProperties = {
  activity: Activity;
  // we assign these
  id: string;
  start: moment.Moment;
  end: moment.Moment;
  movingTime: number;
  videos: Video[];
  tree: TripTree;
};

export type StravaTripFeature = Feature<
  LineString | MultiLineString,
  StravaTripProperties
>;

export type StravaTripTopology = TopoJSON.Topology<
  TopoJSON.Objects<RawStravaTripProperties>
>;

export type CoverageFeature = Feature<
  MultiLineString,
  StravaTripProperties & { video: Video; tree: CoverageTree }
>;

export type RawStravaTripFeature = Feature<
  LineString | MultiLineString,
  RawStravaTripProperties
>;

function load(trip: RawStravaTripFeature): StravaTripFeature {
  const {
    properties,
    properties: {
      activity: { id, start_date, elapsed_time, moving_time },
    },
  } = trip;

  const start = moment(start_date);

  const result: StravaTripFeature = {
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
  trips: StravaTripFeature[],
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
          // TODO is the type right?
          coverage.properties.tree = tree(coverage);

          videoCoverage.push(coverage);
          video.coverage.push(coverage);
        }
      }
    }
  }

  return videoCoverage;
}

export type TripTree = LineRTree<StravaTripFeature>;

export function buildDataSet(
  rawTrips: RawStravaTripFeature[],
  videoChapters: VideoChapter[],
  isDefault: boolean
): DataSet {
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

  const tripsLength =
    trips.length === 0
      ? 0
      : d3.sum(
          trips.map(geoLines).reduce((a, b) => a.concat(b)),
          // @ts-expect-error the d3.sum type is wrong. d3.sum ignores null
          geometryLength
        );

  return {
    trips,
    videoCoverage,
    tripTree,
    videoTree,
    videos,
    tripsById: new Map(trips.map((t) => [`${t.id}`, t])),
    tripsLength,
    isDefault,
  };
}
