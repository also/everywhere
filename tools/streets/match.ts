// Match rides to blocks.
//
// Every block is sampled every SAMPLE_STEP metres. A sample is covered by a
// ride if some point of that ride is within RADIUS metres *and* the ride was
// heading roughly along the block (within ANGLE_TOL), so riding across a
// street doesn't count as riding it. Ride tracks are smoothed to ~10 m chords
// first so GPS jitter doesn't produce random headings.
//
// For each block we record the fraction of its samples covered, which rides
// covered how much of it, and, per sample, the first ride to cover it. That
// last bit gives the exact ride on which a block became "done" and how much
// new ground each ride broke.

import { Db } from './db';
import { LocalProjection, densify } from './geo';
import { Ride } from './rides';

export interface MatchParams {
  radiusM: number;
  angleTolDeg: number;
  sampleStepM: number;
  rideChordM: number;
  /** a ride "rode" a block if it covered at least this fraction of it */
  rideBlockFrac: number;
  /** a block is "done" when this fraction of it has been covered by any rides */
  doneFrac: number;
}

export const DEFAULT_PARAMS: MatchParams = {
  radiusM: 15,
  angleTolDeg: 30,
  sampleStepM: 5,
  rideChordM: 10,
  rideBlockFrac: 0.5,
  doneFrac: 0.8,
};

const log = (msg: string) => process.stderr.write(msg + '\n');

class Growable {
  a: Float64Array;
  n = 0;
  constructor(cap = 1 << 20) {
    this.a = new Float64Array(cap);
  }
  push(v: number) {
    if (this.n === this.a.length) {
      const b = new Float64Array(this.a.length * 2);
      b.set(this.a);
      this.a = b;
    }
    this.a[this.n++] = v;
  }
  get() {
    return this.a.subarray(0, this.n);
  }
}

/** Ride points bucketed into square cells of side `cell` metres. */
class Grid {
  private starts = new Map<number, number>();
  order: Uint32Array;
  private ends: Uint32Array;
  private static K = 1 << 21; // cells per row; ample for any region

  constructor(
    public xs: Float64Array,
    public ys: Float64Array,
    public cell: number
  ) {
    const n = xs.length;
    const keys = new Float64Array(n);
    for (let i = 0; i < n; i++) keys[i] = this.key(xs[i], ys[i]);
    this.order = new Uint32Array(n);
    for (let i = 0; i < n; i++) this.order[i] = i;
    this.order.sort((a, b) => keys[a] - keys[b]);
    this.ends = new Uint32Array(n);
    let i = 0;
    while (i < n) {
      const k = keys[this.order[i]];
      let j = i;
      while (j < n && keys[this.order[j]] === k) j++;
      this.starts.set(k, i);
      this.ends[i] = j;
      i = j;
    }
  }

  private cx(x: number) {
    return Math.floor(x / this.cell) + Grid.K / 2;
  }
  private key(x: number, y: number) {
    return this.cx(x) * Grid.K + this.cx(y);
  }

  /** Calls cb with the index of every point in the 3x3 cells around (x, y). */
  near(x: number, y: number, cb: (i: number) => void) {
    const cx = this.cx(x);
    const cy = this.cx(y);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const s = this.starts.get(gx * Grid.K + gy);
        if (s === undefined) continue;
        const e = this.ends[s];
        for (let k = s; k < e; k++) cb(this.order[k]);
      }
    }
  }
}

