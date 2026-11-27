// Build the street network from an OSM extract.
//
// Ways tagged highway=* are split at every node shared with another kept way,
// producing "blocks": the stretch of a street between two intersections. Each
// block is assigned the town (admin_level=8 boundary) containing its midpoint.
//
// Three passes over the file, each only inflating the blobs it needs:
//   1. relations: find town boundaries and their member ways
//   2. ways: keep highways and boundary members
//   3. nodes: look up coordinates for just the nodes those ways use

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
} from 'fs';
import path from 'path';
import RBush from 'rbush';

import { classify } from './classify';
import { openDb } from './db';
import { haversine } from './geo';
import { PolygonIndex, assembleRings } from './multipolygon';
import { NODES, RELATIONS, Tags, WAYS, blocks, indexBlobs } from './pbf';

// never stored: not rideable, or not a "street" in any sense
const DROP_HIGHWAY = new Set([
  'motorway',
  'motorway_link',
  'proposed',
  'construction',
  'abandoned',
  'disused',
  'razed',
  'platform',
  'raceway',
  'bus_stop',
  'elevator',
  'steps',
  'corridor',
  'via_ferrata',
  'rest_area',
  'services',
  'escape',
  'emergency_bay',
  'bus_guideway',
  'busway',
]);

// tags copied into the database, used for classification and display
const KEEP_TAGS = [
  'highway',
  'name',
  'ref',
  'service',
  'access',
  'bicycle',
  'motor_vehicle',
  'foot',
  'footway',
  'oneway',
  'surface',
  'area',
  'motorroad',
  'tunnel',
  'bridge',
  'cycleway',
  'cycleway:both',
  'cycleway:left',
  'cycleway:right',
  'segregated',
  'noname',
] as const;

function keepWay(tags: Tags): boolean {
  const hw = tags.get('highway');
  if (hw === undefined || DROP_HIGHWAY.has(hw)) return false;
  if (tags.get('area') === 'yes') return false;
  // sidewalks and crosswalks duplicate the street they're next to
  const fw = tags.get('footway');
  if (
    (hw === 'footway' || hw === 'path' || hw === 'cycleway') &&
    (fw === 'sidewalk' || fw === 'crossing')
  ) {
    return false;
  }
  return true;
}

function isTown(tags: Tags) {
  return (
    tags.get('boundary') === 'administrative' && tags.get('admin_level') === '8'
  );
}

const log = (msg: string) => process.stderr.write(msg + '\n');

/** Index of `id` in sorted `arr`, or -1. */
function bsearch(arr: Float64Array, id: number) {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const v = arr[mid];
    if (v < id) lo = mid + 1;
    else if (v > id) hi = mid - 1;
    else return mid;
  }
  return -1;
}

