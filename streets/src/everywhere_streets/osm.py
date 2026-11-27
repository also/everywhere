"""Import a street network from an OSM extract.

Ways tagged highway=* are split at every node shared with another kept way,
producing "blocks": the stretch of a street between two intersections. Each
block is assigned the town (admin_level=8 boundary) containing its midpoint.

We keep more than we consider interesting (service roads, paths) so the
definition of "interesting" can change without re-importing; see
interesting.py.
"""

from __future__ import annotations

import json
import sqlite3
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np
import osmium
import shapely
from shapely import wkb

from .geo import Projector, haversine_m

# never stored: not rideable, or not a "street" in any sense
DROP_HIGHWAY = {
    "motorway",
    "motorway_link",
    "proposed",
    "construction",
    "abandoned",
    "disused",
    "razed",
    "platform",
    "raceway",
    "bus_stop",
    "elevator",
    "steps",
    "corridor",
    "via_ferrata",
    "rest_area",
    "services",
    "escape",
    "emergency_bay",
    "bus_guideway",
    "busway",
}

# tags copied into the database, used for classification and display
KEEP_TAGS = [
    "highway",
    "name",
    "ref",
    "service",
    "access",
    "bicycle",
    "motor_vehicle",
    "foot",
    "footway",
    "oneway",
    "surface",
    "area",
    "motorroad",
    "tunnel",
    "bridge",
    "cycleway",
    "cycleway:both",
    "cycleway:left",
    "cycleway:right",
    "segregated",
    "noname",
]


def keep_way(tags) -> bool:
    hw = tags.get("highway")
    if hw is None or hw in DROP_HIGHWAY:
        return False
    if tags.get("area") == "yes":
        return False
    # sidewalks and crosswalks duplicate the street they're next to
    if hw == "footway" and tags.get("footway") in ("sidewalk", "crossing"):
        return False
    if hw in ("path", "cycleway") and tags.get("footway") in ("sidewalk", "crossing"):
        return False
    return True


