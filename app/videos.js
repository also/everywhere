import sortBy from 'lodash/collection/sortBy';

const videoContext = require.context('compact-json!../app-data/video-metadata', false, /\.json$/);

export default new Map(
  sortBy(
    videoContext.keys()
      .map(filename => {
        const data = videoContext(filename);
        const name = filename.replace(/^\.\/(.+)\.json$/, '$1');
        // FIXME just assuming EDT
        const start = new Date(Date.parse(data.start.replace(' ', 'T') + '-0400'));
        const duration = data.duration;
        const end = new Date(start.getTime() + (duration * 1000));
        const video = {
          name,
          start,
          end,
          duration,
          low: `http://static.ryanberdeen.com/everywhere/video/mp4-low/${name}.MP4`,
          high: `http://static.ryanberdeen.com/everywhere/video/mp4-high/${name}.MP4`,
          stills: Array(...Array(Math.ceil(duration / 30))).map((_, i) => (
            {
              small: `http://static.ryanberdeen.com/everywhere/video/thumbnails/${name}/small-${i}.jpg`,
              large: `http://static.ryanberdeen.com/everywhere/video/thumbnails/${name}/large-${i}.jpg`
            }
          )),
          trips: []
        };
        video.thumbnail = video.stills[Math.floor(video.stills.length / 2)];
        return [name, video];
      }),
    (([{start}]) => start)));
