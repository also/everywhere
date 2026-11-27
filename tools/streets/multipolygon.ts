// Multipolygon assembly and point-in-polygon for OSM boundary relations.
//
// A boundary relation lists member ways (outer/inner) in no particular order
// or direction. We chain them end to end into closed rings. For containment
// we don't need to know which inner ring belongs to which outer: with the
// even-odd rule over all rings, a point is inside iff a ray from it crosses
// ring edges an odd number of times.

export type Ring = Float64Array; // [lon0, lat0, lon1, lat1, ...], closed

/**
 * Chain ways (lists of node ids) into closed rings. Returns rings as node id
 * lists, plus the number of ways that couldn't be closed into a ring.
 */
export function assembleRings(ways: number[][]): {
  rings: number[][];
  unclosed: number;
} {
  const rings: number[][] = [];
  const byEnd = new Map<number, Set<number>>();
  const add = (node: number, w: number) => {
    let s = byEnd.get(node);
    if (!s) byEnd.set(node, (s = new Set()));
    s.add(w);
  };
  const used = new Uint8Array(ways.length);
  ways.forEach((w, i) => {
    add(w[0], i);
    add(w[w.length - 1], i);
  });
  const take = (i: number) => {
    used[i] = 1;
    byEnd.get(ways[i][0])!.delete(i);
    byEnd.get(ways[i][ways[i].length - 1])!.delete(i);
  };

  let unclosed = 0;
  for (let i = 0; i < ways.length; i++) {
    if (used[i]) continue;
    take(i);
    const ring = ways[i].slice();
    while (ring[0] !== ring[ring.length - 1]) {
      const end = ring[ring.length - 1];
      const next = byEnd.get(end)?.values().next().value;
      if (next === undefined) break;
      take(next);
      const w = ways[next];
      // append in whichever direction continues from `end`
      const seg = w[0] === end ? w : w.slice().reverse();
      for (let k = 1; k < seg.length; k++) ring.push(seg[k]);
    }
    if (ring[0] === ring[ring.length - 1] && ring.length >= 4) rings.push(ring);
    else unclosed++;
  }
  return { rings, unclosed };
}

/**
 * Point-in-polygon over a set of rings, with edges bucketed into horizontal
 * strips so each query only tests edges near the point's latitude.
 */
export class PolygonIndex {
  minLon = Infinity;
  minLat = Infinity;
  maxLon = -Infinity;
  maxLat = -Infinity;
  private strips: Float64Array[];
  private stripH: number;

  constructor(
    rings: Ring[],
    private nStrips = 256
  ) {
    for (const r of rings) {
      for (let i = 0; i < r.length; i += 2) {
        this.minLon = Math.min(this.minLon, r[i]);
        this.maxLon = Math.max(this.maxLon, r[i]);
        this.minLat = Math.min(this.minLat, r[i + 1]);
        this.maxLat = Math.max(this.maxLat, r[i + 1]);
      }
    }
    this.stripH = (this.maxLat - this.minLat) / nStrips || 1;
    const buckets: number[][] = Array.from({ length: nStrips }, () => []);
    for (const r of rings) {
      for (let i = 0; i + 3 < r.length; i += 2) {
        const [x1, y1, x2, y2] = [r[i], r[i + 1], r[i + 2], r[i + 3]];
        const s0 = this.strip(Math.min(y1, y2));
        const s1 = this.strip(Math.max(y1, y2));
        for (let s = s0; s <= s1; s++) buckets[s].push(x1, y1, x2, y2);
      }
    }
    this.strips = buckets.map((b) => Float64Array.from(b));
  }

  private strip(lat: number) {
    return Math.max(
      0,
      Math.min(this.nStrips - 1, Math.floor((lat - this.minLat) / this.stripH))
    );
  }

  contains(lon: number, lat: number): boolean {
    if (
      lon < this.minLon ||
      lon > this.maxLon ||
      lat < this.minLat ||
      lat > this.maxLat
    ) {
      return false;
    }
    const e = this.strips[this.strip(lat)];
    let inside = false;
    for (let i = 0; i < e.length; i += 4) {
      const x1 = e[i];
      const y1 = e[i + 1];
      const x2 = e[i + 2];
      const y2 = e[i + 3];
      if (
        y1 > lat !== y2 > lat &&
        lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1
      ) {
        inside = !inside;
      }
    }
    return inside;
  }
}
