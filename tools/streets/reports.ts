// Queries over the matched database. Everything here is read-only apart from
// the TEMP tables it builds.

import { Db, Row } from './db';
import { compass, distBearing } from './geo';
import { DEFAULT_PARAMS } from './match';

export interface Opts {
  classes: string[];
  doneFrac: number;
  /** drop dead-end blocks shorter than this (metres); 0 keeps everything */
  skipStubsM: number;
}

/** TEMP table `b`: the blocks that count, joined with coverage. */
function blocksTable(db: Db, o: Opts) {
  db.exec('DROP TABLE IF EXISTS temp.b');
  db.prepare(
    `CREATE TEMP TABLE b AS
     SELECT e.id, e.way_id, e.node_a, e.node_b, e.highway, e.class, e.length_m,
            coalesce(e.name, '(unnamed ' || e.highway || ')') AS street,
            e.name IS NULL AS unnamed,
            coalesce(ci.name, '?') AS town,
            coalesce(c.frac, 0) AS frac,
            coalesce(c.frac, 0) >= ? AS done,
            coalesce(c.n_rides, 0) AS n_rides,
            c.first_ride, c.last_ride, c.done_ride,
            (e.min_lon + e.max_lon) / 2 AS lon, (e.min_lat + e.max_lat) / 2 AS lat
     FROM edges e
     LEFT JOIN cities ci ON ci.id = e.city_id
     LEFT JOIN coverage c ON c.edge_id = e.id
     WHERE e.class IN (${o.classes.map(() => '?').join(',')})`
  ).run(o.doneFrac, ...o.classes);
  if (o.skipStubsM > 0) {
    // a stub is a dead end: one of its nodes touches no other counted block
    db.exec(`DROP TABLE IF EXISTS temp.deg;
      CREATE TEMP TABLE deg AS SELECT n, count(*) deg
        FROM (SELECT node_a n FROM b UNION ALL SELECT node_b FROM b) GROUP BY n;
      CREATE UNIQUE INDEX temp.deg_n ON deg(n);`);
    db.prepare(
      `DELETE FROM b WHERE length_m < ?
       AND ((SELECT deg FROM deg WHERE n = b.node_a) = 1 OR (SELECT deg FROM deg WHERE n = b.node_b) = 1)`
    ).run(o.skipStubsM);
  }
  db.exec('CREATE INDEX temp.b_town ON b(town)');
}

type Cell = string | number | null | undefined;

function table(rows: Cell[][], headers: string[], align?: ('<' | '>')[]) {
  const str = rows.map((r) => r.map((v) => (v == null ? '' : String(v))));
  const w = headers.map((h, i) =>
    Math.max(h.length, ...str.map((r) => r[i].length))
  );
  const al = align ?? ['<', ...headers.slice(1).map(() => '>' as const)];
  const fmt = (r: string[]) =>
    r
      .map((v, i) => (al[i] === '<' ? v.padEnd(w[i]) : v.padStart(w[i])))
      .join('  ');
  console.log(fmt(headers));
  console.log(w.map((n) => '-'.repeat(n)).join('  '));
  for (const r of str) console.log(fmt(r));
}

const km = (m: number | null | undefined) => ((m ?? 0) / 1000).toFixed(1);
const pct = (x: number | null | undefined) => `${Math.round(100 * (x ?? 0))}%`;
const m0 = (m: number) => m.toFixed(0);

function rideDates(db: Db): string[] {
  return db
    .prepare('SELECT start_date FROM rides ORDER BY idx')
    .all()
    .map((r) => (r.start_date as string).slice(0, 10));
}

// --- stats ---------------------------------------------------------------

