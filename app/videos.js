import sortBy from 'lodash/collection/sortBy';
import moment from 'moment';

const videoContext = require.context(
  'compact-json!../app-data/video-metadata',
  false,
  /\.json$/
);

function load(filename, data) {
  // gopro videos are broken into chapters with filnames as described here: https://gopro.com/support/articles/hero3-and-hero3-file-naming-convention
  const match = filename.match(/^\.\/(G[OP](..)(....))\.json$/);
  if (!match) {
    throw new Error(`bogus video name ${filename}`);
  }
  const [, name, chapterString, fileNumber] = match;

  const chapter = chapterString === 'PR' ? 0 : parseInt(chapterString, 10);

  // FIXME just assuming EDT?
  // FIXME the clock on the gopro was off for some of the later vidoes
  const start = moment(data.start); //.add(82, 's');
  const duration = moment.duration(parseFloat(data.duration), 's');
  const end = start.clone().add(duration);
  const video = {
    name,
    start,
    end,
    duration,
    fileNumber,
    chapter,
    low: `http://static.ryanberdeen.com/everywhere/video/mp4-low/${name}.MP4`,
    high: `http://static.ryanberdeen.com/everywhere/video/mp4-high/${name}.MP4`,
    stills: Array(...Array(Math.ceil(data.duration / 30))).map((_, i) => ({
      small: `http://static.ryanberdeen.com/everywhere/video/thumbnails/${name}/small-${i}.jpg`,
      large: `http://static.ryanberdeen.com/everywhere/video/thumbnails/${name}/large-${i}.jpg`,
    })),
  };
  video.thumbnail = video.stills[Math.floor(video.stills.length / 2)];

  return video;
}

function groupChapters(videos) {
  const vidChapters = new Map();

  videos.forEach(video => {
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
        const first = chapters[0];
        const last = chapters[chapters.length - 1];

        const stills = [].concat(...chapters.map(({ stills }) => stills));

        return [
          name,
          {
            name,
            start: first.start,
            end: last.end,
            duration: moment.duration(last.end - first.start),
            chapters,
            stills,
            thumbnail: stills[Math.floor(stills.length / 2)],
            trips: [],
            coverage: [],
          },
        ];
      }),
      ([, { start }]) => start
    )
  );
}

const videos = videoContext.keys().map(filename => {
  const data = videoContext(filename);
  return load(filename, data);
});

export default groupChapters(videos);

export function calculateSeekPosition(nearest) {
  const {
    data: {
      feature: {
        properties: { start },
      },
    },
    coordinates: [coord],
  } = nearest;
  const [, , , timeOffsetSecs] = coord;
  return +start.clone().add(timeOffsetSecs, 's');
}

export function findSeekPosition(video, location) {
  const { coverageTree, name } = video;
  const nearest = coverageTree.nearest(location);
  return calculateSeekPosition(nearest);
}

export function findNearbyVideos(videoTree, location, maxDistance) {
  const nearbyVideoCoverageByName = new Map();
  videoTree.within(location, maxDistance).forEach(result => {
    const name = result.node.data.feature.properties.video;
    const current = nearbyVideoCoverageByName.get(name);
    if (!current || result.distance < current.distance) {
      nearbyVideoCoverageByName.set(name, result);
    }
  });

  return Array.from(nearbyVideoCoverageByName.values()).map(
    ({ node, distance }) => {
      const {
        data: {
          feature: {
            properties: { video },
          },
        },
      } = node;
      const time = calculateSeekPosition(node);
      return { video, time, distance };
    }
  );
}
