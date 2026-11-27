"""Match rides to blocks.

Every block is sampled every SAMPLE_STEP metres. A sample is covered by a ride
if some point of that ride is within RADIUS metres *and* the ride was heading
roughly along the block (within ANGLE_TOL), so riding across a street doesn't
count as riding it. Ride tracks are smoothed to ~10 m chords first so GPS
jitter doesn't produce random headings.

For each block we record the fraction of its samples covered, which rides
covered which fraction, and, per sample, the first ride to cover it. That last
bit gives the exact date a block became "done" and how much new ground each
ride broke.
"""

from __future__ import annotations

import math
import sqlite3
import sys
import time
from dataclasses import dataclass

import numpy as np
from scipy.spatial import cKDTree

from .geo import Projector, densify
from .rides import Ride


@dataclass(frozen=True)
class MatchParams:
    radius_m: float = 15.0
    angle_tol_deg: float = 30.0
    sample_step_m: float = 5.0
    ride_chord_m: float = 10.0
    # a ride "rode" a block if it covered at least this fraction of it
    ride_block_frac: float = 0.5
    # a block is "done" when this fraction of it has been covered by any rides
    done_frac: float = 0.8


def _log(msg: str, end="\n") -> None:
    print(msg, file=sys.stderr, end=end, flush=True)


def _ride_points(rides: list[Ride], proj: Projector, bounds, p: MatchParams):
    w, s, e, n = bounds
    pts, bear, idx = [], [], []
    for ri, r in enumerate(rides):
        for t in r.tracks:
            inside = (t[:, 0] >= w) & (t[:, 0] <= e) & (t[:, 1] >= s) & (t[:, 1] <= n)
            if not inside.any():
                continue
            x, y = proj.fwd(t[:, 0], t[:, 1])
            xy = np.column_stack([x, y])
            # decimate along-track to ~ride_chord_m so headings are stable
            seg = np.hypot(*np.diff(xy, axis=0).T)
            cd = np.concatenate([[0], np.cumsum(seg)])
            bucket = np.floor(cd / p.ride_chord_m)
            keep = np.concatenate([[True], np.diff(bucket) > 0])
            keep[-1] = True
            xy = xy[keep]
            if len(xy) < 2:
                continue
            q, b = densify(xy, p.sample_step_m)
            pts.append(q)
            bear.append(b)
            idx.append(np.full(len(q), ri, dtype=np.int32))
    if not pts:
        return np.empty((0, 2)), np.empty(0), np.empty(0, dtype=np.int32)
    return np.concatenate(pts), np.concatenate(bear), np.concatenate(idx)


def _densify_many(xy: np.ndarray, offsets: np.ndarray, step: float):
    """Like geo.densify, for many polylines packed into one array."""
    seg = np.diff(xy, axis=0)
    seg_edge = np.repeat(np.arange(len(offsets) - 1), np.diff(offsets))[:-1]
    valid = np.ones(len(seg), dtype=bool)
    valid[offsets[1:-1] - 1] = False  # joins between consecutive polylines
    seg_len = np.hypot(seg[:, 0], seg[:, 1])
    valid &= seg_len > 0
    seg, seg_len, starts, seg_edge = seg[valid], seg_len[valid], xy[:-1][valid], seg_edge[valid]
    n = np.maximum(1, np.round(seg_len / step).astype(np.int64))
    si = np.repeat(np.arange(len(seg)), n)
    offs = np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n)
    frac = (offs + 0.5) / np.repeat(n, n)
    pts = starts[si] + seg[si] * frac[:, None]
    bearing = np.mod(np.arctan2(seg[:, 1], seg[:, 0]), math.pi)[si]
    return pts, bearing, seg_edge[si]


SCHEMA = """
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
  n_rides INTEGER NOT NULL,      -- rides that rode >= ride_block_frac of it
  first_ride INTEGER,            -- first such ride
  last_ride INTEGER,             -- most recent such ride
  done_ride INTEGER              -- ride after which frac first reached done_frac
);
CREATE TABLE ride_edges (
  ride_idx INTEGER NOT NULL,
  edge_id INTEGER NOT NULL,
  covered INTEGER NOT NULL,      -- samples of the block this ride covered
  new INTEGER NOT NULL,          -- ...that no earlier ride had
  PRIMARY KEY (ride_idx, edge_id)
) WITHOUT ROWID;
"""