export function stats(db: Db, o: Opts, limit: number) {
  blocksTable(db, o);
  const tot = db
    .prepare(
      'SELECT sum(done * length_m) done, count(DISTINCT town) FILTER (WHERE done) towns FROM b'
    )
    .get()!;
  const nr = db
    .prepare(
      'SELECT count(*) n, (SELECT count(DISTINCT ride_idx) FROM ride_edges) matched FROM rides'
    )
    .get()!;
  console.log(
    `${km(tot.done)} km of ${o.classes.join('/')} blocks done across ${tot.towns} towns ` +
      `(from ${nr.matched} rides with a match, of ${nr.n})\n`
  );
  const rows = db
    .prepare(
      `WITH s AS (
         SELECT town, street, sum(length_m) len, sum(done * length_m) done_len
         FROM b WHERE NOT unnamed GROUP BY town, street
       )
       SELECT t.town, t.len, t.done_len,
              (SELECT count(*) FROM s WHERE s.town = t.town) streets,
              (SELECT count(*) FROM s WHERE s.town = t.town AND s.done_len >= 0.9 * s.len) done_streets,
              (SELECT count(*) FROM s WHERE s.town = t.town AND s.done_len > 0) touched
       FROM (SELECT town, sum(length_m) len, sum(done * length_m) done_len FROM b GROUP BY town) t
       WHERE t.done_len > 0
       ORDER BY t.done_len DESC LIMIT ?`
    )
    .all(limit);
  table(
    rows.map((r) => [
      r.town,
      km(r.done_len),
      km(r.len),
      pct(r.done_len / r.len),
      `${r.done_streets}/${r.streets}`,
      r.touched,
    ]),
    ['town', 'done km', 'of km', 'done', 'streets done', 'streets touched']
  );
}

// --- town ----------------------------------------------------------------

export function town(
  db: Db,
  o: Opts,
  name: string,
  todo: boolean,
  sort: string
) {
  blocksTable(db, o);
  const real = db
    .prepare('SELECT town FROM b WHERE town LIKE ? LIMIT 1')
    .get(name);
  if (!real) throw new Error(`no town matching ${name}`);
  const dates = rideDates(db);
  const rows = db
    .prepare(
      `SELECT street, sum(length_m) len, sum(done * length_m) done_len, max(last_ride) last,
              min(first_ride) first, max(n_rides) n_rides
       FROM b WHERE town = ? GROUP BY street`
    )
    .all(real.town)
    .map((r: Row) => ({ ...r, f: r.len ? r.done_len / r.len : 0 }) as Row);
  const out = rows.filter((r) => !todo || r.f < 0.9);
  const sorts: Record<
    string,
    (a: (typeof out)[0], b: (typeof out)[0]) => number
  > = {
    pct: (a, b) => a.f - b.f || b.len - a.len,
    length: (a, b) => b.len - a.len,
    todo: (a, b) => b.len - b.done_len - (a.len - a.done_len),
    name: (a, b) => (a.street < b.street ? -1 : 1),
    last: (a, b) => (a.last ?? -1) - (b.last ?? -1),
  };
  out.sort(sorts[sort]);
  const totLen = rows.reduce((s, r) => s + r.len, 0);
  const totDone = rows.reduce((s, r) => s + r.done_len, 0);
  console.log(
    `${real.town}: ${km(totDone)} of ${km(totLen)} km done (${pct(totDone / totLen)})\n`
  );
  table(
    out.map((r) => [
      r.street,
      m0(r.len),
      m0(r.len - r.done_len),
      pct(r.f),
      r.first != null ? dates[r.first] : '',
      r.last != null ? dates[r.last] : '',
      r.n_rides || '',
    ]),
    ['street', 'len m', 'todo m', 'done', 'first', 'last', 'max rides']
  );
}

// --- where am I? ---------------------------------------------------------

/** The most common ride start, to ~300 m. */
export function home(db: Db): [number, number] {
  const starts = db
    .prepare('SELECT start_lon lon, start_lat lat FROM rides')
    .all();
  const cellOf = (r: { lon: number; lat: number }) =>
    `${Math.round(r.lon / 0.003)},${Math.round(r.lat / 0.003)}`;
  const counts = new Map<string, number>();
  for (const r of starts)
    counts.set(cellOf(r as never), (counts.get(cellOf(r as never)) ?? 0) + 1);
  const best = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const pts = starts.filter((r) => cellOf(r as never) === best);
  const median = (v: number[]) => {
    const s = v.slice().sort((a, b) => a - b);
    return s.length % 2
      ? s[s.length >> 1]
      : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  };
  return [median(pts.map((p) => p.lon)), median(pts.map((p) => p.lat))];
}

