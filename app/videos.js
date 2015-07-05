import sortBy from 'lodash/collection/sortBy';

const videoContext = require.context('compact-json!../app-data/video-metadata', false, /\.json$/);

const vidChapters = new Map();

// gopro videos are broken into chapters with filnames as described here: https://gopro.com/support/articles/hero3-and-hero3-file-naming-convention
videoContext.keys()
  .map(filename => {
    const data = videoContext(filename);
    const match = filename.match(/^\.\/(G[OP](..)(....))\.json$/);
    if (!match) {
      throw new Error(`bogus video name ${filename}`);
    }
    const [, name, chapterString, fileNumber] = match;

    const chapter = chapterString === 'PR' ? 0 : parseInt(chapterString, 10);

    // FIXME just assuming EDT
    const start = new Date(Date.parse(data.start.replace(' ', 'T') + '-0400'));
    const duration = data.duration * 1000;
    const end = new Date(start.getTime() + duration);
    const video = {
      name,
      start,
      end,
      duration,
      low: `http://static.ryanberdeen.com/everywhere/video/mp4-low/${name}.MP4`,
      high: `http://static.ryanberdeen.com/everywhere/video/mp4-high/${name}.MP4`,
      stills: Array(...Array(Math.ceil(data.duration / 30))).map((_, i) => (
        {
          small: `http://static.ryanberdeen.com/everywhere/video/thumbnails/${name}/small-${i}.jpg`,
          large: `http://static.ryanberdeen.com/everywhere/video/thumbnails/${name}/large-${i}.jpg`
        }
      ))
    };
    video.thumbnail = video.stills[Math.floor(video.stills.length / 2)];

    let chapters = vidChapters.get(fileNumber);
    if (chapters == null) {
      chapters = [];
      vidChapters.set(fileNumber, chapters);
    }

    chapters[chapter] = video;
  });

export default new Map(sortBy([...vidChapters].map(([name, chapters]) => {
  // remove missing chapters
  chapters = chapters.filter(() => true);
  const first = chapters[0];
  const last = chapters[chapters.length - 1];

  const stills = [].concat(...chapters.map(({stills}) => stills));

  return [name, {
    name,
    start: first.start,
    end: last.end,
    duration: last.end - first.start,
    chapters,
    stills,
    thumbnail: stills[Math.floor(stills.length / 2)],
    trips: [],
    coverage: []
  }];
}), ([, {start}]) => start));
