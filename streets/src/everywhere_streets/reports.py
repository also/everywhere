"""Queries over the matched database. Everything here is read-only."""

from __future__ import annotations

import json
import math
import sqlite3
from collections import Counter, defaultdict
from dataclasses import dataclass

import numpy as np

from .coverage import MatchParams


@dataclass
class Opts:
    classes: tuple[str, ...] = ("street",)
    done_frac: float = MatchParams.done_frac
    # drop dead-end blocks shorter than this (metres); 0 keeps everything
    skip_stubs_m: float = 0


def blocks_table(con: sqlite3.Connection, o: Opts) -> None:
    """TEMP table `b`: the blocks that count, joined with coverage."""
    q = ",".join("?" * len(o.classes))
    con.execute("DROP TABLE IF EXISTS temp.b")
    con.execute(
        f"""
        CREATE TEMP TABLE b AS
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
        WHERE e.class IN ({q})
        """,
        (o.done_frac, *o.classes),
    )
    if o.skip_stubs_m > 0:
        # a stub is a dead end: one of its nodes touches no other counted block
        con.execute("DROP TABLE IF EXISTS temp.deg")
        con.execute(
            """CREATE TEMP TABLE deg AS SELECT n, count(*) deg
               FROM (SELECT node_a n FROM b UNION ALL SELECT node_b FROM b) GROUP BY n"""
        )
        con.execute("CREATE UNIQUE INDEX temp.deg_n ON deg(n)")
        con.execute(
            """DELETE FROM b WHERE length_m < ?
               AND ((SELECT deg FROM deg WHERE n = b.node_a) = 1 OR (SELECT deg FROM deg WHERE n = b.node_b) = 1)""",
            (o.skip_stubs_m,),
        )
    con.execute("CREATE INDEX temp.b_town ON b(town)")


def table(rows, headers, align=None) -> None:
    rows = [["" if v is None else str(v) for v in r] for r in rows]
    w = [max([len(h)] + [len(r[i]) for r in rows]) for i, h in enumerate(headers)]
    align = align or ["<"] + [">"] * (len(headers) - 1)
    fmt = "  ".join(f"{{:{a}{n}}}" for a, n in zip(align, w))
    print(fmt.format(*headers))
    print("  ".join("-" * n for n in w))
    for r in rows:
        print(fmt.format(*r))


def km(m) -> str:
    return f"{(m or 0) / 1000:.1f}"


def pct(x) -> str:
    return f"{100 * (x or 0):.0f}%"


def ride_dates(con) -> list[str]:
    return [r[0][:10] for r in con.execute("SELECT start_date FROM rides ORDER BY idx")]


# --- stats ---------------------------------------------------------------


def stats(con, o: Opts, limit: int) -> None:
    blocks_table(con, o)
    tot = con.execute(
        "SELECT sum(length_m), sum(done * length_m), sum(frac * length_m), count(DISTINCT town) FILTER (WHERE done) FROM b"
    ).fetchone()
    nr = con.execute("SELECT count(*), (SELECT count(DISTINCT ride_idx) FROM ride_edges) FROM rides").fetchone()
    print(
        f"{km(tot[1])} km of {'/'.join(o.classes)} blocks done across {tot[3]} towns "
        f"(from {nr[1]} rides with a match, of {nr[0]})\n"
    )
    rows = con.execute(
        """
        WITH s AS (
          SELECT town, street, sum(length_m) len, sum(done * length_m) done_len
          FROM b WHERE NOT unnamed GROUP BY town, street
        )
        SELECT t.town, t.len, t.done_len, t.done_len / t.len,
               (SELECT count(*) FROM s WHERE s.town = t.town),
               (SELECT count(*) FROM s WHERE s.town = t.town AND s.done_len >= 0.9 * s.len),
               (SELECT count(*) FROM s WHERE s.town = t.town AND s.done_len > 0)
        FROM (SELECT town, sum(length_m) len, sum(done * length_m) done_len FROM b GROUP BY town) t
        WHERE t.done_len > 0
        ORDER BY t.done_len DESC LIMIT ?
        """,
        (limit,),
    ).fetchall()
    table(
        [(r[0], km(r[2]), km(r[1]), pct(r[3]), f"{r[5]}/{r[4]}", r[6]) for r in rows],
        ["town", "done km", "of km", "done", "streets done", "streets touched"],
    )