function parseAt(db: Db, at?: string): [number, number] {
  if (!at) return home(db);
  const [lat, lon] = at.split(',').map(Number);
  return [lon, lat];
}

function todoBlocks(db: Db, lon: number, lat: number, radiusKm: number) {
  const dlat = radiusKm / 110.5;
  const dlon = radiusKm / (111.3 * Math.cos((lat * Math.PI) / 180));
  return db
    .prepare(
      `SELECT id, street, town, length_m, frac, node_a, node_b, lon, lat, unnamed
       FROM b WHERE NOT done AND lon BETWEEN ? AND ? AND lat BETWEEN ? AND ?`
    )
    .all(lon - dlon, lon + dlon, lat - dlat, lat + dlat);
}

export function nearby(
  db: Db,
  o: Opts,
  at: string | undefined,
  radiusKm: number,
  limit: number,
  includeUnnamed: boolean,
  minM: number
) {
  blocksTable(db, o);
  const [lon, lat] = parseAt(db, at);
  const byStreet = new Map<
    string,
    {
      street: string;
      town: string;
      d: number;
      bearing: number;
      todo: number;
      blocks: number;
    }
  >();
  for (const r of todoBlocks(db, lon, lat, radiusKm)) {
    const { d, bearing } = distBearing(lon, lat, r.lon, r.lat);
    if (d > radiusKm * 1000 || (r.unnamed && !includeUnnamed)) continue;
    const k = `${r.street}\0${r.town}`;
    let s = byStreet.get(k);
    if (!s)
      byStreet.set(
        k,
        (s = {
          street: r.street,
          town: r.town,
          d: Infinity,
          bearing: 0,
          todo: 0,
          blocks: 0,
        })
      );
    if (d < s.d) {
      s.d = d;
      s.bearing = bearing;
    }
    s.todo += r.length_m * (1 - r.frac);
    s.blocks++;
  }
  const doneFrac = new Map<string, number>();
  for (const r of db
    .prepare(
      'SELECT street, town, sum(length_m) len, sum(done * length_m) dl FROM b GROUP BY street, town'
    )
    .all()) {
    const k = `${r.street}\0${r.town}`;
    if (byStreet.has(k)) doneFrac.set(k, r.dl / r.len);
  }
  const out = [...byStreet.entries()]
    .filter(([, v]) => v.todo >= minM)
    .sort((a, b) => a[1].d - b[1].d)
    .slice(0, limit);
  console.log(
    `unridden streets within ${radiusKm} km of ${lat.toFixed(4)},${lon.toFixed(4)}\n`
  );
  table(
    out.map(([k, v]) => [
      v.street,
      v.town,
      `${(v.d / 1000).toFixed(2)} km ${compass(v.bearing)}`,
      m0(v.todo),
      v.blocks,
      pct(doneFrac.get(k)),
    ]),
    ['street', 'town', 'nearest', 'todo m', 'blocks', 'street done']
  );
}

