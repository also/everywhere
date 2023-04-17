import sortBy from 'lodash/sortBy';
import moment from 'moment';
import { CoverageFeature, StravaTripFeature } from './trips';
import { Feature, LineString, MultiLineString, Position } from 'geojson';
import {
  LineSegmentRTree,
  RTreeItem,
  lineSegmentsWithinDistance,
  nearestLineSegmentUsingRtree,
} from './geo';

export type Still = { small: string; large: string };

export type VideoChapter = {
  name: string;
  start: moment.Moment;
  end: moment.Moment;
  duration: number;
  fileNumber: string;
  chapter: number;
  low: string;
  high: string;
  stills: Still[];
  thumbnail: Still;
};

export type RawVideoProperties = {
  creationTime: number;
  duration: number;
};

export type RawVideoFeature = Feature<
  LineString | MultiLineString,
  RawVideoProperties
>;

export type CoverageTree = LineSegmentRTree<CoverageFeature>;

export type Video = {
  name: string;
  start: moment.Moment;
  end: moment.Moment;
  duration: number;
  chapters: VideoChapter[];
  stills: Still[];
  thumbnail: Still;
  // FIXME
  trips: StravaTripFeature[];
  coverage: CoverageFeature[];
  coverageTree: CoverageTree;
};

export function toChapter(
  filename: string,
  data: { start: number; duration: number }
): VideoChapter {
  // gopro videos are broken into chapters with filnames as described here: https://gopro.com/support/articles/hero3-and-hero3-file-naming-convention
  const match = filename.match(/^(G[OP](..)(....))\.(MP4|json|MP4.geojson)$/);
  if (!match) {
    throw new Error(`bogus video name ${filename}`);
  }
  const [, name, chapterString, fileNumber] = match;

  const chapter = chapterString === 'PR' ? 0 : parseInt(chapterString, 10);

  // FIXME just assuming EDT?
  // FIXME the clock on the gopro was off for some of the later vidoes
  const d = data.duration;
  const start = moment(data.start); //.add(82, 's');
  const duration = d * 1000;
  const end = start.clone().add(duration);
  const stills = Array(...Array(Math.ceil(d / 30))).map((_, i) => ({
    small: `https://static.ryanberdeen.com/everywhere/video/thumbnails/${name}/small-${i}.jpg`,
    large: `https://static.ryanberdeen.com/everywhere/video/thumbnails/${name}/large-${i}.jpg`,
  }));
  const video = {
    name,
    start,
    end,
    duration,
    fileNumber,
    chapter,
    low: `https://static.ryanberdeen.com/everywhere/video/mp4-low/${name}.MP4`,
    high: `https://static.ryanberdeen.com/everywhere/video/mp4-high/${name}.MP4`,
    stills,
    thumbnail: stills[Math.floor(stills.length / 2)],
  };

  return video;
}

function grouped(name: string, chapters: VideoChapter[]): Video {
  const first = chapters[0];
  const last = chapters[chapters.length - 1];

  const stills = ([] as Still[]).concat(
    ...chapters.map(({ stills }) => stills)
  );
  return {
    name,
    start: first.start,
    end: last.end,
    duration: last.end.valueOf() - first.start.valueOf(),
    chapters,
    stills,
    thumbnail: stills[Math.floor(stills.length / 2)],
    // FIXME these are assigned later
    trips: [],
    coverage: [],
    coverageTree: undefined as any,
  };
}

export function groupChapters(videos: VideoChapter[]): Map<string, Video> {
  const vidChapters: Map<string, VideoChapter[]> = new Map();

  videos.forEach((video) => {
    const { fileNumber, chapter } = video;
    let chapters = vidChapters.get(fileNumber);
    if (chapters == null) {
      chapters = [];
      vidChapters.set(fileNumber, chapters);
    }

    chapters[chapter] = video;
  });

  return new Map(
    sortBy(
      [...vidChapters].map(([name, chapters]) => {
        // remove missing chapters
        chapters = chapters.filter(() => true);

        return [name, grouped(name, chapters)];
      }),
      ([, { start }]) => start
    )
  );
}

export function calculateSeekPosition(nearest: RTreeItem<CoverageFeature>) {
  const {
    data: {
      properties: { start },
    },
    p0: coord,
  } = nearest;
  const [, , , timeOffsetSecs] = coord;
  return +start.clone().add(timeOffsetSecs, 's');
}

export function findSeekPosition(video: Video, location: Position) {
  const { coverageTree } = video;
  const nearest = nearestLineSegmentUsingRtree(coverageTree, location)!.item;
  return calculateSeekPosition(nearest);
}

export function findNearbyVideos(
  videoTree: CoverageTree,
  location: Position,
  maxDistance: number
) {
  // FIXME what type should this have?
  const nearbyVideoCoverageByName = new Map<
    any,
    {
      item: RTreeItem<CoverageFeature>;
      distance: number;
    }
  >();
  lineSegmentsWithinDistance(videoTree, location, maxDistance).forEach(
    (result) => {
      const name = result.item.data.properties.video;
      const current = nearbyVideoCoverageByName.get(name);
      if (!current || result.distance < current.distance) {
        nearbyVideoCoverageByName.set(name, result);
      }
    }
  );

  return Array.from(nearbyVideoCoverageByName.values()).map(
    ({ item, distance }) => {
      const {
        data: {
          properties: { video },
        },
      } = item;
      const time = calculateSeekPosition(item);
      return { video, time, distance };
    }
  );
}