function ridePoints(
  rides: Ride[],
  proj: LocalProjection,
  bounds: number[],
  p: MatchParams
) {
  const [w, s, e, n] = bounds;
  const xs = new Growable();
  const ys = new Growable();
  const bs = new Growable();
  const rs = new Growable();
  const tx: number[] = [];
  const ty: number[] = [];
  rides.forEach((r, ri) => {
    for (const t of r.tracks) {
      let inside = false;
      for (let i = 0; i < t.length && !inside; i += 2) {
        inside = t[i] >= w && t[i] <= e && t[i + 1] >= s && t[i + 1] <= n;
      }
      if (!inside) continue;
      // decimate along-track to ~rideChordM so headings are stable
      tx.length = ty.length = 0;
      let cum = 0;
      let bucket = 0;
      let px = 0;
      let py = 0;
      const last = t.length / 2 - 1;
      for (let i = 0; i <= last; i++) {
        const x = proj.x(t[2 * i], t[2 * i + 1]);
        const y = proj.y(t[2 * i + 1]);
        if (i > 0) cum += Math.hypot(x - px, y - py);
        px = x;
        py = y;
        const b = Math.floor(cum / p.rideChordM);
        if (i === 0 || b > bucket || i === last) {
          tx.push(x);
          ty.push(y);
          bucket = b;
        }
      }
      densify(
        tx,
        ty,
        0,
        tx.length,
        p.sampleStepM,
        (x, y, b) => {
          xs.push(x);
          ys.push(y);
          bs.push(b);
          rs.push(ri);
        },
        Math.ceil
      );
    }
  });
  return { xs: xs.get(), ys: ys.get(), bearings: bs.get(), ride: rs.get() };
}

const SCHEMA = `
DROP TABLE IF EXISTS rides;
DROP TABLE IF EXISTS coverage;
DROP TABLE IF EXISTS ride_edges;
CREATE TABLE rides (
  idx INTEGER PRIMARY KEY,       -- chronological order
  id INTEGER NOT NULL,           -- strava activity id
  name TEXT, sport TEXT, start_date TEXT,
  distance_m REAL, moving_time_s INTEGER,
  start_lon REAL, start_lat REAL
);
CREATE TABLE coverage (
  edge_id INTEGER PRIMARY KEY,
  n_samples INTEGER NOT NULL,
  covered INTEGER NOT NULL,
  frac REAL NOT NULL,
  n_rides INTEGER NOT NULL,      -- rides that rode >= rideBlockFrac of it
  first_ride INTEGER,            -- first such ride
  last_ride INTEGER,             -- most recent such ride
  done_ride INTEGER              -- ride after which frac first reached doneFrac
);
CREATE TABLE ride_edges (
  ride_idx INTEGER NOT NULL,
  edge_id INTEGER NOT NULL,
  covered INTEGER NOT NULL,      -- samples of the block this ride covered
  new INTEGER NOT NULL,          -- ...that no earlier ride had
  PRIMARY KEY (ride_idx, edge_id)
) WITHOUT ROWID;
`;