/** Connected clusters of unridden blocks: a neighbourhood you could knock out in one go. */
export function pockets(
  db: Db,
  o: Opts,
  at: string | undefined,
  radiusKm: number,
  limit: number,
  minM: number,
  cellM: number
) {
  blocksTable(db, o);
  const [lon, lat] = parseAt(db, at);
  const rows = todoBlocks(db, lon, lat, radiusKm);
  // Union-find over shared nodes, only joining blocks within the same
  // ~cellM square; otherwise a whole unridden suburb becomes one cluster.
  const cos = Math.cos((lat * Math.PI) / 180);
  const cell = (r: { lon: number; lat: number }) =>
    `${Math.floor((r.lon * 111_320 * cos) / cellM)},${Math.floor((r.lat * 110_540) / cellM)}`;
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let p = parent.get(x) ?? x;
    while (p !== x) {
      const gp = parent.get(p) ?? p;
      parent.set(x, gp);
      x = p;
      p = gp;
    }
    return x;
  };
  for (const r of rows) {
    const c = cell(r as never);
    parent.set(find(`${c}:${r.node_a}`), find(`${c}:${r.node_b}`));
  }
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const g = find(`${cell(r as never)}:${r.node_a}`);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(r);
  }
  const out = [];
  for (const g of groups.values()) {
    const todo = g.reduce((s, r) => s + r.length_m * (1 - r.frac), 0);
    if (todo < minM) continue;
    const len = g.reduce((s, r) => s + r.length_m, 0);
    const clon = g.reduce((s, r) => s + r.lon * r.length_m, 0) / len;
    const clat = g.reduce((s, r) => s + r.lat * r.length_m, 0) / len;
    const { d, bearing } = distBearing(lon, lat, clon, clat);
    if (d > radiusKm * 1000) continue;
    const names = new Map<string, number>();
    const towns = new Map<string, number>();
    for (const r of g) {
      if (!r.unnamed)
        names.set(r.street, (names.get(r.street) ?? 0) + r.length_m);
      towns.set(r.town, (towns.get(r.town) ?? 0) + 1);
    }
    const top = (m: Map<string, number>, n: number) =>
      [...m]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([k]) => k);
    out.push({
      d,
      bearing,
      todo,
      blocks: g.length,
      names: top(names, 3),
      town: top(towns, 1)[0],
      clat,
      clon,
    });
  }
  // rank by "bang for the buck": unridden metres per km travelled to get there
  out.sort((a, b) => b.todo / (1000 + b.d) - a.todo / (1000 + a.d));
  console.log(
    `clusters of unridden blocks within ${radiusKm} km of ${lat.toFixed(4)},${lon.toFixed(4)}, best first\n`
  );
  table(
    out
      .slice(0, limit)
      .map((p) => [
        p.names.join(', ') || '(unnamed)',
        p.town,
        `${(p.d / 1000).toFixed(1)} km ${compass(p.bearing)}`,
        m0(p.todo),
        p.blocks,
        `https://www.openstreetmap.org/#map=17/${p.clat.toFixed(5)}/${p.clon.toFixed(5)}`,
      ]),
    ['streets', 'town', 'distance', 'todo m', 'blocks', 'map']
  );
}

/** Named streets that are mostly done: the cheapest completions. */
export function almost(db: Db, o: Opts, limit: number, townName?: string) {
  blocksTable(db, o);
  const rows = db
    .prepare(
      `SELECT street, town, sum(length_m) len, sum(done * length_m) dl
       FROM b WHERE NOT unnamed ${townName ? 'AND town LIKE ?' : ''} GROUP BY street, town
       HAVING dl >= 0.5 * len AND dl < 0.9 * len
       ORDER BY len - dl LIMIT ?`
    )
    .all(...(townName ? [townName] : []), limit);
  table(
    rows.map((r) => [
      r.street,
      r.town,
      m0(r.len - r.dl),
      m0(r.len),
      pct(r.dl / r.len),
    ]),
    ['street', 'town', 'todo m', 'len m', 'done']
  );
}

// --- rides ---------------------------------------------------------------

