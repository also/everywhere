import moment from 'moment';
import { DataSet } from './data';
import { feature } from './geo';
import { buildDataSet } from './trips';
import { SimpleMetadata, toChapter, VideoChapter } from './videos';

const videoContext = require.context(
  'compact-json!../app-data/video-metadata',
  false,
  /\.json$/
);

const videoChapters: VideoChapter[] = videoContext
  .keys()
  .map((filename: string) => {
    const data: SimpleMetadata = videoContext(filename);
    return toChapter(filename.slice(2), {
      start: +moment(data.start),
      duration: parseFloat(data.duration),
    });
  });

export async function loadDataset(): Promise<DataSet> {
  const tripTopojson = await import('./trip-data');
  return buildDataSet(tripTopojson.default.map(feature), videoChapters);
}