def match(con: sqlite3.Connection, rides: list[Ride], p: MatchParams) -> None:
    t0 = time.time()
    proj = Projector.from_string(con.execute("SELECT value FROM meta WHERE key='crs'").fetchone()[0])
    bounds = con.execute(
        "SELECT min(min_lon), min(min_lat), max(max_lon), max(max_lat) FROM edges"
    ).fetchone()

    rp, rb, ridx = _ride_points(rides, proj, bounds, p)
    used = np.unique(ridx)
    _log(f"  {len(rp):,} ride points from {len(used)} rides in region ({time.time() - t0:.0f}s)")
    if len(rp) == 0:
        raise SystemExit("no rides inside this region")

    tree = cKDTree(rp)
    lo, la = proj.inv(rp[:, 0], rp[:, 1])
    pad = 0.002
    rbounds = (lo.min() - pad, la.min() - pad, lo.max() + pad, la.max() + pad)

    con.executescript(SCHEMA)
    con.execute("INSERT OR REPLACE INTO meta VALUES ('match_params', ?)", (repr(p),))
    con.executemany(
        "INSERT INTO rides (idx, id, name, sport, start_date, distance_m, moving_time_s, start_lon, start_lat)"
        " VALUES (?,?,?,?,?,?,?,?,?)",
        [
            (i, r.id, r.name, r.sport, r.start_date, r.distance_m, r.moving_time_s, *map(float, r.tracks[0][0]))
            for i, r in enumerate(rides)
        ],
    )

    edges = con.execute(
        "SELECT id, coords FROM edges WHERE max_lon >= ? AND min_lon <= ? AND max_lat >= ? AND min_lat <= ?",
        (rbounds[0], rbounds[2], rbounds[1], rbounds[3]),
    ).fetchall()
    _log(f"  {len(edges):,} blocks within the rides' bounding box")

    import json

    tol = math.radians(p.angle_tol_deg)
    nr = len(rides)
    chunk = 50_000
    for c0 in range(0, len(edges), chunk):
        part = edges[c0 : c0 + chunk]
        ids = np.array([e[0] for e in part], dtype=np.int64)
        coords = [json.loads(e[1]) for e in part]
        counts = np.array([len(c) for c in coords])
        offsets = np.concatenate([[0], np.cumsum(counts)])
        flat = np.array([pt for c in coords for pt in c])
        x, y = proj.fwd(flat[:, 0], flat[:, 1])
        sp, sb, se = _densify_many(np.column_stack([x, y]), offsets, p.sample_step_m)
        n_samples = np.bincount(se, minlength=len(part))

        d, _ = tree.query(sp, distance_upper_bound=p.radius_m, workers=-1)
        near = np.flatnonzero(np.isfinite(d))
        first = np.full(len(sp), np.iinfo(np.int32).max, dtype=np.int64)
        pair_edge = pair_ride = pair_cnt = np.empty(0, dtype=np.int64)
        if len(near):
            nb = tree.query_ball_point(sp[near], p.radius_m, workers=-1)
            lens = np.fromiter((len(v) for v in nb), dtype=np.int64, count=len(nb))
            flat_nb = np.fromiter((j for v in nb for j in v), dtype=np.int64, count=int(lens.sum()))
            s_rep = np.repeat(near, lens)
            ang = np.abs(sb[s_rep] - rb[flat_nb])
            ang = np.minimum(ang, math.pi - ang)
            ok = ang <= tol
            s_ok, r_ok = s_rep[ok], ridx[flat_nb[ok]].astype(np.int64)
            # unique (sample, ride)
            key = np.unique(s_ok * nr + r_ok)
            s_u, r_u = key // nr, key % nr
            np.minimum.at(first, s_u, r_u)
            # (edge, ride) -> covered samples
            ek, cnt = np.unique(se[s_u] * nr + r_u, return_counts=True)
            pair_edge, pair_ride, pair_cnt = ek // nr, ek % nr, cnt

        covered_mask = first < np.iinfo(np.int32).max
        covered = np.bincount(se[covered_mask], minlength=len(part))
        # first-coverage per (edge, ride): new samples
        nk, ncnt = np.unique(se[covered_mask] * nr + first[covered_mask], return_counts=True)
        new_map = dict(zip(nk.tolist(), ncnt.tolist()))

        # done_ride: ride index at which covered fraction reached done_frac
        done_ride = np.full(len(part), -1, dtype=np.int64)
        order = np.lexsort((first, se))
        se_o, first_o = se[order], first[order]
        start = np.concatenate([[0], np.cumsum(n_samples)[:-1]])
        need = np.ceil(n_samples * p.done_frac).astype(np.int64)
        reachable = (covered >= need) & (n_samples > 0)
        pos = start[reachable] + np.maximum(need[reachable] - 1, 0)
        done_ride[reachable] = first_o[pos]
        assert (se_o[pos] == np.flatnonzero(reachable)).all()

        # per-edge ride stats
        rode = pair_cnt >= np.ceil(n_samples[pair_edge] * p.ride_block_frac)
        n_rides = np.bincount(pair_edge[rode], minlength=len(part))
        first_ride = np.full(len(part), -1)
        last_ride = np.full(len(part), -1)
        if rode.any():
            first_ride[:] = nr
            np.minimum.at(first_ride, pair_edge[rode], pair_ride[rode])
            first_ride[first_ride == nr] = -1
            np.maximum.at(last_ride, pair_edge[rode], pair_ride[rode])

        rows = []
        for i in np.flatnonzero(covered > 0):
            nri = lambda v: None if v < 0 else int(v)
            rows.append(
                (
                    int(ids[i]),
                    int(n_samples[i]),
                    int(covered[i]),
                    float(covered[i] / n_samples[i]),
                    int(n_rides[i]),
                    nri(first_ride[i]),
                    nri(last_ride[i]),
                    nri(done_ride[i]),
                )
            )
        con.executemany("INSERT INTO coverage VALUES (?,?,?,?,?,?,?,?)", rows)
        con.executemany(
            "INSERT INTO ride_edges VALUES (?,?,?,?)",
            (
                (
                    int(r),
                    int(ids[e]),
                    int(c),
                    new_map.get(int(e) * nr + int(r), 0),
                )
                for e, r, c in zip(pair_edge, pair_ride, pair_cnt)
            ),
        )
        _log(
            f"\r  matched {min(c0 + chunk, len(edges)):,}/{len(edges):,} blocks ({time.time() - t0:.0f}s)",
            end="",
        )
    _log("")

    con.execute("CREATE INDEX ride_edges_edge ON ride_edges(edge_id)")
    con.commit()
    _log(f"  done ({time.time() - t0:.0f}s)")
