import { GeoJsonProperties } from 'geojson';
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
export const getTile =
  key<{ x: number; y: number; z: number }, Tile>('getTile');
export const renderTileInWorker =
  key<{ coords: { x: number; y: number; z: number }; canvas: OffscreenCanvas }>(
    'renderTileInWorker'
  );

export const lookup =
  key<{ coords: [number, number] }, GeoJsonProperties>('lookup');