export async function importOsm(pbfPath: string, dbPath: string) {
  const t0 = Date.now();
  const secs = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  const file = readFileSync(pbfPath);
  const refs = indexBlobs(file);
  log(
    `read ${(file.length / 1e6).toFixed(0)} MB, ${refs.length} blobs (${secs()})`
  );

  // Which blobs hold what? Geofabrik files are sorted nodes, ways, relations,
  // but finding out requires inflating each one; do that once, and handle
  // relations while we're there.
  const contents = new Uint8Array(refs.length);
  const towns: { id: number; name: string; ways: number[] }[] = [];
  const closedTownWays = new Map<number, string>(); // town mapped as a closed way
  for await (const [i, b] of blocks(file, refs)) {
    contents[i] = b.contents;
    if (b.contents & RELATIONS) {
      b.read({
        relation(id, tags, members) {
          if (!isTown(tags)) return;
          towns.push({
            id,
            name: tags.get('name') ?? `relation ${id}`,
            ways: members
              .filter((m) => m.type === 'way' && m.role !== 'subarea')
              .map((m) => m.ref),
          });
        },
      });
    }
  }
  log(`pass 1: ${towns.length} town relations (${secs()})`);

  const boundaryWayIds = new Set(towns.flatMap((t) => t.ways));
  const boundaryWays = new Map<number, number[]>();
  const hwIds: number[] = [];
  const hwTags: Record<string, string>[] = [];
  const hwRefs: number[][] = [];
  const pick = (mask: number) => refs.filter((_, i) => contents[i] & mask);
  for await (const [, b] of blocks(file, pick(WAYS))) {
    b.read({
      way(id, tags, nodeRefs) {
        if (boundaryWayIds.has(id)) boundaryWays.set(id, nodeRefs);
        if (isTown(tags) && nodeRefs[0] === nodeRefs[nodeRefs.length - 1]) {
          closedTownWays.set(id, tags.get('name') ?? `way ${id}`);
          boundaryWays.set(id, nodeRefs);
        }
        if (!keepWay(tags) || nodeRefs.length < 2) return;
        hwIds.push(id);
        hwTags.push(tags.toObject(KEEP_TAGS));
        hwRefs.push(nodeRefs);
      },
    });
  }
  for (const [id, name] of closedTownWays)
    towns.push({ id: -id, name, ways: [id] });
  log(
    `pass 2: ${hwIds.length} highway ways, ${boundaryWays.size} boundary ways (${secs()})`
  );

  // Every node we need, sorted, with a reference count (for splitting). Way
  // endpoints count double so they always split.
  let total = 0;
  for (const r of hwRefs) total += r.length + 2;
  for (const r of boundaryWays.values()) total += r.length;
  const all = new Float64Array(total);
  let k = 0;
  for (const r of hwRefs) {
    for (const n of r) all[k++] = n;
    all[k++] = r[0];
    all[k++] = r[r.length - 1];
  }
  const highwayEnd = k;
  for (const r of boundaryWays.values()) for (const n of r) all[k++] = n;
  // count highway references only; boundary nodes don't split streets
  const hwSorted = all.slice(0, highwayEnd).sort();
  all.sort();
  const nodeIds = new Float64Array(all.length);
  let u = 0;
  for (let i = 0; i < all.length; i++) {
    if (i === 0 || all[i] !== all[i - 1]) nodeIds[u++] = all[i];
  }
  const ids = nodeIds.subarray(0, u);
  const refCount = new Uint32Array(u);
  for (let i = 0, j = 0; i < hwSorted.length; i++) {
    while (ids[j] < hwSorted[i]) j++;
    refCount[j]++;
  }
  log(`${u} nodes needed (${secs()})`);

  const lon = new Float64Array(u).fill(NaN);
  const lat = new Float64Array(u).fill(NaN);
  // node ids come in ascending order, so walk both lists together, falling
  // back to binary search if the file turns out not to be sorted
  let cursor = 0;
  for await (const [, b] of blocks(file, pick(NODES))) {
    b.read({
      node(id, x, y) {
        if (cursor < u && ids[cursor] < id) {
          while (cursor < u && ids[cursor] < id) cursor++;
        } else if (cursor > 0 && ids[cursor - 1] >= id) {
          const j = bsearch(ids, id);
          if (j >= 0) {
            lon[j] = x;
            lat[j] = y;
          }
          return;
        }
        if (ids[cursor] === id) {
          lon[cursor] = x;
          lat[cursor] = y;
          cursor++;
        }
      },
    });
  }
  log(`pass 3: node coordinates (${secs()})`);

  // town polygons
  type TownItem = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    i: number;
  };
  const townIndex = new RBush<TownItem>();
  const townPolys: PolygonIndex[] = [];
  const townRows: { name: string; osmId: number }[] = [];
  let broken = 0;
  for (const t of towns) {
    const ways = t.ways
      .map((w) => boundaryWays.get(w))
      .filter((w): w is number[] => !!w);
    const { rings, unclosed } = assembleRings(ways);
    if (unclosed) broken++;
    if (!rings.length) continue;
    const coordRings = rings.map((r) => {
      const c = new Float64Array(r.length * 2);
      r.forEach((n, i) => {
        const j = bsearch(ids, n);
        c[2 * i] = lon[j];
        c[2 * i + 1] = lat[j];
      });
      return c;
    });
    const poly = new PolygonIndex(coordRings);
    const i = townPolys.length;
    townPolys.push(poly);
    townRows.push({ name: t.name, osmId: t.id });
    townIndex.insert({
      minX: poly.minLon,
      minY: poly.minLat,
      maxX: poly.maxLon,
      maxY: poly.maxLat,
      i,
    });
  }
  log(
    `${townPolys.length} towns assembled${broken ? `, ${broken} with unclosed rings` : ''} (${secs()})`
  );

  mkdirSync(path.dirname(dbPath), { recursive: true });
  const tmp = dbPath + '.importing';
  if (existsSync(tmp)) unlinkSync(tmp);
  const db = openDb(tmp);
  db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;');
  db.exec(SCHEMA);
  db.exec('BEGIN');
  const insTown = db.prepare(
    'INSERT INTO cities (id, name, osm_id) VALUES (?, ?, ?)'
  );
  townRows.forEach((t, i) => insTown.run(i, t.name, t.osmId));

  const ins = db.prepare(
    'INSERT INTO edges VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  const tagJson = new Map<Record<string, string>, string>();
  const classes = new Map<Record<string, string>, string>();
  let edgeId = 0;
  let missing = 0;
  for (let w = 0; w < hwIds.length; w++) {
    const r = hwRefs[w];
    const idx = r.map((n) => bsearch(ids, n));
    if (idx.some((j) => j < 0 || Number.isNaN(lon[j]))) {
      // way crosses the extract boundary
      missing++;
      continue;
    }
    const tags = hwTags[w];
    let tj = tagJson.get(tags);
    if (tj === undefined) tagJson.set(tags, (tj = JSON.stringify(tags)));
    let cls = classes.get(tags);
    if (cls === undefined) classes.set(tags, (cls = classify(tags)));
    let start = 0;
    let seq = 0;
    for (let i = 1; i < idx.length; i++) {
      if (refCount[idx[i]] <= 1 && i !== idx.length - 1) continue;
      const piece = idx.slice(start, i + 1);
      let len = 0;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const coords: string[] = [];
      for (let p = 0; p < piece.length; p++) {
        const x = lon[piece[p]];
        const y = lat[piece[p]];
        if (p > 0) len += haversine(lon[piece[p - 1]], lat[piece[p - 1]], x, y);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        coords.push(`[${x.toFixed(7)},${y.toFixed(7)}]`);
      }
      // town of the midpoint
      let mx: number;
      let my: number;
      if (piece.length === 2) {
        mx = (lon[piece[0]] + lon[piece[1]]) / 2;
        my = (lat[piece[0]] + lat[piece[1]]) / 2;
      } else {
        const m = piece[piece.length >> 1];
        mx = lon[m];
        my = lat[m];
      }
      let town: number | null = null;
      for (const c of townIndex.search({
        minX: mx,
        minY: my,
        maxX: mx,
        maxY: my,
      })) {
        if (townPolys[c.i].contains(mx, my)) {
          town = c.i;
          break;
        }
      }
      ins.run(
        edgeId++,
        hwIds[w],
        seq++,
        ids[piece[0]],
        ids[piece[piece.length - 1]],
        tags.name ?? null,
        tags.highway,
        town,
        len,
        tj,
        `[${coords.join(',')}]`,
        minX,
        minY,
        maxX,
        maxY,
        cls
      );
      start = i;
    }
  }
  const setMeta = db.prepare('INSERT OR REPLACE INTO meta VALUES (?, ?)');
  setMeta.run('source', pbfPath);
  setMeta.run('imported_at', new Date().toISOString());
  db.exec('COMMIT');
  db.exec(INDEXES);
  db.close();
  renameSync(tmp, dbPath);
  log(
    `wrote ${edgeId} blocks${missing ? ` (skipped ${missing} ways missing nodes)` : ''} to ${dbPath} (${secs()})`
  );
}

const SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE cities (id INTEGER PRIMARY KEY, name TEXT, osm_id INTEGER);
CREATE TABLE edges (
  id INTEGER PRIMARY KEY,
  way_id INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  node_a INTEGER NOT NULL,
  node_b INTEGER NOT NULL,
  name TEXT,
  highway TEXT NOT NULL,
  city_id INTEGER,
  length_m REAL NOT NULL,
  tags TEXT NOT NULL,
  coords TEXT NOT NULL,      -- JSON [[lon, lat], ...]
  min_lon REAL, min_lat REAL, max_lon REAL, max_lat REAL,
  class TEXT NOT NULL
);
`;

const INDEXES = `
CREATE INDEX edges_city ON edges(city_id);
CREATE INDEX edges_name ON edges(name);
CREATE INDEX edges_class ON edges(class);
`;