export function match(db: Db, rides: Ride[], p: MatchParams = DEFAULT_PARAMS) {
  const t0 = Date.now();
  const secs = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  const bb = db
    .prepare(
      'SELECT min(min_lon) w, min(min_lat) s, max(max_lon) e, max(max_lat) n FROM edges'
    )
    .get()!;
  const proj = new LocalProjection((bb.w + bb.e) / 2, (bb.s + bb.n) / 2);
  const rp = ridePoints(rides, proj, [bb.w, bb.s, bb.e, bb.n], p);
  const nPts = rp.xs.length;
  if (!nPts) throw new Error('no rides inside this region');
  const grid = new Grid(rp.xs, rp.ys, p.radiusM);
  log(`${nPts.toLocaleString()} ride points (${secs()})`);

  // bounding box of the ride points, in lon/lat, to limit which blocks we look at
  let rw = Infinity;
  let rs = Infinity;
  let re = -Infinity;
  let rn = -Infinity;
  for (const r of rides) {
    for (const t of r.tracks) {
      for (let i = 0; i < t.length; i += 2) {
        if (t[i] < bb.w || t[i] > bb.e || t[i + 1] < bb.s || t[i + 1] > bb.n)
          continue;
        rw = Math.min(rw, t[i]);
        re = Math.max(re, t[i]);
        rs = Math.min(rs, t[i + 1]);
        rn = Math.max(rn, t[i + 1]);
      }
    }
  }
  const pad = 0.002;

  db.exec(SCHEMA);
  db.exec('BEGIN');
  db.prepare("INSERT OR REPLACE INTO meta VALUES ('match_params', ?)").run(
    JSON.stringify(p)
  );
  const insRide = db.prepare('INSERT INTO rides VALUES (?,?,?,?,?,?,?,?,?)');
  rides.forEach((r, i) =>
    insRide.run(
      i,
      r.id,
      r.name,
      r.sport,
      r.startDate,
      r.distanceM,
      r.movingTimeS,
      r.tracks[0][0],
      r.tracks[0][1]
    )
  );
  const insCov = db.prepare('INSERT INTO coverage VALUES (?,?,?,?,?,?,?,?)');
  const insRE = db.prepare('INSERT INTO ride_edges VALUES (?,?,?,?)');

  const edges = db
    .prepare(
      'SELECT id, coords FROM edges WHERE max_lon >= ? AND min_lon <= ? AND max_lat >= ? AND min_lat <= ?'
    )
    .all(rw - pad, re + pad, rs - pad, rn + pad);
  log(
    `${edges.length.toLocaleString()} blocks within the rides' bounding box (${secs()})`
  );

  const r2 = p.radiusM * p.radiusM;
  const tol = (p.angleTolDeg * Math.PI) / 180;
  const nr = rides.length;
  // per-block scratch, reset via `touched`
  const rideCount = new Int32Array(nr);
  const rideNew = new Int32Array(nr);
  const seenStamp = new Int32Array(nr);
  let stamp = 0;
  const touched: number[] = [];
  const firsts: number[] = [];
  const bx: number[] = [];
  const by: number[] = [];

  let nCovered = 0;
  for (const { id, coords } of edges) {
    const c: number[][] = JSON.parse(coords);
    bx.length = by.length = 0;
    for (const [lon, lat] of c) {
      bx.push(proj.x(lon, lat));
      by.push(proj.y(lat));
    }
    let nSamples = 0;
    firsts.length = 0;
    densify(bx, by, 0, bx.length, p.sampleStepM, (x, y, b) => {
      nSamples++;
      stamp++;
      let first = nr;
      grid.near(x, y, (i) => {
        const dx = rp.xs[i] - x;
        const dy = rp.ys[i] - y;
        if (dx * dx + dy * dy > r2) return;
        let ang = Math.abs(b - rp.bearings[i]);
        if (ang > Math.PI / 2) ang = Math.PI - ang;
        if (ang > tol) return;
        const r = rp.ride[i];
        if (seenStamp[r] === stamp) return;
        seenStamp[r] = stamp;
        if (rideCount[r] === 0 && rideNew[r] === 0) touched.push(r);
        rideCount[r]++;
        if (r < first) first = r;
      });
      if (first < nr) {
        firsts.push(first);
        if (rideCount[first] === 0 && rideNew[first] === 0) touched.push(first);
        rideNew[first]++;
      }
    });
    if (firsts.length) {
      nCovered++;
      firsts.sort((a, b) => a - b);
      const need = Math.ceil(nSamples * p.doneFrac);
      const doneRide =
        firsts.length >= need ? firsts[Math.max(need - 1, 0)] : null;
      const rodeMin = Math.ceil(nSamples * p.rideBlockFrac);
      let nRides = 0;
      let firstRide: number | null = null;
      let lastRide: number | null = null;
      for (const r of touched) {
        if (rideCount[r] > 0) insRE.run(r, id, rideCount[r], rideNew[r]);
        if (rideCount[r] >= rodeMin) {
          nRides++;
          if (firstRide === null || r < firstRide) firstRide = r;
          if (lastRide === null || r > lastRide) lastRide = r;
        }
      }
      insCov.run(
        id,
        nSamples,
        firsts.length,
        firsts.length / nSamples,
        nRides,
        firstRide,
        lastRide,
        doneRide
      );
    }
    for (const r of touched) rideCount[r] = rideNew[r] = 0;
    touched.length = 0;
  }
  db.exec('CREATE INDEX ride_edges_edge ON ride_edges(edge_id)');
  db.exec('COMMIT');
  log(`${nCovered.toLocaleString()} blocks touched by rides (${secs()})`);
}