# --- town ----------------------------------------------------------------


def town(con, o: Opts, name: str, todo: bool, sort: str) -> None:
    blocks_table(con, o)
    real = con.execute("SELECT town FROM b WHERE town LIKE ? LIMIT 1", (name,)).fetchone()
    if not real:
        raise SystemExit(f"no town matching {name!r}")
    dates = ride_dates(con)
    rows = con.execute(
        """
        SELECT street, sum(length_m), sum(done * length_m), max(last_ride), min(first_ride), max(n_rides)
        FROM b WHERE town = ? GROUP BY street
        """,
        (real[0],),
    ).fetchall()
    out = []
    for street, length, done_len, last, first, nrides in rows:
        f = done_len / length if length else 0
        if todo and f >= 0.9:
            continue
        out.append((street, length, done_len, f, first, last, nrides))
    key = {
        "pct": lambda r: (r[3], -r[1]),
        "length": lambda r: -r[1],
        "todo": lambda r: -(r[1] - r[2]),
        "name": lambda r: r[0],
        "last": lambda r: (r[5] if r[5] is not None else -1),
    }[sort]
    out.sort(key=key)
    tot_len = sum(r[1] for r in rows)
    tot_done = sum(r[2] for r in rows)
    print(f"{real[0]}: {km(tot_done)} of {km(tot_len)} km done ({pct(tot_done / tot_len)})\n")
    table(
        [
            (
                r[0],
                f"{r[1]:.0f}",
                f"{r[1] - r[2]:.0f}",
                pct(r[3]),
                dates[r[4]] if r[4] is not None else "",
                dates[r[5]] if r[5] is not None else "",
                r[6] or "",
            )
            for r in out
        ],
        ["street", "len m", "todo m", "done", "first", "last", "max rides"],
    )


# --- where am I? ---------------------------------------------------------


def home(con) -> tuple[float, float]:
    """The most common ride start, to ~300 m."""
    starts = con.execute("SELECT start_lon, start_lat FROM rides WHERE start_lon IS NOT NULL").fetchall()
    cells = Counter((round(lo / 0.003), round(la / 0.003)) for lo, la in starts)
    (cx, cy), _ = cells.most_common(1)[0]
    pts = [(lo, la) for lo, la in starts if (round(lo / 0.003), round(la / 0.003)) == (cx, cy)]
    return float(np.median([p[0] for p in pts])), float(np.median([p[1] for p in pts]))


def parse_at(con, at: str | None) -> tuple[float, float]:
    if not at:
        return home(con)
    lat, lon = (float(v) for v in at.split(","))
    return lon, lat


def _dist_bearing(lon0, lat0, lon, lat):
    lon, lat = np.asarray(lon), np.asarray(lat)
    dx = (lon - lon0) * 111_320 * math.cos(math.radians(lat0))
    dy = (lat - lat0) * 110_540
    d = np.hypot(dx, dy)
    brg = (np.degrees(np.arctan2(dx, dy)) + 360) % 360
    return d, brg