def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY,
  name TEXT,
  osm_id INTEGER,
  wkb BLOB
);
CREATE TABLE IF NOT EXISTS edges (
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
  min_lon REAL, min_lat REAL, max_lon REAL, max_lat REAL
);
CREATE INDEX IF NOT EXISTS edges_city ON edges(city_id);
CREATE INDEX IF NOT EXISTS edges_name ON edges(name);
CREATE INDEX IF NOT EXISTS edges_nodes_a ON edges(node_a);
CREATE INDEX IF NOT EXISTS edges_nodes_b ON edges(node_b);
"""


def import_osm(pbf: Path, db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = db_path.with_suffix(".importing")
    tmp.unlink(missing_ok=True)
    con = sqlite3.connect(tmp)
    con.execute("PRAGMA journal_mode=OFF")
    con.execute("PRAGMA synchronous=OFF")
    con.executescript(SCHEMA)

    t0 = time.time()
    _log("pass 1: counting node references")
    refs: Counter[int] = Counter()
    n_ways = 0
    for w in osmium.FileProcessor(str(pbf), osmium.osm.WAY):
        if not keep_way(w.tags):
            continue
        n_ways += 1
        nodes = [n.ref for n in w.nodes]
        refs.update(nodes)
        # endpoints always split, even if not shared
        refs[nodes[0]] += 1
        refs[nodes[-1]] += 1
    _log(f"  {n_ways} ways, {len(refs)} nodes ({time.time() - t0:.0f}s)")

    _log("pass 2: geometry and town boundaries")
    wkbf = osmium.geom.WKBFactory()
    cities: list[tuple[str, int, bytes]] = []
    raw_edges: list[tuple] = []
    projector: Projector | None = None

    fp = osmium.FileProcessor(str(pbf)).with_areas(
        osmium.filter.KeyFilter("boundary")
    )
    for obj in fp:
        if obj.is_area():
            t = obj.tags
            if (
                t.get("boundary") == "administrative"
                and t.get("admin_level") == "8"
            ):
                try:
                    cities.append(
                        (t.get("name"), obj.orig_id(), bytes.fromhex(wkbf.create_multipolygon(obj)))
                    )
                except RuntimeError:
                    pass
            continue
        if not obj.is_way() or not keep_way(obj.tags):
            continue
        tags = {k: obj.tags[k] for k in KEEP_TAGS if k in obj.tags}
        pts: list[tuple[int, float, float]] = []
        for n in obj.nodes:
            if not n.location.valid():
                continue
            pts.append((n.ref, n.lon, n.lat))
        if len(pts) < 2:
            continue
        # split at shared nodes
        start = 0
        seq = 0
        for i in range(1, len(pts)):
            if refs[pts[i][0]] > 1 or i == len(pts) - 1:
                piece = pts[start : i + 1]
                raw_edges.append((obj.id, seq, piece, tags))
                seq += 1
                start = i
    _log(f"  {len(raw_edges)} blocks, {len(cities)} towns ({time.time() - t0:.0f}s)")

    # flatten all block vertices so lengths/bounds/midpoints are vectorized
    counts = np.fromiter((len(e[2]) for e in raw_edges), dtype=np.int64, count=len(raw_edges))
    offsets = np.concatenate([[0], np.cumsum(counts)])
    flat = np.array([(p[1], p[2]) for e in raw_edges for p in e[2]], dtype=np.float64)
    lon, lat = flat[:, 0], flat[:, 1]
    seg_len = haversine_m(lon[:-1], lat[:-1], lon[1:], lat[1:])
    # zero out the "segments" that join the last vertex of one block to the next block
    seg_len[offsets[1:-1] - 1] = 0
    lengths = np.add.reduceat(np.append(seg_len, 0), offsets[:-1])
    min_lon = np.minimum.reduceat(lon, offsets[:-1])
    max_lon = np.maximum.reduceat(lon, offsets[:-1])
    min_lat = np.minimum.reduceat(lat, offsets[:-1])
    max_lat = np.maximum.reduceat(lat, offsets[:-1])
    mid_i = offsets[:-1] + counts // 2
    two = counts == 2
    mid_lon = np.where(two, (lon[offsets[:-1]] + lon[offsets[:-1] + 1]) / 2, lon[mid_i])
    mid_lat = np.where(two, (lat[offsets[:-1]] + lat[offsets[:-1] + 1]) / 2, lat[mid_i])

    projector = Projector.for_bounds(lon.min(), lat.min(), lon.max(), lat.max())
    con.execute("INSERT OR REPLACE INTO meta VALUES ('crs', ?)", (projector.crs.to_string(),))

    # town lookup by block midpoint
    con.executemany(
        "INSERT INTO cities (id, name, osm_id, wkb) VALUES (?, ?, ?, ?)",
        [(i, c[0], c[1], c[2]) for i, c in enumerate(cities)],
    )
    tree = shapely.STRtree([wkb.loads(c[2]) for c in cities])
    idx_in, idx_city = tree.query(shapely.points(mid_lon, mid_lat), predicate="within")
    city_of = np.full(len(raw_edges), -1, dtype=np.int64)
    city_of[idx_in] = idx_city
    _log(f"  computed lengths and towns ({time.time() - t0:.0f}s)")

    tag_json: dict[int, str] = {}

    def rows():
        for i, (way_id, seq, piece, tags) in enumerate(raw_edges):
            tj = tag_json.get(id(tags))
            if tj is None:
                tj = tag_json[id(tags)] = json.dumps(tags, separators=(",", ":"))
            c = int(city_of[i])
            yield (
                i,
                way_id,
                seq,
                piece[0][0],
                piece[-1][0],
                tags.get("name"),
                tags["highway"],
                c if c >= 0 else None,
                float(lengths[i]),
                tj,
                "[" + ",".join(f"[{p[1]:.7f},{p[2]:.7f}]" for p in piece) + "]",
                float(min_lon[i]),
                float(min_lat[i]),
                float(max_lon[i]),
                float(max_lat[i]),
            )

    con.executemany("INSERT INTO edges VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows())
    con.execute(
        "INSERT OR REPLACE INTO meta VALUES ('source', ?)", (str(pbf),)
    )
    con.execute(
        "INSERT OR REPLACE INTO meta VALUES ('imported_at', ?)",
        (time.strftime("%Y-%m-%dT%H:%M:%S"),),
    )
    con.commit()
    con.close()
    tmp.replace(db_path)
    _log(f"wrote {db_path} ({time.time() - t0:.0f}s)")
