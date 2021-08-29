declare module 'geojson-vt' {
  export interface TileCoords {
    z: number;
    y: number;
    x: number;
  }

  export interface Tile extends TileCoords {
    features: [
      {
        id: number | undefined;
        geometry: [number, number][][];
        type: 2;
        tags: Record<string, string | number>;
      }
    ];
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
