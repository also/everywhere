import { key } from './WorkerChannel';

export type Tile = {
  features: [
    {
      geometry: [number, number][][];
      type: 2;
      tags: Record<string, string | number>;
    }
  ];
};

export const setWorkerFile = key<File | undefined, void>('setFile');
export const getTile = key<any, Tile>('getTile');
export const renderTileInWorker =
  key<{ coords: any; canvas: OffscreenCanvas }>('renderTileInWorker');
