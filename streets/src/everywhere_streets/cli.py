from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import urllib.request

from .config import REGIONS, Paths, data_dir


def _connect(paths: Paths) -> sqlite3.Connection:
    if not paths.db.exists():
        raise SystemExit(f"{paths.db} doesn't exist; run `update` first")
    return sqlite3.connect(paths.db)


def main(argv=None) -> None:
    p = argparse.ArgumentParser(prog="streets", description="Which streets have I ridden?")
    p.add_argument("--data-dir", help="defaults to dataDir from config/config.json")
    p.add_argument("--region", default="massachusetts", choices=sorted(REGIONS))
    sub = p.add_subparsers(dest="cmd", required=True, metavar="command")

    def cmd(name, help, counts=True):
        sp = sub.add_parser(name, help=help, description=help)
        if counts:
            sp.add_argument("--with-paths", action="store_true", help="count bike paths too")
            sp.add_argument("--done", type=float, default=0.8, help="fraction of a block that makes it done")
            sp.add_argument(
                "--skip-stubs",
                type=float,
                default=0,
                metavar="M",
                help="ignore dead-end blocks shorter than M metres (courts, places, mapping stubs)",
            )
        return sp

    cmd("download", "download the OSM extract for the region from Geofabrik", counts=False)
    cmd("import-osm", "build the street network from the OSM extract", counts=False)
    m = cmd("match", "match rides to blocks", counts=False)
    m.add_argument("--sports", default="Ride,EBikeRide", help="comma-separated Strava sport types")
    m.add_argument("--radius", type=float, default=15.0, help="metres")
    m.add_argument("--angle", type=float, default=30.0, help="max heading difference, degrees")
    u = cmd("update", "download (if missing), import (if missing), and match", counts=False)
    u.add_argument("--sports", default="Ride,EBikeRide")

    s = cmd("stats", "overall progress and per-town table")
    s.add_argument("-n", "--limit", type=int, default=25)

    t = cmd("town", "every street in a town and how done it is")
    t.add_argument("name")
    t.add_argument("--todo", action="store_true", help="only streets that aren't done")
    t.add_argument("--sort", default="pct", choices=["pct", "length", "todo", "name", "last"])

    for name, help in [
        ("nearby", "unridden streets near a point (default: where most rides start)"),
        ("pockets", "connected clusters of unridden blocks, ranked by size vs. distance"),
    ]:
        n = cmd(name, help)
        n.add_argument("--at", help="lat,lon")
        n.add_argument("--km", type=float, default=3.0, help="search radius")
        n.add_argument("-n", "--limit", type=int, default=30)
        if name == "nearby":
            n.add_argument("--unnamed", action="store_true", help="include unnamed blocks")
            n.add_argument("--min", type=float, default=25, help="ignore streets with less than this many metres to do")
        else:
            n.add_argument("--min", type=float, default=150, help="ignore clusters with less than this many metres")
            n.add_argument("--cell", type=float, default=400, help="max cluster size, metres")

    a = cmd("almost", "streets 50–90%% done, fewest metres to finish first")
    a.add_argument("--town")
    a.add_argument("-n", "--limit", type=int, default=30)

    r = cmd("rides", "rides ranked by new ground covered")
    r.add_argument("--sort", default="new", choices=["new", "date", "blocks"])
    r.add_argument("--year")
    r.add_argument("-n", "--limit", type=int, default=25)

    r1 = cmd("ride", "the streets a ride covered")
    r1.add_argument("id", type=int, help="Strava activity id")

    st = cmd("street", "block-by-block history of a street")
    st.add_argument("name", help="SQL LIKE pattern, e.g. 'Highland Ave%%'")
    st.add_argument("--town")

    tl = cmd("timeline", "new streets done per year")
    tl.add_argument("--town")

    f = cmd("favorites", "streets ridden most often")
    f.add_argument("-n", "--limit", type=int, default=25)

    sl = cmd("stale", "done streets you haven't been back to in a while")
    sl.add_argument("--before", default="2020-01-01")
    sl.add_argument("--town")
    sl.add_argument("-n", "--limit", type=int, default=25)

    e = cmd("export", "write a GeoJSON and an HTML map of blocks")
    e.add_argument("--town", action="append", help="towns to include (repeatable); default: any >= --min-pct done")
    e.add_argument("--min-pct", type=float, default=10)
    e.add_argument("-o", "--out", help="output basename (default: build/<region>-map)")

    args = p.parse_args(argv)
    paths = Paths(data_dir(args.data_dir), REGIONS[args.region])

    from . import reports

    o = None
    if hasattr(args, "with_paths"):
        o = reports.Opts(
            classes=("street", "path") if args.with_paths else ("street",),
            done_frac=args.done,
            skip_stubs_m=args.skip_stubs,
        )

    if args.cmd in ("download", "update") and (args.cmd == "download" or not paths.pbf.exists()):
        url = f"https://download.geofabrik.de/{paths.region.geofabrik_path}-latest.osm.pbf"
        paths.pbf.parent.mkdir(parents=True, exist_ok=True)
        print(f"downloading {url}", file=sys.stderr)
        tmp = paths.pbf.with_suffix(".part")
        urllib.request.urlretrieve(url, tmp)
        tmp.replace(paths.pbf)
    if args.cmd == "import-osm" or (args.cmd == "update" and not paths.db.exists()):
        from .classify import classify_all
        from .osm import import_osm

        import_osm(paths.pbf, paths.db)
        classify_all(sqlite3.connect(paths.db))
    if args.cmd in ("match", "update"):
        from .coverage import MatchParams, match
        from .rides import load_rides

        rides = load_rides(paths.strava_activities, tuple(args.sports.split(",")))
        kw = {}
        if args.cmd == "match":
            kw = {"radius_m": args.radius, "angle_tol_deg": args.angle}
        match(_connect(paths), rides, MatchParams(**kw))
        return
    if args.cmd in ("download", "import-osm"):
        return

    con = _connect(paths)
    match args.cmd:
        case "stats":
            reports.stats(con, o, args.limit)
        case "town":
            reports.town(con, o, args.name, args.todo, args.sort)
        case "nearby":
            reports.nearby(con, o, args.at, args.km, args.limit, args.unnamed, args.min)
        case "pockets":
            reports.pockets(con, o, args.at, args.km, args.limit, args.min, args.cell)
        case "almost":
            reports.almost(con, o, args.limit, args.town)
        case "rides":
            reports.rides(con, o, args.sort, args.limit, args.year)
        case "ride":
            reports.ride(con, o, args.id)
        case "street":
            reports.street(con, o, args.name, args.town)
        case "timeline":
            reports.timeline(con, o, args.town)
        case "favorites":
            reports.favorites(con, o, args.limit)
        case "stale":
            reports.stale(con, o, args.before, args.limit, args.town)
        case "export":
            from .mapview import write_map

            gj = reports.export_geojson(con, o, args.town, args.min_pct)
            base = args.out or str(paths.out_dir / f"{paths.region.name}-map")
            with open(base + ".geojson", "w") as fh:
                json.dump(gj, fh, separators=(",", ":"))
            write_map(gj, base + ".html", reports.home(con))
            print(f"wrote {base}.geojson and {base}.html ({len(gj['features'])} blocks in {len(gj['towns'])} towns)")
