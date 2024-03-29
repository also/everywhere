import {
  Feature,
  GeoJsonProperties,
  LineString,
  MultiLineString,
} from 'geojson';
import { Tile } from 'geojson-vt';
import { FileWithDetails } from './file-data';
import { TileRenderOpts } from './tile-drawing';
import { key, WorkerChannel, workerHandshake } from './WorkerChannel';

export const setWorkerFiles =
  key<{ file: FileWithDetails; type: 'osm' | 'generic' }[], void>('setFiles');
export const getTile =
  key<{ x: number; y: number; z: number }, Tile>('getTile');
export const renderTileInWorker =
  key<
    {
      coords: { x: number; y: number; z: number };
      size: number;
      opts: TileRenderOpts | undefined;
    },
    ImageBitmap
  >('renderTileInWorker');

export const renderDistanceTileInWorker = key<
  {
    coords: { x: number; y: number; z: number };
    size: number;
  },
  ImageBitmap
>('renderDistanceTileInWorker');

export const lookup =
  key<
    { coords: [number, number]; zoom: number },
    // TODO don't return the whole feature, just the id?
    | {
        feature: Feature<LineString | MultiLineString, GeoJsonProperties>;
        distance: number;
      }
    | undefined
  >('lookup');

export async function create() {
  const worker = new Worker(new URL('./tile-worker.ts', import.meta.url));

  const channel = WorkerChannel.forWorker(worker);
  await channel.sendRequest(workerHandshake, 'ping');
  return { worker, channel };
}
