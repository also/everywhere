declare module 'geojson-vt' {
  export interface TileCoords {
    z: number;
    y: number;
    x: number;
  }

  export type Feature =
    | {
        type: 1;
        id: number | undefined;
        geometry: [number, number][];
        tags: Record<string, any>;
      }
    | {
        type: 2;
        id: number | undefined;
        geometry: [number, number][][];
        tags: Record<string, any>;
      };

  export interface Tile extends TileCoords {
    features: Feature[];
  }

  export class GeoJSONVT {
    tileCoords: TileCoords[];
    getTile(z: number, x: number, y: number): Tile;
  }

  export default function geojsonVt(
    geojson: any,
    options: { maxZoom: number }
  ): GeoJSONVT;
}
