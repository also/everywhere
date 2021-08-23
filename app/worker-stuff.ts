import { GeoJsonProperties } from 'geojson';
import { key, WorkerChannel, workerHandshake } from './WorkerChannel';

export type Tile = {
  features: [
    {
      id: number | undefined;
      geometry: [number, number][][];
      type: 2;
      tags: Record<string, string | number>;
    }
  ];
};

export const setWorkerFile =
  key<{ file: File | undefined; type: 'osm' | 'generic' }, void>('setFile');
export const getTile =
  key<{ x: number; y: number; z: number }, Tile>('getTile');
export const renderTileInWorker =
  key<{
    coords: { x: number; y: number; z: number };
    canvas: OffscreenCanvas;
    selectedId: number | undefined;
  }>('renderTileInWorker');

export const lookup =
  key<{ coords: [number, number] }, GeoJsonProperties>('lookup');

export async function create() {
  const worker = new Worker(new URL('./worker.ts', import.meta.url));

  const channel = WorkerChannel.forWorker(worker);
  await channel.sendRequest(workerHandshake, 'ping');
  return { worker, channel };
}
