"""Decide which blocks count.

Each block gets one class. Reports count `street` by default; `path` (bike
paths, shared-use paths) can be added with --with-paths. Everything else is
kept in the database but never counts against you.

  street    public roads you can legally ride: residential up to trunk
  path      cycleways, and paths/pedestrian ways that allow bikes
  service   alleys, driveways, parking aisles
  link      on/off ramps
  private   access=private/no, bicycle=no, motorroad=yes
  other     footways, tracks, bridleways, unknown
"""

from __future__ import annotations

import json
import sqlite3

STREET = {
    "trunk",
    "primary",
    "secondary",
    "tertiary",
    "unclassified",
    "residential",
    "living_street",
    "road",
}
LINK = {"trunk_link", "primary_link", "secondary_link", "tertiary_link"}
BIKE_OK = {"yes", "designated", "permissive", "official"}


def classify(highway: str, tags: dict) -> str:
    access = tags.get("access")
    bicycle = tags.get("bicycle")
    if bicycle in ("no", "dismount", "use_sidepath") or tags.get("motorroad") == "yes":
        return "private"
    if access in ("private", "no", "customers", "delivery") and bicycle not in BIKE_OK:
        return "private"
    if highway in STREET:
        return "street"
    if highway in LINK:
        return "link"
    if highway == "cycleway":
        return "path"
    if highway in ("path", "pedestrian", "footway", "track", "bridleway") and bicycle in BIKE_OK:
        return "path"
    if highway == "path" and bicycle is None:
        # in MA most unsigned paths are rideable rail trails / park paths
        return "path"
    if highway == "service":
        return "service"
    return "other"


def classify_all(con: sqlite3.Connection) -> None:
    cols = [r[1] for r in con.execute("PRAGMA table_info(edges)")]
    if "class" not in cols:
        con.execute("ALTER TABLE edges ADD COLUMN class TEXT")
    rows = con.execute("SELECT id, highway, tags FROM edges").fetchall()
    cache: dict[str, str] = {}
    updates = []
    for eid, hw, tags in rows:
        k = cache.get(tags)
        if k is None:
            k = cache[tags] = classify(hw, json.loads(tags))
        updates.append((k, eid))
    con.executemany("UPDATE edges SET class = ? WHERE id = ?", updates)
    con.execute("CREATE INDEX IF NOT EXISTS edges_class ON edges(class)")
    con.commit()
