import { key } from './WorkerChannel';

export type Tile = {
  features: [{ geometry: [number, number][][]; type: 2 }];
};

export const setWorkerFile = key<File | undefined, void>('setFile');
export const getTile = key<any, Tile>('getTile');