def compass(deg: float) -> str:
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][int((deg + 22.5) // 45) % 8]


def _todo_blocks(con, lon, lat, radius_km):
    dlat = radius_km / 110.5
    dlon = radius_km / (111.3 * math.cos(math.radians(lat)))
    return con.execute(
        """
        SELECT id, street, town, length_m, frac, node_a, node_b, lon, lat, unnamed
        FROM b WHERE NOT done AND lon BETWEEN ? AND ? AND lat BETWEEN ? AND ?
        """,
        (lon - dlon, lon + dlon, lat - dlat, lat + dlat),
    ).fetchall()


def nearby(con, o: Opts, at, radius_km: float, limit: int, include_unnamed: bool, min_m: float = 25) -> None:
    blocks_table(con, o)
    lon, lat = parse_at(con, at)
    rows = _todo_blocks(con, lon, lat, radius_km)
    d, brg = _dist_bearing(lon, lat, [r[7] for r in rows], [r[8] for r in rows])
    by_street: dict[tuple, list] = defaultdict(lambda: [math.inf, 0.0, 0.0, 0])
    for r, di, bi in zip(rows, d, brg):
        if di > radius_km * 1000 or (r[9] and not include_unnamed):
            continue
        s = by_street[(r[1], r[2])]
        if di < s[0]:
            s[0], s[2] = di, bi
        s[1] += r[3] * (1 - r[4])
        s[3] += 1
    # how much of each of those streets is done already
    done_frac = {
        (s, t): dl / ln
        for s, t, ln, dl in con.execute(
            "SELECT street, town, sum(length_m), sum(done * length_m) FROM b GROUP BY street, town"
        )
        if (s, t) in by_street
    }
    out = sorted(((k, v) for k, v in by_street.items() if v[1] >= min_m), key=lambda kv: kv[1][0])[:limit]
    print(f"unridden streets within {radius_km} km of {lat:.4f},{lon:.4f}\n")
    table(
        [
            (s, t, f"{v[0] / 1000:.2f} km {compass(v[2])}", f"{v[1]:.0f}", v[3], pct(done_frac.get((s, t))))
            for (s, t), v in out
        ],
        ["street", "town", "nearest", "todo m", "blocks", "street done"],
    )


def pockets(con, o: Opts, at, radius_km: float, limit: int, min_m: float, cell_m: float = 400) -> None:
    """Connected clusters of unridden blocks: a neighbourhood you could knock out in one go."""
    blocks_table(con, o)
    lon, lat = parse_at(con, at)
    rows = _todo_blocks(con, lon, lat, radius_km)
    # union-find over shared nodes
    parent: dict = {}

    def find(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    # Only join blocks within the same ~cell_m square, otherwise a whole
    # unridden suburb becomes one cluster.
    cell = lambda r: (int(r[7] * 111_320 * math.cos(math.radians(lat)) // cell_m), int(r[8] * 110_540 // cell_m))
    for r in rows:
        c = cell(r)
        parent[find((c, r[5]))] = find((c, r[6]))
    groups: dict = defaultdict(list)
    for r in rows:
        groups[find((cell(r), r[5]))].append(r)
    out = []
    for g in groups.values():
        todo = sum(r[3] * (1 - r[4]) for r in g)
        if todo < min_m:
            continue
        clon = sum(r[7] * r[3] for r in g) / sum(r[3] for r in g)
        clat = sum(r[8] * r[3] for r in g) / sum(r[3] for r in g)
        d, b = _dist_bearing(lon, lat, clon, clat)
        if d > radius_km * 1000:
            continue
        names = Counter()
        for r in g:
            if not r[9]:
                names[r[1]] += r[3]
        towns = Counter(r[2] for r in g)
        out.append((float(d), float(b), todo, len(g), names, towns.most_common(1)[0][0], clat, clon))
    # rank by "bang for the buck": unridden metres per km travelled to get there
    out.sort(key=lambda p: -p[2] / (1000 + p[0]))
    print(f"clusters of unridden blocks within {radius_km} km of {lat:.4f},{lon:.4f}, best first\n")
    table(
        [
            (
                ", ".join(n for n, _ in p[4].most_common(3)) or "(unnamed)",
                p[5],
                f"{p[0] / 1000:.1f} km {compass(p[1])}",
                f"{p[2]:.0f}",
                p[3],
                f"https://www.openstreetmap.org/#map=17/{p[6]:.5f}/{p[7]:.5f}",
            )
            for p in out[:limit]
        ],
        ["streets", "town", "distance", "todo m", "blocks", "map"],
    )


def almost(con, o: Opts, limit: int, town_name: str | None) -> None:
    """Named streets that are mostly done: the cheapest completions."""
    blocks_table(con, o)
    where = "AND town LIKE ?" if town_name else ""
    rows = con.execute(
        f"""
        SELECT street, town, sum(length_m) len, sum(done * length_m) dl
        FROM b WHERE NOT unnamed {where} GROUP BY street, town
        HAVING dl >= 0.5 * len AND dl < 0.9 * len
        ORDER BY len - dl LIMIT ?
        """,
        ((town_name,) if town_name else ()) + (limit,),
    ).fetchall()
    table(
        [(r[0], r[1], f"{r[2] - r[3]:.0f}", f"{r[2]:.0f}", pct(r[3] / r[2])) for r in rows],
        ["street", "town", "todo m", "len m", "done"],
    )


# --- rides ---------------------------------------------------------------


def rides(con, o: Opts, sort: str, limit: int, year: str | None) -> None:
    blocks_table(con, o)
    order = {"new": "new_m DESC", "date": "idx DESC", "blocks": "blocks DESC"}[sort]
    where = "WHERE substr(r.start_date, 1, 4) = ?" if year else ""
    rows = con.execute(
        f"""
        WITH per AS (
          SELECT re.ride_idx,
                 sum(b.length_m * re.new / c.n_samples) new_m,
                 sum(re.covered >= ? * c.n_samples) blocks,
                 sum(b.done_ride = re.ride_idx) finished
          FROM ride_edges re JOIN coverage c USING (edge_id) JOIN b ON b.id = re.edge_id
          GROUP BY re.ride_idx
        )
        SELECT r.id, r.start_date, r.name, r.distance_m, coalesce(per.new_m, 0) new_m,
               coalesce(per.blocks, 0) blocks, coalesce(per.finished, 0), r.idx
        FROM rides r LEFT JOIN per ON per.ride_idx = r.idx {where}
        ORDER BY {order} LIMIT ?
        """,
        (MatchParams.ride_block_frac,) + ((year,) if year else ()) + (limit,),
    ).fetchall()
    table(
        [(r[0], r[1][:10], r[2][:40], km(r[3]), km(r[4]), r[5], r[6]) for r in rows],
        ["id", "date", "name", "km", "new km", "blocks", "finished"],
        ["<", "<", "<", ">", ">", ">", ">"],
    )


def ride(con, o: Opts, ride_id: int) -> None:
    blocks_table(con, o)
    r = con.execute("SELECT idx, name, start_date, distance_m FROM rides WHERE id = ?", (ride_id,)).fetchone()
    if not r:
        raise SystemExit(f"ride {ride_id} not found (or not a matched ride)")
    idx = r[0]
    rows = con.execute(
        """
        SELECT b.street, b.town, sum(b.length_m * re.covered / c.n_samples), sum(b.length_m * re.new / c.n_samples),
               sum(b.done_ride = ?) > 0
        FROM ride_edges re JOIN coverage c USING (edge_id) JOIN b ON b.id = re.edge_id
        WHERE re.ride_idx = ? AND re.covered >= ? * c.n_samples
        GROUP BY b.street, b.town ORDER BY b.town, b.street
        """,
        (idx, idx, MatchParams.ride_block_frac),
    ).fetchall()
    print(f"{r[1]} — {r[2][:16]} — {km(r[3])} km ridden, {km(sum(x[3] for x in rows))} km new\n")
    table(
        [(s, t, f"{m:.0f}", f"{n:.0f}" if n >= 1 else "", "✓" if completed else "") for s, t, m, n, completed in rows],
        ["street", "town", "rode m", "new m", "finished a block"],
    )


def street(con, o: Opts, name: str, town_name: str | None) -> None:
    blocks_table(con, o)
    dates = ride_dates(con)
    where, args = "street LIKE ?", [name]
    if town_name:
        where += " AND town LIKE ?"
        args.append(town_name)
    rows = con.execute(
        f"""SELECT town, street, id, length_m, frac, n_rides, first_ride, last_ride, done_ride
            FROM b WHERE {where} ORDER BY town, street, way_id, id""",
        args,
    ).fetchall()
    if not rows:
        raise SystemExit("no such street")
    d = lambda i: dates[i] if i is not None else ""
    table(
        [(r[0], r[1], r[2], f"{r[3]:.0f}", pct(r[4]), r[5], d(r[6]), d(r[8]), d(r[7])) for r in rows],
        ["town", "street", "block", "len m", "covered", "rides", "first", "done", "last"],
    )


def timeline(con, o: Opts, town_name: str | None) -> None:
    blocks_table(con, o)
    where = "AND b.town LIKE ?" if town_name else ""
    rows = con.execute(
        f"""
        SELECT substr(r.start_date, 1, 4) yr, sum(b.length_m), count(DISTINCT b.town)
        FROM b JOIN rides r ON r.idx = b.done_ride WHERE b.done {where}
        GROUP BY yr ORDER BY yr
        """,
        (town_name,) if town_name else (),
    ).fetchall()
    per_year = {
        y: (n, d)
        for y, n, d in con.execute(
            "SELECT substr(start_date, 1, 4), count(*), sum(distance_m) FROM rides GROUP BY 1"
        )
    }
    total = 0.0
    out = []
    for yr, m, towns in rows:
        total += m
        n, dist = per_year.get(yr, (0, 0))
        out.append((yr, n, km(dist), km(m), km(total), towns))
    table(out, ["year", "rides", "ridden km", "new km", "total km", "towns"])


def favorites(con, o: Opts, limit: int) -> None:
    """Streets you ride over and over, by average rides per block."""
    blocks_table(con, o)
    rows = con.execute(
        """
        SELECT street, town, sum(n_rides * length_m) / sum(length_m) avg_rides, sum(length_m) len, max(n_rides)
        FROM b WHERE NOT unnamed GROUP BY street, town HAVING len > 200
        ORDER BY avg_rides DESC LIMIT ?
        """,
        (limit,),
    ).fetchall()
    table(
        [(r[0], r[1], f"{r[2]:.0f}", f"{r[3]:.0f}", r[4]) for r in rows],
        ["street", "town", "avg rides", "len m", "max rides"],
    )


def stale(con, o: Opts, before: str, limit: int, town_name: str | None) -> None:
    """Done streets you haven't been back to since `before`."""
    blocks_table(con, o)
    where = "AND town LIKE ?" if town_name else ""
    rows = con.execute(
        f"""
        SELECT b.street, b.town, sum(b.length_m), max(r.start_date) last
        FROM b JOIN rides r ON r.idx = b.last_ride
        WHERE b.done AND NOT b.unnamed {where}
        GROUP BY b.street, b.town HAVING last < ? AND sum(b.length_m) > 150
        ORDER BY sum(b.length_m) DESC LIMIT ?
        """,
        ((town_name,) if town_name else ()) + (before, limit),
    ).fetchall()
    table([(r[0], r[1], f"{r[2]:.0f}", r[3][:10]) for r in rows], ["street", "town", "len m", "last ridden"])


# --- export --------------------------------------------------------------


def export_geojson(con, o: Opts, towns: list[str] | None, min_done_pct: float) -> dict:
    blocks_table(con, o)
    dates = ride_dates(con)
    if towns:
        town_set = {t for (t,) in con.execute("SELECT DISTINCT town FROM b") for pat in towns if t.lower() == pat.lower()}
    else:
        town_set = {
            t
            for t, ln, dl in con.execute("SELECT town, sum(length_m), sum(done * length_m) FROM b GROUP BY town")
            if dl / ln * 100 >= min_done_pct
        }
    q = ",".join("?" * len(town_set))
    rows = con.execute(
        f"""SELECT b.id, b.street, b.town, b.highway, b.length_m, b.frac, b.done, b.n_rides,
                   b.first_ride, b.last_ride, b.done_ride, e.coords
            FROM b JOIN edges e ON e.id = b.id WHERE b.town IN ({q})""",
        tuple(town_set),
    ).fetchall()
    feats = []
    for r in rows:
        coords = [[round(c[0], 6), round(c[1], 6)] for c in json.loads(r[11])]
        feats.append(
            {
                "type": "Feature",
                "id": r[0],
                "geometry": {"type": "LineString", "coordinates": coords},
                "properties": {
                    "street": r[1],
                    "town": r[2],
                    "highway": r[3],
                    "length_m": round(r[4]),
                    "covered": round(r[5], 2),
                    "done": bool(r[6]),
                    "rides": r[7],
                    "first": dates[r[8]] if r[8] is not None else None,
                    "last": dates[r[9]] if r[9] is not None else None,
                    "done_date": dates[r[10]] if r[10] is not None else None,
                },
            }
        )
    return {"type": "FeatureCollection", "features": feats, "towns": sorted(town_set)}
