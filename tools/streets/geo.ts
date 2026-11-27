// Small geometry helpers. Matching happens in a local metric projection:
// metres east/north of a reference point, with longitude scaled by cos(lat)
// at each point. Over a region the size of a US state, distances between
// nearby points are accurate to well under 0.1%, which is plenty for 15 m
// matching radii.

const R = 6371008.8;
const RAD = Math.PI / 180;

export function haversine(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
) {
  const p1 = lat1 * RAD;
  const p2 = lat2 * RAD;
  const a =
    Math.sin((p2 - p1) / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(((lon2 - lon1) * RAD) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export class LocalProjection {
  constructor(
    public lon0: number,
    public lat0: number
  ) {}
  x(lon: number, lat: number) {
    return (lon - this.lon0) * RAD * R * Math.cos(lat * RAD);
  }
  y(lat: number) {
    return (lat - this.lat0) * RAD * R;
  }
}

/** Distance and compass bearing (degrees) from one point to another. */
export function distBearing(
  lon0: number,
  lat0: number,
  lon: number,
  lat: number
) {
  const dx = (lon - lon0) * 111_320 * Math.cos(lat0 * RAD);
  const dy = (lat - lat0) * 110_540;
  return {
    d: Math.hypot(dx, dy),
    bearing: (Math.atan2(dx, dy) / RAD + 360) % 360,
  };
}

export function compass(deg: number) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][
    Math.floor((deg + 22.5) / 45) % 8
  ];
}

/**
 * Sample a projected polyline every ~`step` metres (at the centres of equal
 * subdivisions of each segment), calling back with the point and the
 * segment's undirected bearing in radians [0, pi).
 */
export function densify(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  start: number,
  end: number,
  step: number,
  cb: (x: number, y: number, bearing: number) => void,
  round: (n: number) => number = Math.round
) {
  for (let i = start; i + 1 < end; i++) {
    const dx = xs[i + 1] - xs[i];
    const dy = ys[i + 1] - ys[i];
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    let b = Math.atan2(dy, dx);
    if (b < 0) b += Math.PI;
    if (b >= Math.PI) b -= Math.PI;
    const n = Math.max(1, round(len / step));
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n;
      cb(xs[i] + dx * f, ys[i] + dy * f, b);
    }
  }
}