export function rides(
  db: Db,
  o: Opts,
  sort: string,
  limit: number,
  year?: string
) {
  blocksTable(db, o);
  const order = (
    { new: 'new_m DESC', date: 'idx DESC', blocks: 'blocks DESC' } as Record<
      string,
      string
    >
  )[sort];
  const rows = db
    .prepare(
      `WITH per AS (
         SELECT re.ride_idx,
                sum(b.length_m * re.new / c.n_samples) new_m,
                sum(re.covered >= ? * c.n_samples) blocks,
                sum(b.done_ride = re.ride_idx) finished
         FROM ride_edges re JOIN coverage c USING (edge_id) JOIN b ON b.id = re.edge_id
         GROUP BY re.ride_idx
       )
       SELECT r.id, r.start_date, r.name, r.distance_m, coalesce(per.new_m, 0) new_m,
              coalesce(per.blocks, 0) blocks, coalesce(per.finished, 0) finished, r.idx
       FROM rides r LEFT JOIN per ON per.ride_idx = r.idx
       ${year ? 'WHERE substr(r.start_date, 1, 4) = ?' : ''}
       ORDER BY ${order} LIMIT ?`
    )
    .all(DEFAULT_PARAMS.rideBlockFrac, ...(year ? [year] : []), limit);
  table(
    rows.map((r) => [
      r.id,
      r.start_date.slice(0, 10),
      r.name.slice(0, 40),
      km(r.distance_m),
      km(r.new_m),
      r.blocks,
      r.finished,
    ]),
    ['id', 'date', 'name', 'km', 'new km', 'blocks', 'finished'],
    ['<', '<', '<', '>', '>', '>', '>']
  );
}

export function ride(db: Db, o: Opts, rideId: number) {
  blocksTable(db, o);
  const r = db
    .prepare('SELECT idx, name, start_date, distance_m FROM rides WHERE id = ?')
    .get(rideId);
  if (!r) throw new Error(`ride ${rideId} not found (or not a matched ride)`);
  const rows = db
    .prepare(
      `SELECT b.street, b.town, sum(b.length_m * re.covered / c.n_samples) rode,
              sum(b.length_m * re.new / c.n_samples) new, sum(b.done_ride = ?) > 0 finished
       FROM ride_edges re JOIN coverage c USING (edge_id) JOIN b ON b.id = re.edge_id
       WHERE re.ride_idx = ? AND re.covered >= ? * c.n_samples
       GROUP BY b.street, b.town ORDER BY b.town, b.street`
    )
    .all(r.idx, r.idx, DEFAULT_PARAMS.rideBlockFrac);
  const newM = rows.reduce((s, x) => s + x.new, 0);
  console.log(
    `${r.name} — ${r.start_date.slice(0, 16)} — ${km(r.distance_m)} km ridden, ${km(newM)} km new\n`
  );
  table(
    rows.map((x) => [
      x.street,
      x.town,
      m0(x.rode),
      x.new >= 1 ? m0(x.new) : '',
      x.finished ? '✓' : '',
    ]),
    ['street', 'town', 'rode m', 'new m', 'finished a block']
  );
}

export function street(db: Db, o: Opts, name: string, townName?: string) {
  blocksTable(db, o);
  const dates = rideDates(db);
  const rows = db
    .prepare(
      `SELECT town, street, id, length_m, frac, n_rides, first_ride, last_ride, done_ride
       FROM b WHERE street LIKE ? ${townName ? 'AND town LIKE ?' : ''} ORDER BY town, street, way_id, id`
    )
    .all(name, ...(townName ? [townName] : []));
  if (!rows.length) throw new Error('no such street');
  const d = (i: number | null) => (i != null ? dates[i] : '');
  table(
    rows.map((r) => [
      r.town,
      r.street,
      r.id,
      m0(r.length_m),
      pct(r.frac),
      r.n_rides,
      d(r.first_ride),
      d(r.done_ride),
      d(r.last_ride),
    ]),
    [
      'town',
      'street',
      'block',
      'len m',
      'covered',
      'rides',
      'first',
      'done',
      'last',
    ]
  );
}

export function timeline(db: Db, o: Opts, townName?: string) {
  blocksTable(db, o);
  const rows = db
    .prepare(
      `SELECT substr(r.start_date, 1, 4) yr, sum(b.length_m) m, count(DISTINCT b.town) towns
       FROM b JOIN rides r ON r.idx = b.done_ride WHERE b.done ${townName ? 'AND b.town LIKE ?' : ''}
       GROUP BY yr ORDER BY yr`
    )
    .all(...(townName ? [townName] : []));
  const perYear = new Map(
    db
      .prepare(
        'SELECT substr(start_date, 1, 4) yr, count(*) n, sum(distance_m) dist FROM rides GROUP BY 1'
      )
      .all()
      .map((r) => [r.yr, r])
  );
  let total = 0;
  table(
    rows.map((r) => {
      total += r.m;
      const y = perYear.get(r.yr);
      return [r.yr, y?.n ?? 0, km(y?.dist), km(r.m), km(total), r.towns];
    }),
    ['year', 'rides', 'ridden km', 'new km', 'total km', 'towns']
  );
}

