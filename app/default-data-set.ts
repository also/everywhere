import moment from 'moment';
import { DataSet } from './data';
import { feature } from './geo';
import { buildDataSet, StravaTripTopology } from './trips';
import { toChapter } from './videos';

export type SimpleMetadata = { duration: string; start: string; name: string };

export async function loadDataset(): Promise<DataSet> {
  const {
    trips,
    videos,
  }: { trips: StravaTripTopology[]; videos: SimpleMetadata[] } = await fetch(
    'https://static.ryanberdeen.com/everywhere/datasets/everywhere-2015-v1.json'
  ).then((r) => r.json());

  const videoChapters = videos.map((data) => {
    return toChapter(data.name, {
      start: +moment(data.start),
      duration: parseFloat(data.duration),
    });
  });

  // @ts-expect-error FIXME
  return buildDataSet(trips.map(feature), videoChapters);
}
