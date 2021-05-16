import sortBy from 'lodash/collection/sortBy';
import moment from 'moment';
import { CoverageFeature, TripFeature } from './trips';
import { Leaf, Node } from './tree';
import { Position } from 'geojson';

const videoContext = (require as any).context(
  'compact-json!../app-data/video-metadata',
  false,
  /\.json$/
);

type SimpleMetadata = { duration: string; start: string };

type Still = { small: string; large: string };

export type VideoChapter = {
  name: string;
  start: moment.Moment;
  end: moment.Moment;
  duration: moment.Duration;
  fileNumber: string;
  chapter: number;
  low: string;
  high: string;
  stills: Still[];
  thumbnail: Still;
};

export type CoverageTree = Node<CoverageFeature>;

export type Video = {
  name: string;
  start: moment.Moment;
  end: moment.Moment;
  duration: moment.Duration;
  chapters: VideoChapter[];
  stills: Still[];
  thumbnail: Still;
  // FIXME
  trips: TripFeature[];
  coverage: CoverageFeature[];
  coverageTree: CoverageTree;
};

function load(filename: string, data: SimpleMetadata): VideoChapter {
  // gopro videos are broken into chapters with filnames as described here: https://gopro.com/support/articles/hero3-and-hero3-file-naming-convention
  const match = filename.match(/^\.\/(G[OP](..)(....))\.json$/);
  if (!match) {
    throw new Error(`bogus video name ${filename}`);
  }
  const [, name, chapterString, fileNumber] = match;

  const chapter = chapterString === 'PR' ? 0 : parseInt(chapterString, 10);

  // FIXME just assuming EDT?
  // FIXME the clock on the gopro was off for some of the later vidoes
  const d = parseFloat(data.duration);
  const start = moment(data.start); //.add(82, 's');
  const duration = moment.duration(d, 's');
  const end = start.clone().add(duration);
  const stills = Array(...Array(Math.ceil(d / 30))).map((_, i) => ({
    small: `http://static.ryanberdeen.com/everywhere/video/thumbnails/${name}/small-${i}.jpg`,
    large: `http://static.ryanberdeen.com/everywhere/video/thumbnails/${name}/large-${i}.jpg`,
  }));
  const video = {
    name,
    start,
    end,
    duration,
    fileNumber,
    chapter,
    low: `http://static.ryanberdeen.com/everywhere/video/mp4-low/${name}.MP4`,
    high: `http://static.ryanberdeen.com/everywhere/video/mp4-high/${name}.MP4`,
    stills,
    thumbnail: stills[Math.floor(stills.length / 2)],
  };

  return video;
}

function grouped(name: string, chapters: VideoChapter[]): Video {
  const first = chapters[0];
  const last = chapters[chapters.length - 1];

  const stills = [].concat(...chapters.map(({ stills }) => stills));
  return {
    name,
    start: first.start,
    end: last.end,
    duration: moment.duration(last.end.valueOf() - first.start.valueOf()),
    chapters,
    stills,
    thumbnail: stills[Math.floor(stills.length / 2)],
    // FIXME these are assigned later
    trips: [],
    coverage: [],
    coverageTree: undefined as any,
  };
}

function groupChapters(videos: VideoChapter[]): Map<string, Video> {
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

const videos: VideoChapter[] = videoContext.keys().map((filename: string) => {
  const data = videoContext(filename);
  return load(filename, data);
});

export default groupChapters(videos);

export function calculateSeekPosition(nearest: Leaf<CoverageFeature>) {
  const {
    data: {
      properties: { start },
    },
    coordinates: [coord],
  } = nearest;
  const [, , , timeOffsetSecs] = coord;
  return +start.clone().add(timeOffsetSecs, 's');
}

export function findSeekPosition(video: Video, location: Position) {
  const { coverageTree } = video;
  const nearest = coverageTree.nearest(location);
  return calculateSeekPosition(nearest);
}

export function findNearbyVideos(
  videoTree: CoverageTree,
  location: Position,
  maxDistance: number
) {
  const nearbyVideoCoverageByName = new Map();
  videoTree.within(location, maxDistance).forEach((result) => {
    const name = result.node.data.properties.video;
    const current = nearbyVideoCoverageByName.get(name);
    if (!current || result.distance < current.distance) {
      nearbyVideoCoverageByName.set(name, result);
    }
  });

  return Array.from(nearbyVideoCoverageByName.values()).map(
    ({ node, distance }) => {
      const {
        data: {
          properties: { video },
        },
      } = node;
      const time = calculateSeekPosition(node);
      return { video, time, distance };
    }
  );
}
