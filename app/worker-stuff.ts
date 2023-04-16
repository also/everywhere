import {
  Feature,
  GeoJsonProperties,
  LineString,
  MultiLineString,
} from 'geojson';
import { Tile } from 'geojson-vt';
import { key, WorkerChannel, workerHandshake } from './WorkerChannel';
import { TileRenderOpts } from './tile-drawing';

export const setWorkerFile =
  key<{ file: File | undefined; type: 'osm' | 'generic' }, void>('setFile');
export const getTile =
  key<{ x: number; y: number; z: number }, Tile>('getTile');
export const renderTileInWorker =
  key<{
    coords: { x: number; y: number; z: number };
    canvas: OffscreenCanvas;
    opts: TileRenderOpts | undefined;
  }>('renderTileInWorker');

export const renderFeatureTileInWorker = key<{
  coords: { x: number; y: number; z: number };
  canvas: OffscreenCanvas;
  opts: TileRenderOpts | undefined;
}>('renderFeatureTileInWorker');

export const lookup =
  key<
    { coords: [number, number] },
    // TODO don't return the whole feature, just the id?
    Feature<LineString | MultiLineString, GeoJsonProperties> | undefined
  >('lookup');

export async function create() {
  const worker = new Worker(new URL('./worker.ts', import.meta.url));

  const channel = WorkerChannel.forWorker(worker);
  await channel.sendRequest(workerHandshake, 'ping');
  return { worker, channel };
}