/** Streets you ride over and over, by average rides per block. */
export function favorites(db: Db, o: Opts, limit: number) {
  blocksTable(db, o);
  const rows = db
    .prepare(
      `SELECT street, town, sum(n_rides * length_m) / sum(length_m) avg_rides, sum(length_m) len, max(n_rides) max_rides
       FROM b WHERE NOT unnamed GROUP BY street, town HAVING len > 200
       ORDER BY avg_rides DESC LIMIT ?`
    )
    .all(limit);
  table(
    rows.map((r) => [
      r.street,
      r.town,
      m0(r.avg_rides),
      m0(r.len),
      r.max_rides,
    ]),
    ['street', 'town', 'avg rides', 'len m', 'max rides']
  );
}

/** Done streets you haven't been back to since `before`. */
export function stale(
  db: Db,
  o: Opts,
  before: string,
  limit: number,
  townName?: string
) {
  blocksTable(db, o);
  const rows = db
    .prepare(
      `SELECT b.street, b.town, sum(b.length_m) len, max(r.start_date) last
       FROM b JOIN rides r ON r.idx = b.last_ride
       WHERE b.done AND NOT b.unnamed ${townName ? 'AND town LIKE ?' : ''}
       GROUP BY b.street, b.town HAVING last < ? AND sum(b.length_m) > 150
       ORDER BY sum(b.length_m) DESC LIMIT ?`
    )
    .all(...(townName ? [townName] : []), before, limit);
  table(
    rows.map((r) => [r.street, r.town, m0(r.len), r.last.slice(0, 10)]),
    ['street', 'town', 'len m', 'last ridden']
  );
}

// --- export --------------------------------------------------------------

export function exportGeoJson(
  db: Db,
  o: Opts,
  towns: string[],
  minDonePct: number
) {
  blocksTable(db, o);
  const dates = rideDates(db);
  const all = db
    .prepare(
      'SELECT town, sum(length_m) len, sum(done * length_m) dl FROM b GROUP BY town'
    )
    .all();
  const townSet = towns.length
    ? all
        .filter((t) =>
          towns.some((p) => p.toLowerCase() === t.town.toLowerCase())
        )
        .map((t) => t.town)
    : all.filter((t) => (t.dl / t.len) * 100 >= minDonePct).map((t) => t.town);
  const rows = db
    .prepare(
      `SELECT b.id, b.street, b.town, b.highway, b.length_m, b.frac, b.done, b.n_rides,
              b.first_ride, b.last_ride, b.done_ride, e.coords
       FROM b JOIN edges e ON e.id = b.id WHERE b.town IN (${townSet.map(() => '?').join(',')})`
    )
    .all(...townSet);
  const d = (i: number | null) => (i != null ? dates[i] : null);
  return {
    type: 'FeatureCollection' as const,
    towns: townSet.sort(),
    features: rows.map((r) => ({
      type: 'Feature' as const,
      id: r.id,
      geometry: {
        type: 'LineString' as const,
        coordinates: (JSON.parse(r.coords) as number[][]).map(([x, y]) => [
          +x.toFixed(6),
          +y.toFixed(6),
        ]),
      },
      properties: {
        street: r.street,
        town: r.town,
        highway: r.highway,
        length_m: Math.round(r.length_m),
        covered: +r.frac.toFixed(2),
        done: !!r.done,
        rides: r.n_rides,
        first: d(r.first_ride),
        last: d(r.last_ride),
        done_date: d(r.done_ride),
      },
    })),
  };
}
